"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type BackButtonProps = {
  children?: ReactNode;
  className?: string;
  href?: string;
};

export function BackButton({
  children = "Back",
  className,
  href,
}: BackButtonProps) {
  const router = useRouter();
  const content = (
    <>
      <ArrowLeft className="size-4" />
      {children}
    </>
  );
  const styles = cn(
    "-ml-2 inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    className,
  );

  if (href) {
    return (
      <Link className={styles} href={href}>
        {content}
      </Link>
    );
  }

  return (
    <button className={styles} onClick={() => router.back()} type="button">
      {content}
    </button>
  );
}
