import type { SVGProps } from "react";
import { GithubDark } from "@/components/ui/svgs/githubDark";
import { GithubLight } from "@/components/ui/svgs/githubLight";

export default function GitHub(props: SVGProps<SVGSVGElement>) {
  return (
    <>
      <GithubLight
        {...props}
        className={`${props.className || ""} dark:hidden`}
      />
      <GithubDark
        {...props}
        className={`${props.className || ""} hidden dark:block`}
      />
    </>
  );
}
