import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { componentRegistry, type RegistryEntry } from "@/data/components";

export type ComponentRegistryListProps = {
  entries?: readonly RegistryEntry[];
};

export default function ComponentRegistryList({
  entries = componentRegistry,
}: ComponentRegistryListProps) {
  return (
    <div className="border-y border-border">
      {entries.map((entry, index) => (
        <Link
          key={entry.slug}
          href={`/components/${entry.slug}`}
          className="group grid grid-cols-[2rem_1fr_auto] items-center gap-2 border-b border-border py-2.5 text-sm last:border-b-0 hover:bg-surface-hover sm:grid-cols-[2.25rem_1fr_8rem_auto]"
        >
          <span className="pl-1 font-mono text-xs text-subtle-2">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="text-foreground">{entry.name}</span>
          <span className="hidden text-xs text-muted-foreground sm:block">
            {entry.category}
          </span>
          <ArrowUpRight
            aria-hidden="true"
            className="mr-1 size-3.5 text-subtle transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
          />
        </Link>
      ))}
    </div>
  );
}
