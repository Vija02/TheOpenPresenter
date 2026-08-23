import type { ChatTool } from "@repo/base-types";
import z from "zod";

/**
 * AI editing for client plugin source. The "document" is the plugin's file map,
 * so the tools are file operations rather than layout element operations.
 */

export type PluginSourceDoc = { files: Record<string, string> };

const REQUIRED_FILES = ["remote.tsx", "renderer.tsx", "manifest.ts"];
const ALLOWED_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".css"];

const FILENAME = z
  .string()
  .min(1)
  .describe("File name, exactly as listed by list_files.");

type ToolResult = { doc: PluginSourceDoc; summary: string };

type SourceTool<S extends z.ZodType = z.ZodType> = {
  name: string;
  description: string;
  schema: S;
  readOnly?: boolean;
  run: (doc: PluginSourceDoc, args: z.infer<S>) => ToolResult;
};

const tool = <S extends z.ZodType>(definition: SourceTool<S>): SourceTool =>
  definition as unknown as SourceTool;

const assertWritableName = (name: string) => {
  if (name.includes("/") || name.includes("\\")) {
    throw new Error("Folders are not supported; use a flat file name.");
  }
  if (!ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    throw new Error(`Files must end with ${ALLOWED_EXTENSIONS.join(", ")}.`);
  }
};

const requireFile = (doc: PluginSourceDoc, name: string) => {
  const body = doc.files[name];
  if (body === undefined) {
    const available = Object.keys(doc.files).join(", ");
    throw new Error(`No file "${name}". Available files: ${available}`);
  }
  return body;
};

const TOOL_LIST = [
  tool({
    name: "list_files",
    description:
      "List every file in the plugin with its size in characters. Call this first.",
    schema: z.strictObject({}),
    readOnly: true,
    run: (doc) => ({
      doc,
      summary: JSON.stringify(
        Object.entries(doc.files).map(([name, body]) => ({
          name,
          chars: body.length,
          required: REQUIRED_FILES.includes(name),
        })),
      ),
    }),
  }),

  tool({
    name: "read_file",
    description: "Read one file's full contents.",
    schema: z.strictObject({ name: FILENAME }),
    readOnly: true,
    run: (doc, { name }) => ({
      doc,
      summary: requireFile(doc, name),
    }),
  }),

  tool({
    name: "write_file",
    description:
      "Replace a file's entire contents, creating it if needed. Send the complete file, never a fragment or a diff.",
    schema: z.strictObject({
      name: FILENAME,
      content: z.string().describe("The complete new file contents."),
    }),
    run: (doc, { name, content }) => {
      assertWritableName(name);
      const existed = doc.files[name] !== undefined;
      return {
        doc: { files: { ...doc.files, [name]: content } },
        summary: `${existed ? "Updated" : "Created"} ${name} (${content.length} chars).`,
      };
    },
  }),

  tool({
    name: "replace_in_file",
    description:
      "Replace an exact substring in a file. Prefer this over write_file for small edits. The search string must appear exactly once.",
    schema: z.strictObject({
      name: FILENAME,
      search: z.string().min(1).describe("Exact text to find."),
      replace: z.string().describe("Replacement text."),
    }),
    run: (doc, { name, search, replace }) => {
      const body = requireFile(doc, name);
      const first = body.indexOf(search);
      if (first === -1) {
        throw new Error(
          `That exact text is not in ${name}. Read the file again and match it precisely, including whitespace.`,
        );
      }
      if (body.indexOf(search, first + search.length) !== -1) {
        throw new Error(
          `That text appears more than once in ${name}. Include more surrounding context to make it unique.`,
        );
      }
      const next =
        body.slice(0, first) + replace + body.slice(first + search.length);
      return {
        doc: { files: { ...doc.files, [name]: next } },
        summary: `Edited ${name}.`,
      };
    },
  }),

  tool({
    name: "delete_file",
    description: "Delete a file. Required plugin files cannot be deleted.",
    schema: z.strictObject({ name: FILENAME }),
    run: (doc, { name }) => {
      requireFile(doc, name);
      if (REQUIRED_FILES.includes(name)) {
        throw new Error(`${name} is required and cannot be deleted.`);
      }
      const files = { ...doc.files };
      delete files[name];
      return { doc: { files }, summary: `Deleted ${name}.` };
    },
  }),
];

const BY_NAME = new Map(TOOL_LIST.map((t) => [t.name, t]));

export const applyPluginSourceTool = (
  doc: PluginSourceDoc,
  name: string,
  rawArgs: unknown,
): ToolResult => {
  const definition = BY_NAME.get(name);
  if (!definition) {
    throw new Error(
      `Unknown tool "${name}". Available: ${[...BY_NAME.keys()].join(", ")}`,
    );
  }
  const parsed = definition.schema.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    throw new Error(`Invalid arguments: ${parsed.error.message}`);
  }
  return definition.run(doc, parsed.data);
};

export const isReadOnlyPluginSourceTool = (name: string): boolean =>
  BY_NAME.get(name)?.readOnly === true;

export const PLUGIN_SOURCE_TOOLS: ChatTool[] = TOOL_LIST.map((t) => {
  const parameters = z.toJSONSchema(t.schema, {
    target: "draft-7",
    io: "input",
    unrepresentable: "any",
  }) as Record<string, unknown>;
  delete parameters.$schema;
  return {
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters,
    },
  };
});
