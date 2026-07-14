import type { SVGProps } from "react";
import { MarkdownDark } from "@/components/ui/svgs/markdownDark";
import { MarkdownLight } from "@/components/ui/svgs/markdownLight";

export default function Markdown(props: SVGProps<SVGSVGElement>) {
  return (
    <>
      <MarkdownLight
        {...props}
        className={`${props.className || ""} dark:hidden`}
      />
      <MarkdownDark
        {...props}
        className={`${props.className || ""} hidden dark:block`}
      />
    </>
  );
}
