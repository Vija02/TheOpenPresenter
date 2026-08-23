import Editor, { type Monaco, loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import { useCallback, useRef } from "react";

import { loadPluginTypeDefs } from "./pluginTypeDefs";

// Use the bundled Monaco so it works offline
(self as any).MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    if (label === "typescript" || label === "javascript") return new tsWorker();
    if (label === "css" || label === "scss" || label === "less")
      return new cssWorker();
    if (label === "json") return new jsonWorker();
    return new editorWorker();
  },
};
loader.config({ monaco });

const languageForFile = (filename: string) => {
  if (filename.endsWith(".tsx")) return "typescript";
  if (filename.endsWith(".ts")) return "typescript";
  if (filename.endsWith(".css")) return "css";
  if (filename.endsWith(".json")) return "json";
  return "typescript";
};

const AMBIENT_DTS = `
declare module "*.css";
declare module "https://esm.sh/*" {
  const mod: any;
  export = mod;
}
`;

export const CodeEditor = ({
  filename,
  value,
  onChange,
  height = 360,
}: {
  filename: string;
  value: string;
  onChange: (value: string) => void;
  height?: number | string;
}) => {
  const monacoRef = useRef<Monaco | null>(null);

  const handleBeforeMount = useCallback((monaco: Monaco) => {
    monacoRef.current = monaco;
    const ts = monaco.languages.typescript.typescriptDefaults;
    ts.setCompilerOptions({
      jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
      esModuleInterop: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      allowNonTsExtensions: true,
      noEmit: true,
      skipLibCheck: true,
    });
    // 2307 (cannot find module) ignored: plugins may import from
    // https://esm.sh/... which Monaco can't resolve.
    ts.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      diagnosticCodesToIgnore: [2307, 7016],
    });
    ts.addExtraLib(AMBIENT_DTS, "file:///cplugin-ambient.d.ts");

    loadPluginTypeDefs()
      .then((libs) => {
        for (const lib of libs) ts.addExtraLib(lib.content, lib.filePath);
      })
      .catch(() => {
        // Autocomplete is a convenience, a failure here must not break editing
      });
  }, []);

  const fills = typeof height === "string";

  return (
    <div className={fills ? "h-full" : "border rounded overflow-hidden"}>
      <Editor
        height={height}
        theme="vs-dark"
        path={`file:///${filename}`}
        language={languageForFile(filename)}
        value={value}
        onChange={(v) => onChange(v ?? "")}
        beforeMount={handleBeforeMount}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
        }}
      />
    </div>
  );
};
