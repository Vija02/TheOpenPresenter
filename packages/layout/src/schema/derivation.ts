import type { Derivation } from "@repo/base-types";
import { z } from "zod";

export const derivationValidator = z.object({
  /** Plugin-specific, declared and read by the plugin that owns the scene. */
  params: z.record(z.string(), z.unknown()).nullable(),
});

export type { Derivation };

export const createDerivation = ({
  params = null,
}: Partial<Derivation> = {}): Derivation => ({ params });

/** A derivation that changes nothing is the same as having none at all. */
export const isIdentityDerivation = (
  derivation: Derivation | null | undefined,
): boolean =>
  !derivation ||
  derivation.params === null ||
  Object.keys(derivation.params).length === 0;
