import Link from "next/link";
import RotatingArrow from "@/components/ui/RotatingArrow";
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
          <RotatingArrow className="mr-4.5 text-subtle group-hover:text-foreground" />
        </Link>
      ))}
    </div>
  );
}
