import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { type ReactNode, Suspense } from "react";
import SectionDivider from "@/components/SectionDivider";
import type { RegistryEntry } from "@/data/components";
import { CodeSnippet } from "./code-snippet";
import { DocsTabs } from "./component-docs-tabs";
import { ComponentSource } from "./component-source";
import { PackageCommand } from "./package-command";

export function ComponentDocsShell({
  entry,
  preview,
  children,
}: {
  entry: RegistryEntry;
  preview: ReactNode;
  children: ReactNode;
}) {
  const source = entry.files.map((file) => (
    <ComponentSource key={file} path={file} />
  ));
  return (
    <main className="min-h-screen text-foreground">
      <article className="mx-auto max-w-3xl px-6 py-8 sm:py-12">
        <Link
          href="/components"
          className="mb-10 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Components
        </Link>
        <header className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <h1 className="text-xl font-bold">{entry.name}</h1>
            <span className="text-xs text-muted-foreground">
              {entry.category}
            </span>
          </div>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">
            {entry.description}
          </p>
        </header>
        <DocsTabs
          tabs={[
            {
              label: "Preview",
              content: (
                <div className="min-h-56 overflow-hidden px-3 py-8 sm:px-6">
                  {preview}
                </div>
              ),
            },
            {
              label: "Code",
              content: (
                <Suspense
                  fallback={<div className="h-32 animate-pulse bg-muted/20" />}
                >
                  <CodeSnippet
                    code={entry.usage.code}
                    title={entry.usage.title}
                    language={entry.usage.language}
                    className="my-0 border-y-0"
                  />
                </Suspense>
              ),
            },
          ]}
        />
        <h2 className="mt-12 mb-4 text-base font-semibold">Installation</h2>
        <DocsTabs
          initialTab={1}
          tabs={[
            {
              label: "Command",
              content: (
                <p className="px-4 py-4 text-sm text-muted-foreground">
                  Registry install command will be available when the public
                  registry ships.
                </p>
              ),
            },
            {
              label: "Manual",
              content: (
                <div>
                  {entry.dependencies.length > 0 ? (
                    <PackageCommand packages={entry.dependencies} />
                  ) : (
                    <p className="border-b border-border px-4 py-3 text-xs text-muted-foreground">
                      No package dependencies.
                    </p>
                  )}
                  {entry.registryDependencies.length > 0 && (
                    <p className="border-b border-border px-4 py-3 text-xs text-muted-foreground">
                      Local dependencies:{" "}
                      {entry.registryDependencies.join(", ")}.
                    </p>
                  )}
                  <div className="[&>div]:my-0">{source}</div>
                </div>
              ),
            },
          ]}
        />
        <SectionDivider className="mt-12" />
        <div className="[&_h2:first-child]:mt-8">{children}</div>
      </article>
    </main>
  );
}
