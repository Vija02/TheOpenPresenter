/** The shape of the value a binding resolves to, which is what the editor keys off. */
export const bindingTypes = ["text", "richText", "image"] as const;
export type BindingType = (typeof bindingTypes)[number];

export type DataBinding = {
  /** Key within the feed's data. Addressed as `{{<feed>.<key>}}`. */
  key: string;
  label: string;
  type: BindingType;
};
