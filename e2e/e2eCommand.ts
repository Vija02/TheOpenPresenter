import type { APIRequestContext, Page } from "@playwright/test";
import type { OrganizationType } from "@repo/graphql";
import { readFileSync } from "node:fs";
import { basename, extname, isAbsolute, join } from "node:path";

/**
 * Fixture paths are written relative to the e2e directory, which is where this
 * file lives — resolving against it rather than cwd keeps them working however
 * Playwright was invoked.
 */
const readFixture = (filePath: string) =>
  readFileSync(isAbsolute(filePath) ? filePath : join(__dirname, filePath));

type User = {
  id: string;
  username: string;
  name: string;
  is_admin: boolean;
  is_verified: boolean;
};

export class E2ECommandAPI {
  private page: Page;
  private request: APIRequestContext;

  constructor(page: Page, request: APIRequestContext) {
    this.page = page;
    this.request = request;
  }

  async login(payload?: {
    next?: string;
    username?: string;
    name?: string;
    verified?: boolean;
    password?: string;
    orgs?: {
      name: string;
      slug: string;
      /** Defaults to church when omitted */
      organizationType?: OrganizationType;
      projects?: {
        name: string;
        slug: string;
        /** Pre-populates the project's Y.Doc with the given scenes */
        scenes?: {
          pluginName: string;
          pluginData: Record<string, any>;
          rendererPluginData?: Record<string, any>;
          activate?: boolean;
          name?: string;
        }[];
        isPublic?: boolean;
      }[];
      owner?: boolean;
    }[];
  }) {
    await this.page.goto(
      `/E2EServerCommand?command=login${
        payload ? `&payload=${encodeURIComponent(JSON.stringify(payload))}` : ""
      }`,
    );
  }

  /**
   * Deletes all users with username starting 'test'.
   */
  async serverCommand(command: "clearTestUsers"): Promise<{
    success: true;
  }>;

  /**
   * Deletes all organizations with slug starting 'test'.
   */
  async serverCommand(command: "clearTestOrganizations"): Promise<{
    success: true;
  }>;

  /**
   * Clears Bible plugin test data.
   */
  async serverCommand(command: "clearBibleData"): Promise<{
    success: true;
  }>;

  /**
   * Which provider each registered AI capability will reach, keyed by
   * capability id. Base URLs only, no keys.
   */
  async serverCommand(command: "aiWiring"): Promise<{
    success: true;
    configured: boolean;
    default: { baseURL: string | null; model: string | null };
    capabilities: Record<
      string,
      { baseURL: string | null; model: string | null }
    >;
  }>;

  /**
   * Deletes a single organization
   */
  async serverCommand(
    command: "clearOrganizationBySlug",
    payload: { slug: string },
  ): Promise<{ success: true }>;

  /**
   * Deletes a single user by username. Username must start with 'testuser'.
   */
  async serverCommand(
    command: "clearUserByUsername",
    payload: { username: string },
  ): Promise<{ success: true }>;

  /**
   * Creates a verified or unverified user, bypassing all safety checks.
   * Redirects to `next`.
   *
   * Default values:
   *
   * - username: `testuser`
   * - email: `${username}@example.com`
   * - verified: false
   * - name: `${username}`
   * - password: `TestUserPassword`
   * - next: `/`
   */
  async serverCommand(
    command: "createUser",
    payload: {
      username?: string;
      email?: string;
      verified?: boolean;
      name?: string;
      password?: string;
      next?: string;
    },
  ): Promise<{
    user: User;
    userEmailId: string;
    verificationToken: string | null;
  }>;

  /**
   * Gets the secrets for the specified email, allowing email
   * validation. If unspecified, email defaults to `testuser@example.com`.
   */
  async serverCommand(
    command: "getEmailSecrets",
    payload?: { email?: string },
  ): Promise<{
    user_email_id: string;
    verification_token: string | null;
  }>;

  /**
   * Marks the given user as verified. Used for testing live user subscription
   * updates.
   */
  async serverCommand(
    command: "verifyUser",
    payload?: { username?: string },
  ): Promise<{ success: true }>;

  /**
   * Starts a mock host device that mimics Tauri behavior.
   * Starts dumbpipe and calls /device/host/init.
   * After that, installDeviceHostHandler handles all the polling automatically.
   */
  async serverCommand(
    command: "startMockHostDevice",
    payload?: {
      serverHost?: string;
      serverPort?: number;
    },
  ): Promise<{
    success: true;
    irohEndpointId: string;
    irohTicket: string;
  }>;

  /**
   * Stop the mock host device.
   */
  async serverCommand(
    command: "stopMockHostDevice",
  ): Promise<{ success: true }>;

