"use client";

import type { IndividualKey } from "@tanstack/react-hotkeys";
import { useKeyHold } from "@tanstack/react-hotkeys";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type KbdOwnProps = {
  /** Shows the key in its depressed visual state. */
  pressed?: boolean;
  /** Subscribes the key to live keyboard state. */
  reactive?: boolean;
  /** Physical key observed when reactive mode is enabled. */
  keyName?: IndividualKey;
  /** Additional classes for the key element. */
  className?: string;
  /** Key label rendered inside the element. */
  children?: ReactNode;
};

type KbdBaseProps = Omit<HTMLAttributes<HTMLElement>, keyof KbdOwnProps> &
  Pick<KbdOwnProps, "pressed" | "className" | "children">;

type StaticKbdProps = KbdBaseProps & {
  reactive?: false;
  keyName?: never;
};

type ReactiveKbdProps = KbdBaseProps & {
  reactive: true;
  keyName: IndividualKey;
};

export type KbdProps = StaticKbdProps | ReactiveKbdProps;

function KbdElement({ className, pressed = false, ...props }: KbdBaseProps) {
  return (
    <kbd
      className={cn(
        "motion-feedback inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-border bg-muted/60 px-1.5 align-middle font-mono text-[10px] font-medium leading-none text-muted-foreground shadow-[0_2px_0_var(--border)] transition-[translate,filter,box-shadow] motion-reduce:transition-none data-[state=pressed]:translate-y-0.5 data-[state=pressed]:brightness-90 data-[state=pressed]:shadow-[0_0_0_var(--border)]",
        className,
      )}
      {...props}
      data-state={pressed ? "pressed" : "idle"}
    />
  );
}

function ReactiveKbd({
  keyName,
  pressed,
  reactive: _,
  ...props
}: ReactiveKbdProps) {
  const held = useKeyHold(keyName);
  return <KbdElement {...props} data-key={keyName} pressed={pressed ?? held} />;
}

export function Kbd(props: KbdProps) {
  if (props.reactive) {
    return <ReactiveKbd {...props} />;
  }

  const { reactive: _, ...staticProps } = props;
  return <KbdElement {...staticProps} />;
}

export type KbdGroupProps = HTMLAttributes<HTMLSpanElement>;

export function KbdGroup({ className, ...props }: KbdGroupProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-1", className)}
      {...props}
    />
  );
}
