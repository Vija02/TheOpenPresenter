import {
  hostElementDisplayName,
  setHostDerivation,
  setHostSource,
} from "../../../doc/edit";
import { Derivation } from "../../../schema/derivation";
import { HostElement } from "../../../schema/element";
import {
  findDerivationOption,
  findSourceOption,
  useHostCatalog,
  useHostDerivationOptions,
} from "../../../react/context/hostCatalog";
import { Row, Section, SelectField } from "../primitives";
import { SectionProps } from "./types";

/**
 * What a host element points at, and how its data is derived.
 *
 * Both lists come from the application through the host catalog: the layout
 * package has no way to enumerate scenes or to know what a plugin can vary.
 */
export const HostSourceSection = ({
  doc,
  element,
  onChange,
}: SectionProps<HostElement>) => {
  const catalog = useHostCatalog();
  const derivationOptions = useHostDerivationOptions();

  const selectedSource = findSourceOption(catalog.sources, element.source);
  const selectedDerivation = findDerivationOption(
    derivationOptions,
    element.derivation,
  );

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

      {derivationOptions.length > 0 && (
        <Row label="Shows">
          <SelectField
            value={selectedDerivation?.id ?? ""}
            options={[
              ...(selectedDerivation ? [] : [{ value: "", label: "Custom" }]),
              ...derivationOptions.map((option) => ({
                value: option.id,
                label: option.label,
              })),
            ]}
            onChange={(id) => {
              const option = derivationOptions.find((o) => o.id === id);
              if (option) applyDerivation(option.derivation);
            }}
          />
        </Row>
      )}

      {catalog.renderElementExtras?.({ element, onChange: applyDerivation })}
    </Section>
  );
};
