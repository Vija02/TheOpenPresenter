import { findChildren } from "@tiptap/core";
import { Node as ProsemirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

function getDecorations({ doc, name }: { doc: ProsemirrorNode; name: string }) {
  const decorations: Decoration[] = [];

  findChildren(doc, (node) => node.type.name === name).forEach((block) => {
    if (block.node.textContent.startsWith(".")) {
      const decoration = Decoration.inline(
        block.pos,
        block.pos + block.node.textContent.length + 1,
        {
          class: "chord",
        },
      );
      decorations.push(decoration);
    } else if (block.node.textContent === "-") {
      const decoration = Decoration.inline(
        block.pos,
        block.pos + block.node.textContent.length + 1,
        {
          class: "lineBreak",
        },
      );
      decorations.push(decoration);
    } else if (
      block.node.textContent.startsWith("[") &&
      block.node.textContent.endsWith("]")
    ) {
      const decoration = Decoration.inline(
        block.pos,
        block.pos + block.node.textContent.length + 1,
        {
          class: "heading",
        },
      );
      decorations.push(decoration);
    }
  });

  return DecorationSet.create(doc, decorations);
}

export function CustomDecorationPlugin({ name }: { name: string }) {
  const customDecorationPlugin: Plugin<any> = new Plugin({
    key: new PluginKey("customDecoration"),

    state: {
      init: (_, { doc }) =>
        getDecorations({
          doc,
          name,
        }),
      apply: (transaction, decorationSet, oldState, newState) => {
        const oldNodeName = oldState.selection.$head.parent.type.name;
        const newNodeName = newState.selection.$head.parent.type.name;
        const oldNodes = findChildren(
          oldState.doc,
          (node) => node.type.name === name,
        );
        const newNodes = findChildren(
          newState.doc,
          (node) => node.type.name === name,
        );

        if (
          transaction.docChanged &&
          // Apply decorations if:
          // selection includes named node,
          ([oldNodeName, newNodeName].includes(name) ||
            // OR transaction adds/removes named node,
            newNodes.length !== oldNodes.length ||
            // OR transaction has changes that completely encapsulte a node
            // (for example, a transaction that affects the entire document).
            // Such transactions can happen during collab syncing via y-prosemirror, for example.
            transaction.steps.some((step) => {
              // @ts-ignore
              return (
                // @ts-ignore
                step.from !== undefined &&
                // @ts-ignore
                step.to !== undefined &&
                oldNodes.some((node) => {
                  // @ts-ignore
                  return (
                    // @ts-ignore
                    node.pos >= step.from &&
                    // @ts-ignore
                    node.pos + node.node.nodeSize <= step.to
                  );
                })
              );
            }))
        ) {
          return getDecorations({
            doc: transaction.doc,
            name,
          });
        }

        return decorationSet.map(transaction.mapping, transaction.doc);
      },
    },

    props: {
      decorations(state) {
        return customDecorationPlugin.getState(state);
      },
    },
  });

  return customDecorationPlugin;
}
