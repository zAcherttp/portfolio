import type { SVGProps } from "react";
import { Openai } from "@/components/ui/svgs/openai";
import { OpenaiDark } from "@/components/ui/svgs/openaiDark";

export default function ChatGPT(props: SVGProps<SVGSVGElement>) {
  return (
    <>
      <Openai {...props} className={`${props.className || ""} dark:hidden`} />
      <OpenaiDark
        {...props}
        className={`${props.className || ""} hidden dark:block`}
      />
    </>
  );
}
