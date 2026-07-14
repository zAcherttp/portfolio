import { ArrowUpRight } from "lucide-react";

interface RotatingArrowProps {
  isHovered?: boolean;
  className?: string;
}

export default function RotatingArrow({
  isHovered,
  className = "",
}: RotatingArrowProps) {
  return (
    <span
      aria-hidden="true"
      className={`motion-hover ml-1 flex shrink-0 items-center justify-center transition-transform ${
        isHovered === undefined
          ? "group-hover:translate-x-0.5 group-hover:rotate-45"
          : isHovered
            ? "translate-x-0.5 rotate-45"
            : ""
      } ${className}`}
      data-rotating-arrow=""
    >
      <ArrowUpRight className="size-3.5" />
    </span>
  );
}
