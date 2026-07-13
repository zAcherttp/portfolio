import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type KbdProps = HTMLAttributes<HTMLElement>;

export function Kbd({ className, ...props }: KbdProps) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-border bg-muted/60 px-1.5 align-middle font-mono text-[10px] font-medium leading-none text-muted-foreground shadow-[0_1px_0_var(--border)]",
        className,
      )}
      {...props}
    />
  );
}
