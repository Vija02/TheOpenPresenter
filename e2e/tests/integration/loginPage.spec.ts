import { expect, test } from "@playwright/test";

import { E2ECommandAPI } from "../../e2eCommand";

test.describe("LoginPage", () => {
  test.beforeEach(async ({ page, request }) => {
    const e2eCommand = new E2ECommandAPI(page, request);
    await Promise.all([
      e2eCommand.serverCommand("clearTestUsers"),
      e2eCommand.serverCommand("clearTestOrganizations"),
    ]);
  });

  test("shows login form on /login", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
    await expect(page.getByTestId("loginpage-input-username")).toBeVisible();
    await expect(page.getByTestId("loginpage-input-password")).toBeVisible();
  });

  test("QR login modal opens automatically when redirected from latest/render", async ({
    page,
  }) => {
    await page.goto("/o/my-unauthenticated-org/latest/render?kiosk");

    await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
    expect(page.url()).toBe(
      "http://localhost:5678/login?next=%2Fo%2Fmy-unauthenticated-org%2Flatest%2Frender&kiosk",
    );
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: "QR Login" })).toBeVisible();
    await expect(
      page.getByText("Scan with your mobile phone to log in"),
    ).toBeVisible();
  });
});
