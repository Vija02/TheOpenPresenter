import postcss from "postcss";

/**
 * Scopes a stylesheet to a plugin's container so it can't restyle the host.
 */
export const scopeCss = async (css: string, scopeSelector: string) => {
  // Nested inside another rule, or a keyframe step (`50% { ... }`), which is a
  // Rule node but must never be prefixed.
  const skip = (rule: postcss.Rule) => {
    let parent: postcss.Container | postcss.Document | undefined = rule.parent;
    while (parent) {
      if (parent.type === "rule") return true;
      if (
        parent.type === "atrule" &&
        /keyframes$/.test((parent as postcss.AtRule).name)
      ) {
        return true;
      }
      parent = parent.parent;
    }
    return false;
  };

  const scopeSelectorList = (selector: string) =>
    selector
      .split(",")
      .map((part) => {
        const trimmed = part.trim();
        if (!trimmed) return trimmed;
        if (trimmed === ":root" || trimmed === ":host") return scopeSelector;
        return `${scopeSelector} ${trimmed}`;
      })
      .filter(Boolean)
      .join(", ");

  const plugin: postcss.Plugin = {
    postcssPlugin: "cplugin-scope",
    Rule(rule) {
      if (skip(rule)) return;
      rule.selector = scopeSelectorList(rule.selector);
    },
  };

  const result = await postcss([plugin]).process(css, { from: undefined });
  return result.css;
};