  /**
   * Trigger an immediate sync of the device host handler.
   * This updates active project IDs without waiting for the polling interval.
   * Useful for E2E tests.
   */
  async serverCommand(
    command: "syncMockHostDevice",
  ): Promise<{ success: true }>;

  /**
   * Get status of the mock host device.
   */
  async serverCommand(
    command: "stopMockHostDevice",
  ): Promise<{ success: true }>;

  /**
   * Get status of the mock host device.
   */
  async serverCommand(
    command: "getMockHostDeviceStatus",
  ): Promise<{ running: false } | { running: true; irohEndpointId: string }>;

  /**
   * Create a cloud connection for E2E testing (localhost only).
   * This is what allows an org to share projects with another org.
   */
  async serverCommand(
    command: "createCloudConnection",
    payload: {
      organizationSlug: string;
      targetOrganizationSlug: string;
    },
  ): Promise<{ success: true; connectionId: string }>;

  /**
   * Delete cloud connections for an organization.
   */
  async serverCommand(
    command: "deleteCloudConnections",
    payload: { organizationSlug: string },
  ): Promise<{ success: true }>;

  /**
   * Clear all organization_active_devices entries.
   * Used for test cleanup.
   */
  async serverCommand(command: "clearAllActiveDevices"): Promise<{
    success: true;
  }>;

  /**
   * Create or upsert a screen in an organization. If the org doesn't exist, it is created
   */
  async serverCommand(
    command: "setupScreen",
    payload?: {
      orgSlug?: string;
      orgName?: string;
      slug?: string;
      name?: string;
      anonEnabled?: boolean;
      anonOnEmpty?: "allow" | "request";
      anonOnTakeover?: "allow" | "request" | "timer";
      registeredEnabled?: boolean;
      registeredOnEmpty?: "allow" | "request";
      registeredOnTakeover?: "allow" | "request" | "timer";
    },
  ): Promise<{
    success: true;
    screenId: string;
    screenSlug: string;
    screenCode: string;
    organizationId: string;
  }>;

  /**
   * Insert a registered screen guest
   */
  async serverCommand(
    command: "setupScreenGuest",
    payload: {
      orgSlug: string;
      displayName: string;
      passcode: string;
      email?: string | null;
    },
  ): Promise<{ success: true; screenGuestId: string }>;

  async serverCommand(command: string, payload?: any): Promise<any> {
    const res = await this.request.get(
      `/E2EServerCommand?command=${encodeURIComponent(command)}${
        payload ? `&payload=${encodeURIComponent(JSON.stringify(payload))}` : ""
      }`,
    );

    return res.json();
  }

  async seedVideoMedia(payload: {
    orgSlug: string;
    videoPath: string;
    posterPath?: string;
    originalName?: string;
    duration?: number;
  }): Promise<{
    success: true;
    mediaId: string;
    mediaName: string;
    thumbnailMediaId: string | null;
    thumbnailMediaName: string | null;
  }> {
    const {
      orgSlug,
      videoPath,
      posterPath,
      originalName = basename(videoPath),
      duration,
    } = payload;

    const res = await this.request.post(
      "/E2EServerCommand?command=seedVideoMedia",
      {
        headers: { "x-top-csrf-protection": "1" },
        data: {
          orgSlug,
          originalName,
          duration,
          videoExtension: extname(videoPath).replace(".", ""),
          video: readFixture(videoPath).toString("base64"),
          ...(posterPath
            ? {
                posterExtension: extname(posterPath).replace(".", ""),
                poster: readFixture(posterPath).toString("base64"),
              }
            : {}),
        },
      },
    );

    if (!res.ok()) {
      throw new Error(
        `seedVideoMedia failed: ${res.status()} ${await res.text()}`,
      );
    }

    return res.json();
  }

  /**
   * Same as `login`, but POSTs the payload
   */
  async loginWithScenes(payload: {
    next?: string;
    username?: string;
    orgs?: {
      name: string;
      slug: string;
      owner?: boolean;
      projects?: {
        name: string;
        slug: string;
        scenes?: {
          pluginName: string;
          pluginData: Record<string, any>;
          rendererPluginData?: Record<string, any>;
          activate?: boolean;
          name?: string;
        }[];
        isPublic?: boolean;
      }[];
    }[];
  }): Promise<void> {
    const res = await this.page.request.post(
      "/E2EServerCommand?command=login",
      {
        headers: { "x-top-csrf-protection": "1" },
        maxRedirects: 0,
        data: payload,
      },
    );
    // 3xx is the expected success (the un-followed redirect).
    if (res.status() >= 400) {
      throw new Error(
        `loginWithScenes failed: ${res.status()} ${await res.text()}`,
      );
    }
  }
}
