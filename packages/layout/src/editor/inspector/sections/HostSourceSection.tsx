import {
  hostElementDisplayName,
  setHostDerivation,
  setHostSource,
} from "../../../doc/edit";
import {
  findSourceOption,
  useHostCatalog,
  useHostDerivationFields,
} from "../../../react/context/hostCatalog";
import { Derivation } from "../../../schema/derivation";
import { HostElement } from "../../../schema/element";
import { Row, Section, SelectField } from "../primitives";
import { DerivationFields } from "./DerivationFields";
import { SectionProps } from "./types";

/** What a host element points at, and how its data is derived */
export const HostSourceSection = ({
  doc,
  element,
  onChange,
}: SectionProps<HostElement>) => {
  const catalog = useHostCatalog();
  const derivationFields = useHostDerivationFields(element.source);

  const selectedSource = findSourceOption(catalog.sources, element.source);

  const applyDerivation = (derivation: Derivation | null) =>
    onChange(setHostDerivation(doc, element.id, derivation));

  return (
    <Section title="Live content">
      {catalog.sources.length > 0 && (
        <Row label="Source">
          <SelectField
            value={selectedSource?.id ?? ""}
            options={[
              // A source the catalog no longer offers (a deleted scene) still
              // has to be shown, or the select would silently repoint it.
              ...(selectedSource
                ? []
                : [
                    {
                      value: "",
                      label: hostElementDisplayName(element),
                    },
                  ]),
              ...catalog.sources.map((option) => ({
                value: option.id,
                label: option.group
                  ? `${option.group} — ${option.label}`
                  : option.label,
              })),
            ]}
            onChange={(id) => {
              const option = catalog.sources.find((o) => o.id === id);
              if (option)
                onChange(setHostSource(doc, element.id, option.source));
            }}
          />
        </Row>
      )}

      {derivationFields.length > 0 && (
        <DerivationFields
          fields={derivationFields}
          derivation={element.derivation}
          onChange={applyDerivation}
        />
      )}

      {catalog.renderElementExtras?.({ element, onChange: applyDerivation })}
    </Section>
  );
};
