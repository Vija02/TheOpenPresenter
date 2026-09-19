import type { DerivationField } from "@repo/base-types";

import type { Derivation } from "../../../schema/derivation";
import {
  readDerivationField,
  writeDerivationField,
} from "../../../schema/derivationFields";
import { CheckField, NumberField, Row, SelectField } from "../primitives";

/** Renders the controls for derivation */
export const DerivationFields = ({
  fields,
  derivation,
  onChange,
}: {
  fields: DerivationField[];
  derivation: Derivation | null;
  onChange: (derivation: Derivation) => void;
}) => (
  <>
    {fields.map((field) => {
      const value = readDerivationField(derivation, field);
      const apply = (next: number | boolean | string) =>
        onChange(writeDerivationField(derivation, field, next));

      if (field.type === "boolean") {
        return (
          <Row key={field.key} label="">
            <CheckField
              label={field.label}
              checked={value === true}
              onChange={apply}
            />
          </Row>
        );
      }

      return (
        <Row key={field.key} label={field.label}>
          {field.type === "number" ? (
            <NumberField
              value={typeof value === "number" ? value : field.default}
              min={field.min ?? undefined}
              max={field.max ?? undefined}
              step={field.step ?? 1}
              onChange={apply}
            />
          ) : (
            <SelectField
              value={typeof value === "string" ? value : field.default}
              options={field.options.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              onChange={apply}
            />
          )}
        </Row>
      );
    })}
  </>
);
