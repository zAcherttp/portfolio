import { type Jsx, toJsxRuntime } from "hast-util-to-jsx-runtime";
import { cacheLife } from "next/cache";
import * as runtime from "react/jsx-runtime";
import { highlightCode } from "@/lib/highlight-code";
import { generateTypeTable } from "@/lib/type-table";
import typeTablesRegistry from "@/data/type-tables-registry.json";

type AutoTypeTableProps = { path: string; name: string };

export function AutoTypeTable(props: AutoTypeTableProps) {
  return <AutoTypeTableContent {...props} />;
}

async function AutoTypeTableContent({ path, name }: AutoTypeTableProps) {
  "use cache";
  cacheLife("max");

  const key = `${path}:${name}`;
  const precomputed = (typeTablesRegistry as Record<string, any>)[key];

  if (precomputed) {
    const highlightedDocs = precomputed.map((doc: any) => ({
      ...doc,
      entries: doc.entries.map((entry: any) => ({
        ...entry,
        highlightedType: toJsxRuntime(entry.highlightedType, {
          Fragment: runtime.Fragment,
          jsx: runtime.jsx as Jsx,
          jsxs: runtime.jsxs as Jsx,
        }),
      })),
    }));

    return renderTable(highlightedDocs);
  }

  // Fallback (for development / missing registry entries)
  const docs = await generateTypeTable({ path, name });
  const highlightedDocs = await Promise.all(
    docs.map(async (doc) => ({
      ...doc,
      entries: await Promise.all(
        doc.entries.map(async (entry) => ({
          ...entry,
          highlightedType: toJsxRuntime(
            await highlightCode(entry.type, "typescript"),
            {
              Fragment: runtime.Fragment,
              jsx: runtime.jsx as Jsx,
              jsxs: runtime.jsxs as Jsx,
            },
          ),
        })),
      ),
    })),
  );

  return renderTable(highlightedDocs);
}

function renderTable(highlightedDocs: any[]) {
  return (
    <div className="space-y-4">
      {highlightedDocs.map((doc) => (
        <div key={doc.id} className="overflow-hidden rounded-xl bg-muted/55">
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-120 table-fixed text-left text-xs">
              <thead>
                <tr className="border-border/70 border-b">
                  <th className="w-1/3 px-4 py-2.5 font-medium">Prop</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {doc.entries.map((entry: any) => (
                  <tr
                    key={entry.name}
                    className="border-border/60 border-b align-top last:border-b-0"
                  >
                    <td className="px-4 py-3 font-mono text-foreground leading-5">
                      {entry.name}
                      {entry.required ? "" : "?"}
                    </td>
                    <td className="px-4 py-3 leading-5">
                      <div className="docs-highlighted-type font-mono text-xs leading-5">
                        {entry.highlightedType}
                      </div>
                      {entry.description && (
                        <p className="mt-1.5 max-w-2xl text-muted-foreground">
                          {entry.description}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
