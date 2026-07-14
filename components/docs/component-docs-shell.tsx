import { type ReactNode, Suspense } from "react";
import { BackButton } from "@/components/BackButton";
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
        <BackButton className="docs-pressable mb-9" href="/components">
          Components
        </BackButton>
        <header className="mb-10">
          <div className="mb-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-xl font-semibold tracking-tight">
              {entry.name}
            </h1>
            <span className="font-mono text-[11px] text-muted-foreground">
              {entry.category} / {entry.status}
            </span>
          </div>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">
            {entry.description}
          </p>
        </header>
        <DocsTabs
          ariaLabel={`${entry.name} example`}
          panelClassName="mt-3 overflow-hidden rounded-2xl bg-muted/45"
          tabs={[
            {
              label: "Preview",
              content: (
                <div className="min-h-64 overflow-x-auto overscroll-x-contain px-3 py-10 sm:px-6">
                  <div className="flex min-h-44 w-max min-w-full items-center justify-center">
                    {preview}
                  </div>
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
                    className="my-0 rounded-none bg-transparent"
                  />
                </Suspense>
              ),
            },
          ]}
        />
        <section aria-labelledby="installation-heading" className="mt-14">
          <h2
            id="installation-heading"
            className="mb-5 text-base font-semibold tracking-tight"
          >
            Installation
          </h2>
          <DocsTabs
            ariaLabel={`${entry.name} installation method`}
            panelClassName="mt-3"
            tabs={[
              {
                label: "Command",
                content:
                  entry.dependencies.length > 0 ? (
                    <PackageCommand packages={entry.dependencies} />
                  ) : (
                    <p className="rounded-xl bg-muted/55 px-4 py-4 text-sm text-muted-foreground">
                      No package dependencies.
                    </p>
                  ),
              },
              {
                label: "Manual",
                content: (
                  <div className="space-y-4">
                    {entry.registryDependencies.length > 0 && (
                      <p className="border-y border-border px-1 py-3 text-xs leading-5 text-muted-foreground">
                        Local dependencies:{" "}
                        <span className="font-mono text-foreground">
                          {entry.registryDependencies.join(", ")}
                        </span>
                        .
                      </p>
                    )}
                    <div className="space-y-4 [&>div]:my-0">{source}</div>
                  </div>
                ),
              },
            ]}
          />
        </section>
        <SectionDivider className="mt-6" />
        <div className="[&_h2:first-child]:mt-6">{children}</div>
      </article>
    </main>
  );
}
