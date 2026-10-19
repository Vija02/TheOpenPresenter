import { Pool } from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CLOUD_SIGN_IN_EXPIRED_REASON,
  CONNECT_TO_CLOUD_REASON,
  CloudCallError,
  IntegrationsApi,
  REMOTE_ORGANIZATION_HEADER,
} from "../integrations";

/* -------------------------------------------------------------------------- */

/** A pool whose every query returns `rows`. */
const poolReturning = (rows: unknown[]) => {
  const query = vi.fn().mockResolvedValue({ rows, rowCount: rows.length });
  return { pool: { query } as unknown as Pool, query };
};

const connection = {
  id: "cc1",
  host: "https://cloud.example",
  sessionCookie: "connect.sid=abc",
  targetOrganizationSlug: "grace",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

/* -------------------------------------------------------------------------- */

describe("resolveMode", () => {
  it("is local when this server holds the credentials, without asking the db", async () => {
    const { pool, query } = poolReturning([]);
    const api = new IntegrationsApi(() => pool);

    expect(
      await api.resolveMode({ hasLocalCredentials: true, organizationId: "o1" }),
    ).toEqual({ mode: "local" });
    expect(query).not.toHaveBeenCalled();
  });

  it("is remote through a live cloud connection", async () => {
    const { pool } = poolReturning([{ ...connection, isExpired: false }]);
    const api = new IntegrationsApi(() => pool);

    expect(
      await api.resolveMode({ hasLocalCredentials: false, organizationId: "o1" }),
    ).toEqual({ mode: "remote", cloudConnection: connection });
  });

  it("is unavailable without a cloud connection", async () => {
    const { pool } = poolReturning([]);
    const api = new IntegrationsApi(() => pool);

    expect(
      await api.resolveMode({ hasLocalCredentials: false, organizationId: "o1" }),
    ).toEqual({ mode: "unavailable", reason: CONNECT_TO_CLOUD_REASON });
  });

  it("asks to reconnect when the cloud session has expired", async () => {
    const { pool } = poolReturning([{ ...connection, isExpired: true }]);
    const api = new IntegrationsApi(() => pool);

    expect(
      await api.resolveMode({ hasLocalCredentials: false, organizationId: "o1" }),
    ).toEqual({ mode: "unavailable", reason: CLOUD_SIGN_IN_EXPIRED_REASON });
  });
});

describe("authenticateRemoteRequest", () => {
  it("rejects a request without a session", async () => {
    const { pool } = poolReturning([]);
    const api = new IntegrationsApi(() => pool);

    expect(await api.authenticateRemoteRequest({ headers: {} })).toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it("rejects an org the user is not a member of", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ userId: "u1" }] })
      .mockResolvedValueOnce({ rows: [] });
    const api = new IntegrationsApi(() => ({ query }) as unknown as Pool);

    expect(
      await api.authenticateRemoteRequest({
        user: { session_id: "s1" },
        headers: { [REMOTE_ORGANIZATION_HEADER]: "grace" },
      }),
    ).toMatchObject({ ok: false, status: 403 });
  });

  it("resolves the user and org", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ userId: "u1" }] })
      .mockResolvedValueOnce({ rows: [{ id: "o1" }] });
    const api = new IntegrationsApi(() => ({ query }) as unknown as Pool);

    expect(
      await api.authenticateRemoteRequest({
        user: { session_id: "s1" },
        headers: { [REMOTE_ORGANIZATION_HEADER]: "grace" },
      }),
    ).toEqual({ ok: true, userId: "u1", organizationId: "o1" });
  });
});

describe("callCloud", () => {
  const api = new IntegrationsApi(() => poolReturning([]).pool);

  it("sends the session cookie and org, and parses the reply", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: 1 })));
    vi.stubGlobal("fetch", fetchMock);

    const result = await api.callCloud(connection, "/plugin/x", {
      method: "POST",
      body: { a: 1 },
    });

    expect(result).toEqual({ ok: 1 });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://cloud.example/plugin/x");
    expect(init.headers.Cookie).toBe("connect.sid=abc");
    expect(init.headers[REMOTE_ORGANIZATION_HEADER]).toBe("grace");
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
  });

  it("turns a 401 into a reconnect message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 401 })),
    );

    await expect(api.callCloud(connection, "/x")).rejects.toMatchObject({
      status: 401,
      message: CLOUD_SIGN_IN_EXPIRED_REASON,
    });
  });

  it("surfaces the cloud's own error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: "Nope" }), { status: 404 }),
        ),
    );

    await expect(api.callCloud(connection, "/x")).rejects.toEqual(
      new CloudCallError("Nope", 404),
    );
  });

  it("reports an unreachable cloud with status 0", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ENOTFOUND")));

    await expect(api.callCloud(connection, "/x")).rejects.toMatchObject({
      status: 0,
    });
  });
});
