import type { ReactNode } from "react";

export function DocsSection({ children }: { children: ReactNode }) {
  return <section className="mt-12">{children}</section>;
}

export type ApiRow = { prop: string; type: string; defaultValue?: string };

export function ApiTable({ rows }: { rows: ApiRow[] }) {
  return (
    <div className="overflow-x-auto border-y border-border text-sm">
      <div className="grid min-w-[30rem] grid-cols-[1fr_1.5fr_1fr] border-b border-border py-2 font-medium">
        <span>Prop</span>
        <span>Type</span>
        <span>Default</span>
      </div>
      {rows.map((row) => (
        <div
          key={row.prop}
          className="grid min-w-[30rem] grid-cols-[1fr_1.5fr_1fr] border-b border-border py-2 font-mono text-xs last:border-b-0"
        >
          <span>{row.prop}</span>
          <span className="text-muted-foreground">{row.type}</span>
          <span className="text-muted-foreground">
            {row.defaultValue ?? "-"}
          </span>
        </div>
      ))}
    </div>
  );
}
