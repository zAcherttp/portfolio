import type { SVGProps } from "react";
import { X } from "@/components/ui/svgs/x";
import { XDark } from "@/components/ui/svgs/xDark";

export default function XLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <>
      <X {...props} className={`${props.className || ""} dark:hidden`} />
      <XDark
        {...props}
        className={`${props.className || ""} hidden dark:block`}
      />
    </>
  );
}
