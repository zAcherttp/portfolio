"use client";

import type { ReactNode } from "react";
import { ExternalLink } from "@/components/ExternalLink";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { OutboundLinkContext } from "@/lib/attribution";
import { cn } from "@/lib/utils";
import { docActionButtonClass } from "./doc-action-styles";

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
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        aria-label={label}
        className={cn(docActionButtonClass, triggerClassName)}
        title={label}
      >
        {icon}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48" sideOffset={6}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
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
    <DropdownMenuItem closeOnClick={closeOnClick} onClick={onClick}>
      {children}
    </DropdownMenuItem>
  );
}

export function DocActionMenuLink({
  attributionContext,
  href,
  children,
}: {
  attributionContext: OutboundLinkContext;
  href: string;
  children: ReactNode;
}) {
  return (
    <DropdownMenuItem
      closeOnClick
      render={
        <ExternalLink
          attributionContext={attributionContext}
          href={href}
          target="_blank"
        />
      }
    >
      {children}
    </DropdownMenuItem>
  );
}
