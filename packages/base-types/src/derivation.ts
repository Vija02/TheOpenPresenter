/**
 * How a mirrored piece of content differs from the live one.
 *
 * Every key is declared by a plugin through `DerivationField` and read back by
 * that same plugin. Nothing here has a fixed meaning.
 *
 * Lives here because both @repo/base-plugin and @repo/layout need it, and
 * neither may depend on the other.
 */
export type Derivation = {
  params: Record<string, unknown> | null;
};

/**
 * What a plugin lets the user vary about a derived view of itself.
 *
 * Declarative data, not code: fields cross a GraphQL boundary to reach the
 * editor, and the plugin's renderer is the only thing that interprets the
 * resulting values.
 */
export type DerivationFieldBase = {
  /** Key within `Derivation.params`. */
  key: string;
  label: string;
  /** Shown under the control. */
  help?: string | null;
};

export type DerivationNumberField = DerivationFieldBase & {
  type: "number";
  default: number;
  /** Values outside the range are clamped, never rejected. */
  min?: number | null;
  max?: number | null;
  step?: number | null;
};

export type DerivationBooleanField = DerivationFieldBase & {
  type: "boolean";
  default: boolean;
};

export type DerivationSelectField = DerivationFieldBase & {
  type: "select";
  default: string;
  options: { value: string; label: string }[];
};

export type DerivationField =
  | DerivationNumberField
  | DerivationBooleanField
  | DerivationSelectField;
