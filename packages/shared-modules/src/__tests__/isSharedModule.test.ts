import { describe, expect, it } from "vitest";

import {
  ALL_SHARED_SPECIFIERS,
  isSharedModule,
  SHARED_MODULES,
  sharedExternals,
} from "../index";

describe("isSharedModule", () => {
  describe("shares modules that must be single-instance", () => {
    it.each([
      ["react", "@repo/ui"],
      ["react-dom", "@repo/ui"],
      ["react-dom/client", "@repo/ui"],
      ["yjs", "@repo/ui"],
      ["react-hook-form", "@repo/ui"],
      ["urql", "@repo/ui"],
      ["zustand", "@repo/lib"],
      ["@repo/lib", "@repo/ui"],
      ["react-player", "@repo/video"],
    ])("%s (building %s)", (id, self) => {
      expect(isSharedModule(id, self)).toBe(true);
    });

    it("shares package subpaths, which import maps do not cover implicitly", () => {
      expect(isSharedModule("zustand/middleware", "@repo/lib")).toBe(true);
      expect(ALL_SHARED_SPECIFIERS).toContain("zustand/middleware");
    });

    it("shares a subpath even while building its parent package", () => {
      expect(isSharedModule("@repo/base-plugin/client", "@repo/base-plugin")).toBe(
        true,
      );
    });
  });

  describe("never shares", () => {
    it("@repo/base-plugin/server, which pulls in express and pg", () => {
      expect(isSharedModule("@repo/base-plugin/server", "@repo/base-plugin")).toBe(
        false,
      );
      expect(sharedExternals("@repo/base-plugin/server")).toBe(false);
    });

    it("stylesheets, which are not JS modules", () => {
      expect(isSharedModule("@repo/ui/css", "@repo/lib")).toBe(false);
      expect(isSharedModule("@repo/base-plugin/client/css", "@repo/base-plugin")).toBe(
        false,
      );
      expect(isSharedModule("./styles.css", "@repo/ui")).toBe(false);
    });

    it("a module by itself, which would emit a self-import", () => {
      expect(isSharedModule("@repo/ui", "@repo/ui")).toBe(false);
      expect(isSharedModule("zod", "zod")).toBe(false);
    });

    it("modules that are not shared at all", () => {
      expect(isSharedModule("clsx", "@repo/ui")).toBe(false);
      expect(isSharedModule("date-fns", "@repo/ui")).toBe(false);
      expect(isSharedModule("lucide-react", "@repo/ui")).toBe(false);
    });
  });

  it("treats every declared module as external when no self is given", () => {
    for (const mod of SHARED_MODULES) {
      expect(sharedExternals(mod.specifier)).toBe(true);
    }
  });

  it("documents a reason for every shared module", () => {
    for (const mod of SHARED_MODULES) {
      expect(mod.reason.length).toBeGreaterThan(0);
    }
  });
});

describe("a shared package's own internals", () => {
  it("stays bundled, so the output is not an empty shell", () => {
    expect(isSharedModule("zustand/vanilla", "zustand")).toBe(false);
    expect(isSharedModule("zustand/react", "zustand")).toBe(false);
  });

  it("except for subpaths that are themselves declared shared", () => {
    expect(isSharedModule("zustand/middleware", "zustand")).toBe(true);
    expect(isSharedModule("@repo/base-plugin/client", "@repo/base-plugin")).toBe(
      true,
    );
  });
});

describe("the JSX runtime", () => {
  // Regression: leaving these bundled caused "Invalid hook call" in dev.
  it("is shared, so it cannot drag in a second React", () => {
    expect(sharedExternals("react/jsx-runtime")).toBe(true);
    expect(sharedExternals("react/jsx-dev-runtime")).toBe(true);
    expect(ALL_SHARED_SPECIFIERS).toContain("react/jsx-runtime");
    expect(ALL_SHARED_SPECIFIERS).toContain("react/jsx-dev-runtime");
  });

  it("keeps react external while being built, so it reuses the shared one", () => {
    expect(isSharedModule("react", "react/jsx-runtime")).toBe(true);
    expect(isSharedModule("react/jsx-runtime", "react/jsx-runtime")).toBe(false);
  });
});

describe("deep internals of a shared package", () => {
  it("stay bundled rather than becoming a second instance", () => {
    expect(sharedExternals("zod/v4/core")).toBe(false);
    expect(sharedExternals("zod/v4/locales")).toBe(false);
    expect(sharedExternals("urql/dist/urql.mjs")).toBe(false);
  });

  it("but declared subpath entries are still shared", () => {
    for (const spec of ALL_SHARED_SPECIFIERS) {
      expect(sharedExternals(spec)).toBe(true);
    }
  });

  it("shares @repo/video/client, which plugin views import directly", () => {
    expect(sharedExternals("@repo/video/client")).toBe(true);
    expect(ALL_SHARED_SPECIFIERS).toContain("@repo/video/client");
  });
});

describe("unrelated packages are never touched", () => {
  it("leaves a package that merely resembles a shared name alone", () => {
    // Regression: a prefix match once made bible-passage-reference-parser
    // subpaths look external.
    expect(
      sharedExternals("bible-passage-reference-parser/esm/lang/en.js"),
    ).toBe(false);
    expect(sharedExternals("@hookform/resolvers/zod")).toBe(false);
    expect(sharedExternals("react-icons/fa")).toBe(false);
  });
});
