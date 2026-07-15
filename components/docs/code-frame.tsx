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
    <div className="flex min-w-0 items-center gap-2 border-b border-border/70 px-4 py-2.5 font-mono text-xs text-muted-foreground">
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
        "group/code my-5 overflow-hidden rounded-xl bg-muted/55",
        className,
      )}
    >
      {title && <CodeTitle title={title} language={language} />}
      <div className="relative">
        {children}
        <CodeCopyButton value={value} />
      </div>
    </div>
  );
}

export function MdxPre(props: ComponentProps<"pre">) {
  return (
    <CodeFrame className="my-0 rounded-t-none">
      <pre
        className="overflow-x-auto overscroll-x-contain px-4 py-4 font-mono text-xs leading-5"
        {...props}
      />
    </CodeFrame>
  );
}

export function MdxFigure(props: ComponentProps<"figure">) {
  return <figure {...props} className={cn("my-5", props.className)} />;
}

export function MdxFigcaption({
  children,
  ...props
}: ComponentProps<"figcaption"> & { "data-language"?: string }) {
  return (
    <figcaption
      {...props}
      className={cn(
        "overflow-hidden rounded-t-xl bg-muted/55",
        props.className,
      )}
    >
      <CodeTitle title={children} language={props["data-language"]} />
    </figcaption>
  );
}
