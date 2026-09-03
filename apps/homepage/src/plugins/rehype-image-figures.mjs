/**
 * Markdown has no figure syntax, so posts write an image followed by an italic
 * line as its caption. This turns that pair into the same <figure> +
 * <figcaption> markup a video uses, so both caption styles come from one place
 * in Prose.astro. A lone image becomes a <figure> with no caption.
 *
 *   ![alt](shot.png)
 *
 *   *The caption.*
 */

const isWhitespace = (node) =>
  node.type === "text" && node.value.trim() === "";

/** The single element inside a paragraph, if that is all the paragraph holds. */
function soleElement(node, tagName) {
  if (node?.type !== "element" || node.tagName !== "p") return null;
  const children = node.children.filter((child) => !isWhitespace(child));
  if (children.length !== 1) return null;
  const [child] = children;
  if (child.type !== "element" || child.tagName !== tagName) return null;
  return child;
}

export default function rehypeImageFigures() {
  return (tree) => {
    const children = [];

    for (let i = 0; i < tree.children.length; i++) {
      const node = tree.children[i];
      const image = soleElement(node, "img");

      if (!image) {
        children.push(node);
        continue;
      }

      const figure = {
        type: "element",
        tagName: "figure",
        properties: {},
        children: [image],
      };

      let next = i + 1;
      while (isWhitespace(tree.children[next])) next++;
      const caption = soleElement(tree.children[next], "em");

      if (caption) {
        figure.children.push({
          type: "element",
          tagName: "figcaption",
          properties: {},
          children: caption.children,
        });
        i = next;
      }

      children.push(figure);
    }

    tree.children = children;
  };
}
