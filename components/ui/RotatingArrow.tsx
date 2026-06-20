import { ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";
import { DURATIONS, EASINGS } from "../../constants/easings";

interface RotatingArrowProps {
  isHovered: boolean;
  className?: string;
}

export default function RotatingArrow({
  isHovered,
  className = "",
}: RotatingArrowProps) {
  return (
    <motion.div
      animate={{
        rotate: isHovered ? 45 : 0,
        x: isHovered ? 2 : 0,
      }}
      transition={
        isHovered
          ? { duration: DURATIONS.enter, ease: EASINGS.easeOutQuint }
          : { duration: 0.15, ease: EASINGS.easeInOut }
      }
      className={`flex items-center justify-center flex-shrink-0 ml-1 ${className}`}
    >
      <ArrowUpRight className="w-3.5 h-3.5" />
    </motion.div>
  );
}
