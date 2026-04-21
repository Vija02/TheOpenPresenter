import { Pool, PoolClient } from "pg";

const JOB_COMPLETION_CHANNEL_PREFIX = "job_complete";

export function generateCompletionKey(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

export function getCompletionChannel(completionKey: string): string {
  return `${JOB_COMPLETION_CHANNEL_PREFIX}:${completionKey}`;
}

export interface JobResult<T = unknown> {
  success: boolean;
  result?: T;
  error?: string;
}

export interface AwaitableJobPayload {
  __completionKey?: string;
}

export interface AwaitJobOptions {
  /** Timeout in milliseconds. Default: 30000 (30 seconds) */
  timeoutMs?: number;
}

export async function addJobAndAwait<
  TPayload extends object,
  TResult = unknown,
>(
  pgPool: Pool,
  taskIdentifier: string,
  payload: TPayload,
  options: AwaitJobOptions = {},
): Promise<JobResult<TResult>> {
  const { timeoutMs = 30000 } = options;
  const completionKey = generateCompletionKey();
  const channel = getCompletionChannel(completionKey);

  const listenerClient = await pgPool.connect();

  try {
    // Set up the listener before adding the job to avoid race conditions
    const resultPromise = new Promise<JobResult<TResult>>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Job timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      listenerClient.on("notification", (msg) => {
        if (msg.channel === channel) {
          clearTimeout(timeout);
          try {
            const result = JSON.parse(
              msg.payload || "{}",
            ) as JobResult<TResult>;
            resolve(result);
          } catch (e) {
            reject(new Error("Failed to parse job result"));
          }
        }
      });
    });

    // Start listening
    await listenerClient.query(`LISTEN "${channel}"`);

    // Add the job with the completion key in the payload
    const jobPayload: TPayload & AwaitableJobPayload = {
      ...payload,
      __completionKey: completionKey,
    };

    await pgPool.query(`SELECT graphile_worker.add_job($1, $2::json)`, [
      taskIdentifier,
      JSON.stringify(jobPayload),
    ]);

    return await resultPromise;
  } finally {
    // Clean up: stop listening and release the client
    await listenerClient.query(`UNLISTEN "${channel}"`).catch(() => {});
    listenerClient.release();
  }
}

export async function notifyJobComplete<T = unknown>(
  withPgClient: <TResult>(
    callback: (client: PoolClient) => Promise<TResult>,
  ) => Promise<TResult>,
  completionKey: string | undefined,
  result: JobResult<T>,
): Promise<void> {
  // If no completion key, this job wasn't awaited - skip notification
  if (!completionKey) {
    return;
  }

  const channel = getCompletionChannel(completionKey);

  await withPgClient(async (client) => {
    await client.query(`SELECT pg_notify($1, $2)`, [
      channel,
      JSON.stringify(result),
    ]);
  });
}

export async function notifyJobSuccess<T = unknown>(
  withPgClient: <TResult>(
    callback: (client: PoolClient) => Promise<TResult>,
  ) => Promise<TResult>,
  completionKey: string | undefined,
  result?: T,
): Promise<void> {
  await notifyJobComplete(withPgClient, completionKey, {
    success: true,
    result,
  });
}

export async function notifyJobFailure(
  withPgClient: <TResult>(
    callback: (client: PoolClient) => Promise<TResult>,
  ) => Promise<TResult>,
  completionKey: string | undefined,
  error: string,
): Promise<void> {
  await notifyJobComplete(withPgClient, completionKey, {
    success: false,
    error,
  });
}
