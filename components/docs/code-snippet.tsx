import { type Jsx, toJsxRuntime } from "hast-util-to-jsx-runtime";
import * as runtime from "react/jsx-runtime";
import { highlightCode } from "@/lib/highlight-code";
import { CodeFrame } from "./code-frame";

type CodeSnippetProps = {
  code: string;
  title?: string;
  language?: string;
  showLineNumbers?: boolean;
  className?: string;
};

export async function CodeSnippet({
  code,
  title,
  language = "tsx",
  showLineNumbers = false,
  className,
}: CodeSnippetProps) {
  "use cache";

  const hast = await highlightCode(code, language);
  const highlightedCode = toJsxRuntime(hast, {
    Fragment: runtime.Fragment,
    jsx: runtime.jsx as Jsx,
    jsxs: runtime.jsxs as Jsx,
  });

  return (
    <CodeFrame
      value={code}
      title={title}
      language={language}
      showLineNumbers={showLineNumbers}
      className={className}
    >
      <div className="docs-highlighted-source overflow-x-auto overscroll-x-contain px-4 py-3 font-mono text-xs leading-5">
        {highlightedCode}
      </div>
    </CodeFrame>
  );
}
