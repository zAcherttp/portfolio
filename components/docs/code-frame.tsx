import { Braces, Code2, FileJson, Hash, Terminal } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CodeCopyButton } from "./code-copy-button";

function CodeLanguageIcon({ language }: { language?: string }) {
  const iconClassName = "size-3.5 shrink-0";
  if (["bash", "shell", "sh", "powershell"].includes(language ?? "")) {
    return <Terminal aria-hidden="true" className={iconClassName} />;
  }
  if (language === "json") {
    return <FileJson aria-hidden="true" className={iconClassName} />;
  }
  if (["css", "scss"].includes(language ?? "")) {
    return <Hash aria-hidden="true" className={iconClassName} />;
  }
  if (
    ["js", "jsx", "ts", "tsx", "javascript", "typescript"].includes(
      language ?? "",
    )
  ) {
    return <Braces aria-hidden="true" className={iconClassName} />;
  }
  return <Code2 aria-hidden="true" className={iconClassName} />;
}

function CodeTitle({
  title,
  language,
}: {
  title: ReactNode;
  language?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 border-b border-border px-4 py-2 font-mono text-[10px] text-muted-foreground">
      <CodeLanguageIcon language={language} />
      <span className="truncate">{title}</span>
    </div>
  );
}

export function CodeFrame({
  value,
  title,
  language,
  showLineNumbers = false,
  className,
  children,
}: {
  value?: string;
  title?: string;
  language?: string;
  showLineNumbers?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      data-code-frame
      data-line-numbers={showLineNumbers || undefined}
      className={cn(
        "group/code relative my-4 overflow-hidden border-y border-border bg-[var(--code-background)]",
        className,
      )}
    >
      {title && <CodeTitle title={title} language={language} />}
      {children}
      <CodeCopyButton value={value} />
    </div>
  );
}

export function MdxPre(props: ComponentProps<"pre">) {
  return (
    <CodeFrame className="my-0 border-t-0">
      <pre
        className="overflow-x-auto overscroll-x-contain px-4 py-3 font-mono text-xs leading-5"
        {...props}
      />
    </CodeFrame>
  );
}

export function MdxFigure(props: ComponentProps<"figure">) {
  return <figure {...props} className={cn("my-4", props.className)} />;
}

export function MdxFigcaption({
  children,
  ...props
}: ComponentProps<"figcaption"> & { "data-language"?: string }) {
  return (
    <figcaption
      {...props}
      className={cn("border-x border-t border-border", props.className)}
    >
      <CodeTitle title={children} language={props["data-language"]} />
    </figcaption>
  );
}
