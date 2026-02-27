import type { APIRequestContext, Page } from "@playwright/test";

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
      projects?: { name: string; slug: string }[];
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

  async serverCommand(command: string, payload?: any): Promise<any> {
    const res = await this.request.get(
      `/E2EServerCommand?command=${encodeURIComponent(command)}${
        payload ? `&payload=${encodeURIComponent(JSON.stringify(payload))}` : ""
      }`,
    );

    return res.body;
  }
}
