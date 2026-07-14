import type { SVGProps } from "react";
import { V0Dark } from "@/components/ui/svgs/v0Dark";
import { V0Light } from "@/components/ui/svgs/v0Light";

export default function V0(props: SVGProps<SVGSVGElement>) {
  return (
    <>
      <V0Light {...props} className={`${props.className || ""} dark:hidden`} />
      <V0Dark
        {...props}
        className={`${props.className || ""} hidden dark:block`}
      />
    </>
  );
}
