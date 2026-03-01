import Document from "@tiptap/extension-document";
import History from "@tiptap/extension-history";
import Paragraph from "@tiptap/extension-paragraph";
import TextExtension from "@tiptap/extension-text";
import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect } from "react";

import { CustomDecorationPlugin } from "./customDecorationPlugin";

const SongEditEditor = ({
  initialContent,
  onChange,
}: {
  initialContent: string;
  onChange: (text: string) => void;
}) => {
  const editor = useEditor({
    onUpdate: (e) => {
      onChange(e.editor.getText({ blockSeparator: "\n" }));
    },
    extensions: [
      Document,
      Paragraph.extend({
        priority: 8000,
        group: "block",
        inline: false,
        addProseMirrorPlugins() {
          return [
            ...(this.parent?.() || []),
            CustomDecorationPlugin({
              name: this.name,
            }),
          ];
        },
      }),
      TextExtension,
      History,
    ],
  });

  useEffect(() => {
    if (editor && initialContent !== editor.getHTML()) {
      editor?.commands.setContent(initialContent);
    }
  }, [editor, initialContent]);

  return (
    <div
      className="rounded-sm border border-stroke px-3 py-2 w-full"
      data-testid="ly-song-editor"
    >
      <EditorContent editor={editor} />
    </div>
  );
};

export default SongEditEditor;
