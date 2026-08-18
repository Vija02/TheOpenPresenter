import * as z4 from "zod";

export const toParameters = (schema: z4.ZodType): Record<string, unknown> => {
  const json = z4.toJSONSchema(schema, {
    target: "draft-7",
    io: "input",
    unrepresentable: "any",
  }) as Record<string, unknown>;
  delete json.$schema;
  return json;
};

/**
 * `strict: true` is only valid when every property is required. With optional
 * fields present, providers reject a strict schema.
 */
export const isStrictParameters = (
  parameters: Record<string, unknown>,
): boolean => {
  const properties = (parameters.properties ?? {}) as Record<string, unknown>;
  const required = (parameters.required ?? []) as string[];
  return required.length === Object.keys(properties).length;
};

/** Turns a zod failure into something a model can act on. */
export const explainZodError = (error: z4.ZodError): string =>
  error.issues
    .slice(0, 6)
    .map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
