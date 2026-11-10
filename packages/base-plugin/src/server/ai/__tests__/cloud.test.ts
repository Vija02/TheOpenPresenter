import { afterEach, describe, expect, it, vi } from "vitest";

import type { IntegrationsApi } from "../../integrations";
import {
  AI_SIGN_IN_EXPIRED_REASON,
  CONNECT_FOR_AI_REASON,
  forwardAiToCloud,
  organizationIdOf,
  placeAiRequest,
  withoutOrganizationId,
} from "../cloud";

const ORG = "0b8f6a52-6a0e-4a0a-9a4e-3f1c2d7e8a90";
const connection = {
  id: "conn",
  host: "https://cloud.example/",
  sessionCookie: "connect.sid=abc",
  targetOrganizationSlug: "grace",
};
const req = { user: { session_id: "s" }, headers: {} };

const integrations = ({
  member = true,
  link = null as null | { isExpired: boolean },
} = {}) =>
  ({
    getRequestUserId: async () => "user",
    isOrganizationMember: async () => member,
    getCloudConnection: async () => (link ? { ...connection, ...link } : null),
  }) as unknown as IntegrationsApi;

const withKey = (key: string | undefined) => {
  vi.stubEnv("AI_API_KEY", key ?? "");
};

afterEach(() => vi.unstubAllEnvs());

describe("placeAiRequest", () => {
  it("uses the cloud whenever the organization is linked, key or not", async () => {
    withKey("local-key");
    const placement = await placeAiRequest(
      integrations({ link: { isExpired: false } }),
      req,
      ORG,
    );
    expect(placement).toEqual({ mode: "cloud", connection });
  });

  it("uses this server's key without a link", async () => {
    withKey("local-key");
    expect(await placeAiRequest(integrations(), req, ORG)).toEqual({
      mode: "local",
    });
  });

  it("asks to connect when there is neither", async () => {
    withKey(undefined);
    expect(await placeAiRequest(integrations(), req, ORG)).toEqual({
      mode: "unavailable",
      reason: CONNECT_FOR_AI_REASON,
    });
  });

  it("asks to reconnect when the link's sign-in has expired", async () => {
    withKey(undefined);
    expect(
      await placeAiRequest(
        integrations({ link: { isExpired: true } }),
        req,
        ORG,
      ),
    ).toEqual({ mode: "unavailable", reason: AI_SIGN_IN_EXPIRED_REASON });
  });

  it("never lends a link to someone outside the organization", async () => {
    withKey(undefined);
    const placement = await placeAiRequest(
      integrations({ member: false, link: { isExpired: false } }),
      req,
      ORG,
    );
    expect(placement.mode).toBe("unavailable");
  });
});

const sse = (frames: unknown[], status = 200) =>
  new Response(frames.map((f) => `data: ${JSON.stringify(f)}\n\n`).join(""), {
    status,
    headers: { "Content-Type": "text/event-stream" },
  });

const collect = async (gen: AsyncGenerator<unknown>) => {
  const out: unknown[] = [];
  for await (const event of gen) out.push(event);
  return out;
};

describe("forwardAiToCloud", () => {
  it("sends the request as the link's user and passes every event through", async () => {
    const frames = [{ type: "step", n: 1 }, { delta: "Hi" }, { done: true }];
    const fetchImpl = vi.fn(async () => sse(frames));

    const out = await collect(
      forwardAiToCloud(
        connection,
        "/ai/layout",
        { request: "Bigger title" },
        new AbortController().signal,
        fetchImpl as unknown as typeof fetch,
      ),
    );

    expect(out).toEqual(frames);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    expect(url.toString()).toBe("https://cloud.example/ai/layout");
    const headers = init.headers as Record<string, string>;
    expect(headers.Cookie).toBe("connect.sid=abc");
    expect(headers["x-top-csrf-protection"]).toBe("1");
    expect(headers["x-top-organization-slug"]).toBe("grace");
    expect(JSON.parse(init.body as string)).toEqual({
      request: "Bigger title",
    });
  });

  it("asks to reconnect when the cloud rejects the sign-in", async () => {
    const fetchImpl = async () => new Response("", { status: 401 });
    await expect(
      collect(
        forwardAiToCloud(
          connection,
          "/ai/layout",
          {},
          new AbortController().signal,
          fetchImpl as unknown as typeof fetch,
        ),
      ),
    ).rejects.toThrow(AI_SIGN_IN_EXPIRED_REASON);
  });

  it("says so when the cloud can't be reached", async () => {
    const fetchImpl = async () => {
      throw new TypeError("fetch failed");
    };
    await expect(
      collect(
        forwardAiToCloud(
          connection,
          "/ai/layout",
          {},
          new AbortController().signal,
          fetchImpl as unknown as typeof fetch,
        ),
      ),
    ).rejects.toThrow("Couldn't reach TheOpenPresenter Cloud");
  });
});

describe("request body", () => {
  it("reads the organization and leaves it out of what the cloud gets", () => {
    const raw = { organizationId: ORG, request: "x" };
    expect(organizationIdOf(raw)).toBe(ORG);
    expect(organizationIdOf({ organizationId: "nope" })).toBeUndefined();
    expect(withoutOrganizationId(raw)).toEqual({ request: "x" });
  });
});
