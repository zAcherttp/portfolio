import { ArrowLeft, FlaskConical } from "lucide-react";
import Link from "next/link";
import ComponentRegistryList from "@/components/ComponentRegistryList";
import SectionDivider from "@/components/SectionDivider";

export default function ComponentsPage() {
  return (
    <main className="min-h-screen text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-8 sm:py-12">
        <Link
          href="/"
          className="mb-10 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Profile
        </Link>

        <header className="mb-12">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-xl font-bold">Components</h1>
            {process.env.NODE_ENV === "development" && (
              <Link
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                href="/dev/components"
              >
                <FlaskConical className="size-3.5" />
                Fixtures
              </Link>
            )}
          </div>
          <p className="mt-3 max-w-xl text-pretty text-sm leading-6 text-muted-foreground">
            A growing registry of interface details, interactions, and visual
            experiments. These are local APIs for now; installable registry
            packages will come after their interfaces settle.
          </p>
        </header>

        <SectionDivider className="mb-4" />
        <ComponentRegistryList />
      </div>
    </main>
  );
}
