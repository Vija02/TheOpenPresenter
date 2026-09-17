/**
 * How a mirrored piece of content differs from the live one. A confidence
 * monitor shows the next slide by rendering the same scene with `offset: 1`.
 *
 * Lives here because both @repo/base-plugin and @repo/layout need it, and
 * neither may depend on the other.
 */
export type Derivation = {
  offset: number;
  params: Record<string, unknown> | null;
};
