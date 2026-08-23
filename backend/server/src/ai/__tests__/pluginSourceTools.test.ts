import { describe, expect, it } from "vitest";

import {
  PLUGIN_SOURCE_TOOLS,
  applyPluginSourceTool,
  isReadOnlyPluginSourceTool,
} from "../pluginSourceTools";

const doc = () => ({
  files: {
    "remote.tsx": "export default function Remote() { return null; }\n",
    "renderer.tsx": "export default function Renderer() { return null; }\n",
    "manifest.ts":
      "export const manifest = { pluginData: {}, rendererData: {} };\n",
    "doc.ts": "export const a = 1;\nexport const b = 2;\n",
  },
});

describe("plugin source tools", () => {
  it("exposes every tool with a JSON-schema parameter object", () => {
    const names = PLUGIN_SOURCE_TOOLS.map((t) => t.function.name).sort();
    expect(names).toEqual([
      "delete_file",
      "list_files",
      "read_file",
      "replace_in_file",
      "write_file",
    ]);
    for (const t of PLUGIN_SOURCE_TOOLS) {
      expect(t.type).toBe("function");
      expect(t.function.parameters).toMatchObject({ type: "object" });
      expect(t.function.parameters).not.toHaveProperty("$schema");
    }
  });

  it("marks only the read tools read-only", () => {
    expect(isReadOnlyPluginSourceTool("list_files")).toBe(true);
    expect(isReadOnlyPluginSourceTool("read_file")).toBe(true);
    expect(isReadOnlyPluginSourceTool("write_file")).toBe(false);
    expect(isReadOnlyPluginSourceTool("replace_in_file")).toBe(false);
  });

  it("lists files without mutating the doc", () => {
    const before = doc();
    const { doc: after, summary } = applyPluginSourceTool(
      before,
      "list_files",
      {},
    );
    expect(after).toBe(before);
    const listed = JSON.parse(summary);
    expect(listed).toHaveLength(4);
    expect(listed.find((f: any) => f.name === "remote.tsx").required).toBe(
      true,
    );
    expect(listed.find((f: any) => f.name === "doc.ts").required).toBe(false);
  });

  it("reads a file and rejects an unknown one", () => {
    expect(
      applyPluginSourceTool(doc(), "read_file", { name: "doc.ts" }).summary,
    ).toContain("export const a = 1;");
    expect(() =>
      applyPluginSourceTool(doc(), "read_file", { name: "nope.ts" }),
    ).toThrow(/No file "nope.ts"/);
  });

  it("writes a new file and updates an existing one", () => {
    const created = applyPluginSourceTool(doc(), "write_file", {
      name: "extra.ts",
      content: "export const x = 1;",
    });
    expect(created.doc.files["extra.ts"]).toBe("export const x = 1;");
    expect(created.summary).toMatch(/^Created extra\.ts/);

    const updated = applyPluginSourceTool(doc(), "write_file", {
      name: "doc.ts",
      content: "changed",
    });
    expect(updated.summary).toMatch(/^Updated doc\.ts/);
    // Original object is untouched: edits are applied immutably.
    expect(doc().files["doc.ts"]).toContain("export const a = 1;");
  });

  it("refuses folders and unsupported extensions", () => {
    expect(() =>
      applyPluginSourceTool(doc(), "write_file", {
        name: "src/thing.ts",
        content: "x",
      }),
    ).toThrow(/Folders are not supported/);
    expect(() =>
      applyPluginSourceTool(doc(), "write_file", {
        name: "notes.md",
        content: "x",
      }),
    ).toThrow(/must end with/i);
  });

  it("replaces a unique substring", () => {
    const { doc: after, summary } = applyPluginSourceTool(
      doc(),
      "replace_in_file",
      {
        name: "doc.ts",
        search: "export const b = 2;",
        replace: "export const b = 3;",
      },
    );
    expect(after.files["doc.ts"]).toBe(
      "export const a = 1;\nexport const b = 3;\n",
    );
    expect(summary).toBe("Edited doc.ts.");
  });

  it("refuses a replace that is missing or ambiguous", () => {
    expect(() =>
      applyPluginSourceTool(doc(), "replace_in_file", {
        name: "doc.ts",
        search: "not there",
        replace: "x",
      }),
    ).toThrow(/not in doc\.ts/);

    const repeated = {
      files: { "doc.ts": "const a = 1;\nconst a = 1;\n" },
    };
    expect(() =>
      applyPluginSourceTool(repeated, "replace_in_file", {
        name: "doc.ts",
        search: "const a = 1;",
        replace: "const a = 2;",
      }),
    ).toThrow(/more than once/);
  });

  it("deletes an optional file but protects the required ones", () => {
    const { doc: after } = applyPluginSourceTool(doc(), "delete_file", {
      name: "doc.ts",
    });
    expect(after.files).not.toHaveProperty("doc.ts");
    expect(after.files).toHaveProperty("remote.tsx");

    for (const name of ["remote.tsx", "renderer.tsx", "manifest.ts"]) {
      expect(() =>
        applyPluginSourceTool(doc(), "delete_file", { name }),
      ).toThrow(/required and cannot be deleted/);
    }
  });

  it("rejects an unknown tool and bad arguments", () => {
    expect(() => applyPluginSourceTool(doc(), "frobnicate", {})).toThrow(
      /Unknown tool "frobnicate"/,
    );
    expect(() =>
      applyPluginSourceTool(doc(), "read_file", { wrong: 1 }),
    ).toThrow(/Invalid arguments/);
  });
});
