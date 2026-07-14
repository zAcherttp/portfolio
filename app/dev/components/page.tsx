import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BackButton } from "@/components/BackButton";
import { componentRegistry } from "@/data/components";
import { requireDevelopmentFixtures } from "@/lib/dev-fixtures";
import { createSeoMetadata } from "@/lib/seo/metadata";
import { fixtureRegistry } from "@/tests/fixtures/registry";

export const metadata: Metadata = createSeoMetadata({
  title: "Component Fixtures",
  description: "Development-only component fixtures.",
  path: "/dev/components",
  noIndex: true,
});

export default function ComponentFixturesPage() {
  requireDevelopmentFixtures();

  return (
    <main className="min-h-screen text-foreground">
      <div className="mx-auto max-w-4xl px-6 py-8 sm:py-12">
        <BackButton className="mb-10" href="/components">
          Components
        </BackButton>

        <header className="mb-8">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-bold">Component fixtures</h1>
            <span className="font-mono text-[10px] text-muted-foreground">
              development
            </span>
          </div>
        </header>

        <div className="border-t border-border">
          {componentRegistry.map((entry, index) => {
            const fixture = fixtureRegistry[entry.slug];
            return (
              <Link
                className="group grid grid-cols-[2rem_minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-border py-3 text-sm hover:bg-surface-hover"
                href={`/dev/components/${entry.slug}`}
                key={entry.slug}
              >
                <span className="font-mono text-[10px] text-subtle">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="truncate font-medium">{entry.name}</span>
                <span className="hidden text-xs text-muted-foreground sm:block">
                  {fixture.cases.length} cases
                </span>
                <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
