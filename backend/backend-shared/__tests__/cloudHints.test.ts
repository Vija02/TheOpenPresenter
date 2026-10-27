import { EventEmitter, on } from "events";
import {
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
  parse,
} from "graphql";
import { useServer } from "graphql-ws/lib/use/ws";
import { createServer } from "http";
import { AddressInfo } from "net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocketServer } from "ws";

import { CloudHint, subscribeToCloudHints } from "../src/cloud/sync/cloudHints";

/**
 * The studio's side of the cloud's `cloudOrganizationChanged`, against a
 * graphql-ws server standing in for the cloud's PostGraphile, which closes
 * the socket on anything but a subscription.
 */

const Hint = new GraphQLObjectType({
  name: "CloudSyncHint",
  fields: { entity: { type: GraphQLString }, origin: { type: GraphQLString } },
});
const Query = new GraphQLObjectType({
  name: "Query",
  fields: { ok: { type: GraphQLString } },
});

const startCloud = async ({
  supportsHints = true,
  /** Errors the first subscribes answer with, in turn. */
  failWith = [] as string[],
} = {}) => {
  const hints = new EventEmitter();
  const subscribed: { slug: string; cookie?: string }[] = [];
  const failures = [...failWith];
  const attempts = { count: 0 };
  async function* listen(slug: string, cookie?: string) {
    subscribed.push({ slug, cookie });
    for await (const [hint] of on(hints, "hint")) {
      yield { cloudOrganizationChanged: hint };
    }
  }
  const schema = new GraphQLSchema({
    query: Query,
    subscription: supportsHints
      ? new GraphQLObjectType({
          name: "Subscription",
          fields: {
            cloudOrganizationChanged: {
              type: Hint,
              args: { organizationSlug: { type: new GraphQLNonNull(GraphQLString) } },
              subscribe: (_root, args, context) => {
                attempts.count += 1;
                const failure = failures.shift();
                if (failure) throw new Error(failure);
                return listen(args.organizationSlug, context.cookie);
              },
            },
          },
        })
      : // An older cloud: subscriptions, but not this one.
        new GraphQLObjectType({
          name: "Subscription",
          fields: { currentUserUpdated: { type: GraphQLString } },
        }),
  });
  const http = createServer();
  const wss = new WebSocketServer({ server: http, path: "/graphql" });
  const server = useServer(
    {
      schema,
      context: (ctx) => ({ cookie: ctx.extra.request.headers.cookie }),
      onSubscribe: (ctx, message) => {
        const operation = parse(message.payload.query).definitions[0];
        if (operation?.kind === "OperationDefinition" && operation.operation !== "subscription") {
          ctx.extra.socket.close(4500, "Only subscriptions are allowed over WebSocket transport");
        }
      },
    },
    wss,
  );
  await new Promise<void>((resolve) => http.listen(0, resolve));
  return {
    host: `http://localhost:${(http.address() as AddressInfo).port}`,
    subscribed,
    attempts,
    send: (hint: CloudHint) => hints.emit("hint", hint),
    /** Drop every connection, as a network blip would. */
    drop: () => wss.clients.forEach((socket) => socket.terminate()),
    close: async () => {
      await server.dispose();
      await new Promise((resolve) => http.close(resolve));
    },
  };
};

let cleanup: (() => unknown)[] = [];
afterEach(async () => {
  for (const fn of cleanup.reverse()) await fn();
  cleanup = [];
});

const subscribe = (
  cloud: Awaited<ReturnType<typeof startCloud>>,
  handlers: Partial<Parameters<typeof subscribeToCloudHints>[0]> = {},
) => {
  const dispose = subscribeToCloudHints({
    host: cloud.host,
    sessionCookie: "session=abc",
    organizationSlug: "church",
    onHint: () => {},
    onReconnected: () => {},
    onRefused: () => {},
    ...handlers,
  });
  cleanup.push(dispose);
  return dispose;
};

describe("subscribeToCloudHints", () => {
  it("sends nothing over the socket but its subscription", async () => {
    const cloud = await startCloud();
    cleanup.push(cloud.close);

    subscribe(cloud);
    await vi.waitFor(() => expect(cloud.subscribed).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Anything else would have closed it, and subscribed again.
    expect(cloud.subscribed).toHaveLength(1);
  });

  it("logs in with the session cookie and passes on hints", async () => {
    const cloud = await startCloud();
    cleanup.push(cloud.close);
    const onHint = vi.fn();

    subscribe(cloud, { onHint });
    await vi.waitFor(() => expect(cloud.subscribed).toHaveLength(1));
    cloud.send({ entity: "app_public.projects", origin: null });

    await vi.waitFor(() =>
      expect(onHint).toHaveBeenCalledWith({
        entity: "app_public.projects",
        origin: null,
      }),
    );
    expect(cloud.subscribed).toEqual([
      { slug: "church", cookie: "session=abc" },
    ]);
  });

  it("says so when it reconnects, and keeps the subscription", async () => {
    const cloud = await startCloud();
    cleanup.push(cloud.close);
    const onHint = vi.fn();
    const onReconnected = vi.fn();

    subscribe(cloud, { onHint, onReconnected });
    await vi.waitFor(() => expect(cloud.subscribed).toHaveLength(1));
    cloud.drop();

    await vi.waitFor(() => expect(onReconnected).toHaveBeenCalledOnce(), {
      timeout: 5000,
    });
    await vi.waitFor(() => expect(cloud.subscribed).toHaveLength(2));
    cloud.send({ entity: "app_public.tags", origin: null });
    await vi.waitFor(() => expect(onHint).toHaveBeenCalledOnce());
  });

  it("tries again later when subscribing fails, and catches up", async () => {
    const cloud = await startCloud({ failWith: ["Connection terminated"] });
    cleanup.push(cloud.close);
    const onRefused = vi.fn();
    const onReconnected = vi.fn();

    subscribe(cloud, { onRefused, onReconnected, resubscribeMs: 50 });

    await vi.waitFor(() => expect(cloud.subscribed).toHaveLength(1));
    expect(cloud.attempts.count).toBe(2);
    expect(onReconnected).toHaveBeenCalledOnce();
    expect(onRefused).not.toHaveBeenCalled();
  });

  it("stops when the login cannot see the organization", async () => {
    const cloud = await startCloud({
      failWith: ["You do not have access to this organization"],
    });
    cleanup.push(cloud.close);
    const onRefused = vi.fn();

    subscribe(cloud, { onRefused, resubscribeMs: 50 });

    await vi.waitFor(() => expect(onRefused).toHaveBeenCalledOnce());
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(cloud.attempts.count).toBe(1);
  });

  it("stops when the cloud has no such subscription", async () => {
    const cloud = await startCloud({ supportsHints: false });
    cleanup.push(cloud.close);
    const onRefused = vi.fn();

    subscribe(cloud, { onRefused });

    await vi.waitFor(() => expect(onRefused).toHaveBeenCalledOnce());
  });
});
