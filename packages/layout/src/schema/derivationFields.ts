import type { Derivation, DerivationField } from "@repo/base-types";

import { createDerivation } from "./derivation";

const clamp = (
  value: number,
  min?: number | null,
  max?: number | null,
): number => {
  let out = value;
  if (typeof min === "number") out = Math.max(min, out);
  if (typeof max === "number") out = Math.min(max, out);
  return out;
};

const clampToField = (value: number, field: DerivationField): number =>
  field.type === "number" ? clamp(value, field.min, field.max) : value;

export const readDerivationField = (
  derivation: Derivation | null | undefined,
  field: DerivationField,
): number | boolean | string => {
  const raw = derivation?.params?.[field.key];

  switch (field.type) {
    case "number": {
      const value = typeof raw === "number" ? raw : Number(raw);
      return Number.isFinite(value) && raw !== null && raw !== undefined
        ? clampToField(value, field)
        : field.default;
    }
    case "boolean":
      return typeof raw === "boolean" ? raw : field.default;
    case "select":
      return field.options.some((option) => option.value === raw)
        ? (raw as string)
        : field.default;
  }
};

export const writeDerivationField = (
  derivation: Derivation | null | undefined,
  field: DerivationField,
  value: number | boolean | string,
): Derivation => {
  const base = derivation ?? createDerivation();
  const params = { ...(base.params ?? {}) };

  let next = value;
  if (field.type === "number") {
    const asNumber = typeof value === "number" ? value : Number(value);
    // Mid-edit fields report empty/NaN; keeping the old value beats storing NaN.
    if (!Number.isFinite(asNumber)) return base;
    next = clampToField(asNumber, field);
  }

  // Storing a default is indistinguishable from storing nothing, and keeping
  // it would stop `isIdentityDerivation` recognising an undisturbed element.
  if (next === field.default) {
    delete params[field.key];
  } else {
    params[field.key] = next;
  }

  return {
    ...base,
    params: Object.keys(params).length > 0 ? params : null,
  };
};

export const isDefaultDerivation = (
  derivation: Derivation | null | undefined,
  fields: DerivationField[],
): boolean =>
  fields.every(
    (field) => readDerivationField(derivation, field) === field.default,
  );
