import { expect, test } from "@playwright/test";

import { E2ECommandAPI } from "../../e2eCommand";
import { stubTurnstile } from "../../helpers/turnstile";

const PASSWORD = "TestUserPassword";

const REGISTERING_NAME = "testuser Register";
const REGISTERING_USERNAME = "testuser_Register";

test.describe("RegisterPage", () => {
  test.beforeEach(async ({ page }) => {
    await stubTurnstile(page);
  });

  test("shows register form on /register", async ({ page }) => {
    await page.goto("/register");

    await expect(
      page.getByRole("heading", { name: "Create your account" }),
    ).toBeVisible();
    await expect(page.getByTestId("registerpage-input-name")).toBeVisible();
    await expect(page.getByTestId("registerpage-input-email")).toBeVisible();
    await expect(page.getByTestId("registerpage-input-password")).toBeVisible();
    await expect(
      page.getByTestId("registerpage-input-password2"),
    ).toBeVisible();
  });

  test("registers without a username and derives one", async ({
    page,
    request,
  }) => {
    const e2eCommand = new E2ECommandAPI(page, request);
    const clear = () =>
      e2eCommand.serverCommand("clearUserByUsername", {
        username: REGISTERING_USERNAME,
      });

    await clear();

    try {
      await page.goto("/register");
      await page.getByTestId("registerpage-input-name").fill(REGISTERING_NAME);
      await page
        .getByTestId("registerpage-input-email")
        .fill(`testuser+${Date.now()}@example.com`);
      await page.getByTestId("registerpage-input-password").fill(PASSWORD);
      await page.getByTestId("registerpage-input-password2").fill(PASSWORD);

      await page.getByTestId("registerpage-submit-button").click();

      // Successful registration logs the user straight in and redirects to /o/
      await page.waitForURL((url) => url.pathname.startsWith("/o"));

      // The form no longer collects a username, so the server must have
      // derived one from the name.
      const username = await page.evaluate(async () => {
        const res = await fetch("/graphql", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "CSRF-Token": (window as any).__APP_DATA__?.CSRF_TOKEN,
          },
          body: JSON.stringify({ query: "{ currentUser { username } }" }),
        });
        const json = await res.json();
        return json?.data?.currentUser?.username as string | undefined;
      });

      expect(username).toBe(REGISTERING_USERNAME);
    } finally {
      await clear();
    }
  });

  test("rejects mismatched passwords", async ({ page }) => {
    await page.goto("/register");
    // Deliberately a name no other test registers, so a validation-only run
    // can never create or clash with a real user.
    await page.getByTestId("registerpage-input-name").fill("testuser Mismatch");
    await page
      .getByTestId("registerpage-input-email")
      .fill(`testuser+${Date.now()}@example.com`);
    await page.getByTestId("registerpage-input-password").fill(PASSWORD);
    await page
      .getByTestId("registerpage-input-password2")
      .fill("DifferentPassword");

    await page.getByTestId("registerpage-submit-button").click();

    await expect(
      page.getByText("Make sure your password is the same in both password"),
    ).toBeVisible();
    expect(page.url()).toContain("/register");
  });
});
