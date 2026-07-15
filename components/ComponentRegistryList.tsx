import Link from "next/link";
import ListRowFrame from "@/components/ui/ListRowFrame";
import RotatingArrow from "@/components/ui/RotatingArrow";
import { componentRegistry, type RegistryEntry } from "@/data/components";

export type ComponentRegistryListProps = {
  entries?: readonly RegistryEntry[];
};

export default function ComponentRegistryList({
  entries = componentRegistry,
}: ComponentRegistryListProps) {
  return (
    <div className="-ml-3 flex flex-col">
      {entries.map((entry, index) => (
        <ListRowFrame
          key={entry.slug}
          render={<Link href={`/components/${entry.slug}`} />}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center font-mono text-xs text-subtle-2">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="truncate text-sm text-foreground">
              {entry.name}
            </span>
          </div>

          <div className="ml-4 flex shrink-0 items-center text-xs font-medium text-subtle transition-colors group-hover:text-foreground/80">
            <span className="hidden sm:inline">{entry.category}</span>
            <RotatingArrow />
          </div>
        </ListRowFrame>
      ))}
    </div>
  );
}
