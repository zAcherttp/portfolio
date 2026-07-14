import type { ReactNode } from "react";

export function DocsSection({ children }: { children: ReactNode }) {
  return <section className="mt-14">{children}</section>;
}
