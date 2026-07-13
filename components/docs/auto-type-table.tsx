import { Suspense } from "react";
import { typeTableGenerator } from "@/lib/type-table";

type AutoTypeTableProps = { path: string; name: string };

export function AutoTypeTable(props: AutoTypeTableProps) {
  return (
    <Suspense
      fallback={
        <div className="h-28 animate-pulse border-y border-border bg-muted/20" />
      }
    >
      <AutoTypeTableContent {...props} />
    </Suspense>
  );
}

async function AutoTypeTableContent({ path, name }: AutoTypeTableProps) {
  const docs = await typeTableGenerator.generateTypeTable({ path, name });
  return docs.map((doc) => (
    <div key={doc.id} className="overflow-x-auto border-y border-border">
      <div className="grid min-w-[30rem] grid-cols-[1fr_2fr] border-b border-border py-2 text-xs font-medium">
        <span>Prop</span>
        <span>Type</span>
      </div>
      {doc.entries.map((entry) => (
        <div
          key={entry.name}
          className="grid min-w-[30rem] grid-cols-[1fr_2fr] border-b border-border py-2 text-xs last:border-b-0"
        >
          <span className="font-mono">
            {entry.name}
            {entry.required ? "" : "?"}
          </span>
          <code className="pr-3 text-muted-foreground">{entry.type}</code>
          {entry.description && (
            <p className="col-span-full mt-1 text-muted-foreground">
              {entry.description}
            </p>
          )}
        </div>
      ))}
    </div>
  ));
}
