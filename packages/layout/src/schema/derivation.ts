import type { Derivation } from "@repo/base-types";
import { z } from "zod";

export const derivationValidator = z.object({
  offset: z.number(),
  /** Plugin-specific, read by the plugin that owns the scene. */
  params: z.record(z.string(), z.unknown()).nullable(),
});

export type { Derivation };

export const createDerivation = ({
  offset = 0,
  params = null,
}: Partial<Derivation> = {}): Derivation => ({ offset, params });

/** A derivation that changes nothing is the same as having none at all. */
export const isIdentityDerivation = (
  derivation: Derivation | null | undefined,
): boolean =>
  !derivation ||
  (derivation.offset === 0 &&
    (derivation.params === null ||
      Object.keys(derivation.params).length === 0));
