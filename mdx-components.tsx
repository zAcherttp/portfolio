import type { MDXComponents } from "mdx/types";
import { AutoTypeTable } from "@/components/docs/auto-type-table";
import { MdxFigcaption, MdxFigure, MdxPre } from "@/components/docs/code-frame";
import { ComponentSource } from "@/components/docs/component-source";
import { ApiTable, DocsSection } from "@/components/docs/docs-primitives";
import { Step, Steps } from "@/components/docs/steps";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h2: (props) => (
      <h2 className="mt-12 mb-4 text-base font-semibold" {...props} />
    ),
    p: (props) => (
      <p className="my-4 text-sm leading-6 text-muted-foreground" {...props} />
    ),
    a: (props) => (
      <a
        className="underline underline-offset-4 hover:text-foreground"
        {...props}
      />
    ),
    ul: (props) => (
      <ul className="my-4 space-y-2 text-sm text-muted-foreground" {...props} />
    ),
    li: (props) => <li className="ml-4 list-disc pl-1" {...props} />,
    figure: MdxFigure,
    figcaption: MdxFigcaption,
    pre: MdxPre,
    DocsSection,
    ApiTable,
    AutoTypeTable,
    ComponentSource,
    Steps,
    Step,
    ...components,
  };
}
