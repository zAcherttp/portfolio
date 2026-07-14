import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { RegistryEntry } from "@/data/components";
import { docActionButtonClass } from "./doc-action-styles";

export function ComponentDocsNavigation({
  previous,
  next,
}: {
  previous: RegistryEntry | null;
  next: RegistryEntry | null;
}) {
  if (!previous && !next) return null;

  return (
    <nav aria-label="Component documentation" className="flex items-center">
      {previous && (
        <Link
          aria-label={`Previous component: ${previous.name}`}
          className={docActionButtonClass}
          href={`/components/${previous.slug}`}
          title={`Previous: ${previous.name}`}
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
        </Link>
      )}
      {next && (
        <Link
          aria-label={`Next component: ${next.name}`}
          className={docActionButtonClass}
          href={`/components/${next.slug}`}
          title={`Next: ${next.name}`}
        >
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      )}
    </nav>
  );
}
