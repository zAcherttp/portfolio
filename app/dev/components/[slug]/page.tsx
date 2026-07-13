import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { type ComponentSlug, componentRegistry } from "@/data/components";
import { requireDevelopmentFixtures } from "@/lib/dev-fixtures";
import { cn } from "@/lib/utils";
import { fixtureRegistry } from "@/tests/fixtures/registry";

export const metadata: Metadata = {
  title: "Component Fixture",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ case?: string }>;
};

async function ComponentFixtureContent({ params, searchParams }: Props) {
  const { slug } = await params;
  const { case: requestedCase } = await searchParams;
  const entry = componentRegistry.find((component) => component.slug === slug);
  if (!entry) notFound();

  const fixture = fixtureRegistry[slug as ComponentSlug];
  const activeCase = requestedCase
    ? fixture.cases.find((item) => item.id === requestedCase)
    : fixture.cases[0];
  if (!activeCase) notFound();
  const Case = activeCase.component;

  return (
    <main className="min-h-screen text-foreground">
      <div className="mx-auto max-w-5xl px-6 py-8 sm:py-12">
        <div className="mb-10 flex items-center justify-between gap-4">
          <Link
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            href="/dev/components"
          >
            <ArrowLeft className="size-3.5" />
            Fixtures
          </Link>
          <Link
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            href={`/components/${entry.slug}`}
          >
            Documentation
            <ExternalLink className="size-3.5" />
          </Link>
        </div>

        <header className="mb-6 flex items-baseline gap-3">
          <h1 className="text-xl font-bold">{entry.name}</h1>
          <span className="font-mono text-[10px] text-muted-foreground">
            {entry.category}
          </span>
        </header>

        <nav
          aria-label="Fixture cases"
          className="mb-4 flex max-w-full gap-1 overflow-x-auto border-b border-border"
        >
          {fixture.cases.map((fixtureCase) => {
            const active = fixtureCase.id === activeCase.id;
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 border-b-2 px-2 py-2 text-xs",
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
                data-testid={`fixture-case-${fixtureCase.id}`}
                href={`/dev/components/${entry.slug}?case=${fixtureCase.id}`}
                key={fixtureCase.id}
              >
                {fixtureCase.name}
              </Link>
            );
          })}
        </nav>

        <section
          className={cn(
            "flex min-h-72 items-center justify-center overflow-hidden border-y border-border px-4 py-10 sm:px-8",
            activeCase.stageClassName,
          )}
          data-fixture-case={activeCase.id}
          data-fixture-component={entry.slug}
          data-testid="fixture-stage"
        >
          <Case />
        </section>
      </div>
    </main>
  );
}

function ComponentFixtureFallback() {
  return (
    <main className="min-h-screen text-foreground">
      <div className="mx-auto max-w-5xl px-6 py-8 sm:py-12">
        <div className="mb-10 h-4 w-20 animate-pulse bg-muted" />
        <div className="mb-6 h-7 w-48 animate-pulse bg-muted" />
        <div className="mb-4 h-9 animate-pulse border-b border-border bg-muted/40" />
        <div className="min-h-72 animate-pulse border-y border-border bg-muted/20" />
      </div>
    </main>
  );
}

export default function ComponentFixturePage(props: Props) {
  requireDevelopmentFixtures();

  return (
    <Suspense fallback={<ComponentFixtureFallback />}>
      <ComponentFixtureContent {...props} />
    </Suspense>
  );
}
