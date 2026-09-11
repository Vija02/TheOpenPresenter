import { describe, expect, it } from "vitest";

import {
  UploadLinkRow,
  attemptsRemaining,
  checkUploadLink,
  generateUploadToken,
} from "../rules";

const link = (overrides: Partial<UploadLinkRow> = {}): UploadLinkRow => ({
  id: "link-1",
  organization_id: "org-1",
  project_id: "project-1",
  scene_id: "scene_1",
  plugin_id: "plugin_1",
  token: "tok",
  label: null,
  max_attempts: null,
  attempt_count: 0,
  current_upload_id: null,
  expires_at: null,
  is_active: true,
  ...overrides,
});

describe("checkUploadLink", () => {
  it("accepts a plain active link", () => {
    expect(checkUploadLink(link())).toEqual({ ok: true });
  });

  it("rejects an unknown token", () => {
    expect(checkUploadLink(null)).toEqual({ ok: false, reason: "not-found" });
  });

  it("rejects a revoked link", () => {
    expect(checkUploadLink(link({ is_active: false }))).toEqual({
      ok: false,
      reason: "revoked",
    });
  });

  it("rejects an expired link", () => {
    expect(
      checkUploadLink(
        link({ expires_at: "2026-01-01T00:00:00Z" }),
        new Date("2026-01-02T00:00:00Z"),
      ),
    ).toEqual({ ok: false, reason: "expired" });
  });

  it("accepts a link whose expiry is still ahead", () => {
    expect(
      checkUploadLink(
        link({ expires_at: "2026-01-03T00:00:00Z" }),
        new Date("2026-01-02T00:00:00Z"),
      ),
    ).toEqual({ ok: true });
  });

  it("rejects once the upload limit is reached", () => {
    expect(checkUploadLink(link({ max_attempts: 3, attempt_count: 3 }))).toEqual({
      ok: false,
      reason: "limit-reached",
    });
  });

  it("accepts while below the upload limit", () => {
    expect(checkUploadLink(link({ max_attempts: 3, attempt_count: 2 }))).toEqual({
      ok: true,
    });
  });
});

describe("generateUploadToken", () => {
  it("is URL-safe", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateUploadToken()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("doesn't repeat", () => {
    const seen = new Set(
      Array.from({ length: 200 }, () => generateUploadToken()),
    );
    expect(seen.size).toBe(200);
  });
});

/**
 * A link owns one slide. Replacing it spends an attempt but does not add a
 * second slide, so the cap is purely abuse prevention.
 */
describe("attempt limits", () => {
  it("still allows uploading while attempts remain", () => {
    expect(
      checkUploadLink(link({ max_attempts: 3, attempt_count: 2 })),
    ).toEqual({ ok: true });
  });

  it("blocks once attempts are spent", () => {
    expect(
      checkUploadLink(link({ max_attempts: 3, attempt_count: 3 })),
    ).toEqual({ ok: false, reason: "limit-reached" });
  });

  it("lets a visitor replace an existing slide within the cap", () => {
    const replacing = link({
      max_attempts: 3,
      attempt_count: 1,
      current_upload_id: "upload-1",
    });
    expect(checkUploadLink(replacing)).toEqual({ ok: true });
  });

  it("counts attempts, not slides kept", () => {
    // Three replacements leave one slide but spend three attempts.
    expect(
      attemptsRemaining(link({ max_attempts: 5, attempt_count: 3 })),
    ).toBe(2);
  });

  it("reports no limit when max_attempts is unset", () => {
    expect(attemptsRemaining(link({ attempt_count: 99 }))).toBeNull();
  });

  it("never reports negative attempts remaining", () => {
    expect(
      attemptsRemaining(link({ max_attempts: 2, attempt_count: 5 })),
    ).toBe(0);
  });
});
