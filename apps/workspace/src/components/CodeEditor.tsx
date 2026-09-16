import Editor from "@monaco-editor/react";
import { useState } from "react";

interface CodeEditorProps {
  initialCode: string;
  onSubmit: (code: string) => Promise<void>;
}

export function CodeEditor({
  initialCode,
  onSubmit,
}: CodeEditorProps) {
  const [code, setCode] =
    useState(initialCode);

  const [sending, setSending] =
    useState(false);

  const handleSubmit = async () => {
    setSending(true);

    try {
      await onSubmit(code);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
        <span className="text-xs text-slate-400">
          index.html
        </span>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={sending}
          className="px-3 py-1.5 text-xs rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
        >
          {sending
            ? "إرسال..."
            : "إرسال للوكيل"}
        </button>
      </div>

      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          defaultLanguage="html"
          theme="vs-dark"
          value={code}
          onChange={(value) =>
            setCode(value ?? "")
          }
          options={{
            minimap: {
              enabled: false,
            },
            fontSize: 13,
            wordWrap: "on",
            automaticLayout: true,
            scrollBeyondLastLine: false,
          }}
        />
      </div>
    </div>
  );
}
