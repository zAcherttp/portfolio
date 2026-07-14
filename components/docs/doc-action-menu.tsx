"use client";

import { Menu } from "@base-ui/react/menu";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  docActionButtonClass,
  docActionMenuItemClass,
} from "./doc-action-styles";

export function DocActionMenu({
  label,
  icon,
  triggerClassName,
  children,
}: {
  label: string;
  icon: ReactNode;
  triggerClassName?: string;
  children: ReactNode;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={label}
        title={label}
        className={cn(docActionButtonClass, triggerClassName)}
      >
        {icon}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          align="end"
          className="z-50 outline-none"
          collisionPadding={12}
          sideOffset={6}
        >
          <Menu.Popup className="motion-enter min-w-48 origin-(--transform-origin) rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg shadow-black/5 outline-none transition-[transform,opacity] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none">
            {children}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function DocActionMenuItem({
  onClick,
  closeOnClick = true,
  children,
}: {
  onClick: () => void;
  closeOnClick?: boolean;
  children: ReactNode;
}) {
  return (
    <Menu.Item
      className={docActionMenuItemClass}
      closeOnClick={closeOnClick}
      onClick={onClick}
    >
      {children}
    </Menu.Item>
  );
}

export function DocActionMenuLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Menu.LinkItem
      className={docActionMenuItemClass}
      closeOnClick
      href={href}
      rel="noopener noreferrer"
      target="_blank"
    >
      {children}
    </Menu.LinkItem>
  );
}
