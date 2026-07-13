import { readFile } from "node:fs/promises";
import path from "node:path";
import { Suspense } from "react";
import { CodeCollapsible } from "./code-collapsible";
import { CodeSnippet } from "./code-snippet";

const languageByExtension: Record<string, string> = {
  ".js": "javascript",
  ".jsx": "jsx",
  ".ts": "typescript",
  ".tsx": "tsx",
  ".css": "css",
  ".json": "json",
};

async function readWorkspaceFile(relativePath: string) {
  if (!relativePath.startsWith("components/")) {
    throw new Error(
      "Component source must be inside the components directory.",
    );
  }
  const componentsRoot = path.join(process.cwd(), "components");
  const absolutePath = path.join(
    componentsRoot,
    relativePath.slice("components/".length),
  );
  return readFile(absolutePath, "utf8");
}

type ComponentSourceProps = {
  path: string;
  title?: string;
  collapsible?: boolean;
};

export function ComponentSource(props: ComponentSourceProps) {
  return (
    <Suspense
      fallback={
        <div className="my-4 h-40 animate-pulse border-y border-border bg-muted/20" />
      }
    >
      <ComponentSourceContent {...props} />
    </Suspense>
  );
}

async function ComponentSourceContent({
  path: sourcePath,
  title = sourcePath,
  collapsible = true,
}: ComponentSourceProps) {
  const source = await readWorkspaceFile(sourcePath);
  const language = languageByExtension[path.extname(sourcePath)] ?? "text";
  const frame = (
    <CodeSnippet
      code={source}
      title={title}
      language={language}
      showLineNumbers
    />
  );
  return collapsible ? <CodeCollapsible>{frame}</CodeCollapsible> : frame;
}
