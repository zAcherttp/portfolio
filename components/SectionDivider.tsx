import { cn } from "@/lib/utils";

interface SectionDividerProps {
  className?: string;
}

export default function SectionDivider({ className }: SectionDividerProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("h-px w-full bg-zinc-100", className)}
    />
  );
}
