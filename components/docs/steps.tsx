import type { ComponentProps } from "react";

export function Steps(props: ComponentProps<"div">) {
  return (
    <div
      className="relative space-y-5 border-l border-border pl-6"
      {...props}
    />
  );
}

export function Step(props: ComponentProps<"h3">) {
  return (
    <h3
      className="relative text-sm font-medium before:absolute before:top-1.5 before:-left-[1.7rem] before:size-2 before:bg-foreground"
      {...props}
    />
  );
}
