import { ScreenControlPage } from "../pages/ScreenGuest/ScreenControlPage";
import { ScreenLoginPage } from "../pages/ScreenGuest/ScreenLoginPage";
import { ScreenRequestPage } from "../pages/ScreenGuest/ScreenRequestPage";
import { test as base } from "./baseFixture";

type SetupScreenOptions = {
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
};

type SetupGuestOptions = {
  orgSlug?: string;
  displayName?: string;
  passcode?: string;
  email?: string | null;
};

type ScreenContext = {
  orgSlug: string;
  screenSlug: string;
  screenId: string;
  screenCode: string;
};

type ScreenGuestContext = {
  screenGuestId: string;
  passcode: string;
  email: string | null;
  displayName: string;
};

type ScreenFixture = {
  screenLoginPage: ScreenLoginPage;
  screenRequestPage: ScreenRequestPage;
  screenControlPage: ScreenControlPage;
  setupScreen: (options?: SetupScreenOptions) => Promise<ScreenContext>;
  setupScreenGuest: (
    options?: SetupGuestOptions,
  ) => Promise<ScreenGuestContext>;
  loginAsAnonGuest: (
    ctx: ScreenContext,
    displayName?: string,
  ) => Promise<void>;
  loginAsRegisteredGuest: (
    ctx: ScreenContext,
    credential: string,
  ) => Promise<void>;
};

const DEFAULT_ORG_SLUG = "testorg";
const DEFAULT_ORG_NAME = "TestOrg";
const DEFAULT_SCREEN_SLUG = "testscreen";
const DEFAULT_SCREEN_NAME = "Test Screen";

export const test = base.extend<ScreenFixture>({
  screenLoginPage: async ({ page }, use) => {
    await use(new ScreenLoginPage(page));
  },
  screenRequestPage: async ({ page }, use) => {
    await use(new ScreenRequestPage(page));
  },
  screenControlPage: async ({ page }, use) => {
    await use(new ScreenControlPage(page));
  },
  setupScreen: async ({ e2eCommand }, use) => {
    const fn = async (options: SetupScreenOptions = {}) => {
      const payload = {
        orgSlug: DEFAULT_ORG_SLUG,
        orgName: DEFAULT_ORG_NAME,
        slug: DEFAULT_SCREEN_SLUG,
        name: DEFAULT_SCREEN_NAME,
        ...options,
      };
      const result = await e2eCommand.serverCommand("setupScreen", payload);
      return {
        orgSlug: payload.orgSlug,
        screenSlug: result.screenSlug,
        screenId: result.screenId,
        screenCode: result.screenCode,
      };
    };
    await use(fn);
  },
  setupScreenGuest: async ({ e2eCommand }, use) => {
    const fn = async (options: SetupGuestOptions = {}) => {
      const orgSlug = options.orgSlug ?? DEFAULT_ORG_SLUG;
      const displayName = options.displayName ?? "Test Guest";
      const passcode = options.passcode ?? "TestPasscode123";
      const email =
        options.email === undefined ? "guest@example.com" : options.email;
      const result = await e2eCommand.serverCommand("setupScreenGuest", {
        orgSlug,
        displayName,
        passcode,
        email,
      });
      return {
        screenGuestId: result.screenGuestId,
        passcode,
        email,
        displayName,
      };
    };
    await use(fn);
  },
  loginAsAnonGuest: async ({ screenLoginPage }, use) => {
    const fn = async (ctx: ScreenContext, displayName?: string) => {
      await screenLoginPage.goto(ctx.orgSlug, ctx.screenSlug);
      await screenLoginPage.continueAsGuest(displayName);
    };
    await use(fn);
  },
  loginAsRegisteredGuest: async ({ screenLoginPage }, use) => {
    const fn = async (ctx: ScreenContext, credential: string) => {
      await screenLoginPage.goto(ctx.orgSlug, ctx.screenSlug);
      await screenLoginPage.signInWithCredential(credential);
    };
    await use(fn);
  },
});

export { expect } from "@playwright/test";
