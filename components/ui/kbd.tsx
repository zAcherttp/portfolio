"use client";

import type { IndividualKey } from "@tanstack/react-hotkeys";
import { useKeyHold } from "@tanstack/react-hotkeys";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type KbdBaseProps = HTMLAttributes<HTMLElement> & {
  pressed?: boolean;
};

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
        "inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-border bg-muted/60 px-1.5 align-middle font-mono text-[10px] font-medium leading-none text-muted-foreground shadow-[0_1px_0_var(--border)] transition-[transform,background-color,color,box-shadow] duration-75 data-[state=pressed]:translate-y-px data-[state=pressed]:bg-foreground data-[state=pressed]:text-background data-[state=pressed]:shadow-none",
        className,
      )}
      {...props}
      data-state={pressed ? "pressed" : "idle"}
    />
  );
}

function ReactiveKbd({ keyName, pressed, ...props }: ReactiveKbdProps) {
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
