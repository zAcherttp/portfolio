import type { MDXComponents } from "mdx/types";
import { AutoTypeTable } from "@/components/docs/auto-type-table";
import { MdxFigcaption, MdxFigure, MdxPre } from "@/components/docs/code-frame";
import { ComponentSource } from "@/components/docs/component-source";
import { DocsSection } from "@/components/docs/docs-primitives";
import { Step, Steps } from "@/components/docs/steps";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h2: (props) => (
      <h2
        className="mt-14 mb-5 text-base font-semibold tracking-tight"
        {...props}
      />
    ),
    h3: (props) => (
      <h3 className="mt-8 mb-3 text-sm font-semibold" {...props} />
    ),
    p: (props) => (
      <p
        className="my-4 max-w-2xl text-pretty text-sm leading-6 text-muted-foreground"
        {...props}
      />
    ),
    a: (props) => (
      <a
        className="underline underline-offset-4 hover:text-foreground"
        {...props}
      />
    ),
    ul: (props) => (
      <ul
        className="my-4 max-w-2xl space-y-2 text-sm leading-6 text-muted-foreground"
        {...props}
      />
    ),
    li: (props) => <li className="ml-4 list-disc pl-1" {...props} />,
    figure: MdxFigure,
    figcaption: MdxFigcaption,
    pre: MdxPre,
    DocsSection,
    AutoTypeTable,
    ComponentSource,
    Steps,
    Step,
    ...components,
  };
}
