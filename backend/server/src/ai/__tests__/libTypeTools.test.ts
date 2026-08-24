// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  PLUGIN_SOURCE_TOOLS,
  applyPluginSourceTool,
} from "../pluginSourceTools";

const doc = { files: { "remote.tsx": "export default () => null;" } };
const run = (name: string, args: unknown = {}) =>
  applyPluginSourceTool(doc, name, args).summary;

describe("lib type tools", () => {
  it("exposes the tools to the model", () => {
    const names = PLUGIN_SOURCE_TOOLS.map((t) => t.function.name);
    expect(names).toContain("list_lib_modules");
    expect(names).toContain("find_lib_symbol");
    expect(names).toContain("read_lib_types");
  });

  it("lists the importable modules from the bundler's own allow-list", () => {
    const listed = JSON.parse(run("list_lib_modules")) as string[];
    expect(listed).toContain("@repo/ui");
    expect(listed).toContain("@repo/layout/editor");
    expect(listed).not.toContain("fs");
  });

  it("returns the real Button variant union", () => {
    const out = run("find_lib_symbol", {
      symbol: "Button",
      module: "@repo/ui",
    });
    // The actual variants from packages/ui/src/components/ui/button.tsx.
    for (const variant of ["pill", "destructive", "ghost", "outline"]) {
      expect(out).toContain(variant);
    }
    // The declaration itself, not the barrel that merely re-exports its path.
    expect(out).toContain("declare function Button");
    expect(out).not.toContain("export * from './components/ui/accordion'");
  });

  it("finds PluginScaffold's real props", () => {
    const out = run("find_lib_symbol", { symbol: "PluginScaffold" });
    expect(out).toContain("toolbar");
    expect(out).toContain("postToolbar");
  });

  it("refuses a module a plugin cannot import", () => {
    expect(() => run("read_lib_types", { module: "fs" })).toThrow(
      /not importable/,
    );
  });

  it("reads a module's declarations following its barrels", () => {
    const out = run("read_lib_types", { module: "@repo/layout/react" });
    expect(out).toContain("LayoutRenderer");
  });
});
