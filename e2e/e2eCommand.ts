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
    orgs?: [[string, string] | [string, string, boolean]];
  }) {
    await this.page.goto(
      `/E2EServerCommand?command=login${
        payload ? `&payload=${encodeURIComponent(JSON.stringify(payload))}` : ""
      }`,
    );
    // await page.waitForURL("**/login");
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

  async serverCommand(command: string, payload?: any): Promise<any> {
    const res = await this.request.get(
      `/E2EServerCommand?command=${encodeURIComponent(command)}${
        payload ? `&payload=${encodeURIComponent(JSON.stringify(payload))}` : ""
      }`,
    );

    return res.body;
  }
}