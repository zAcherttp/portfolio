// Easing curves following official motion standards
export const EASINGS = {
  // Cubic Bezier: Fast start, slow end (ideal for hover/slide reveals)
  easeOutQuint: [0.16, 1, 0.3, 1] as [number, number, number, number],
  // Standard CSS easeInOut
  easeInOut: "easeInOut" as const,
};

// Durations in seconds
const staggerBase = 0.1;

export const DURATIONS = {
  enter: 0.6,
  exit: 0,
  fadeExit: 0.144,
  fadeEnter: 0.18,
  staggerBase: staggerBase,
  staggerMaskBase: staggerBase + 0.05, // Always start mask reveal 0.15s after icon starts sliding
};

// Orchestration / Stagger helpers
export const getStaggerDelay = (
  index: number,
  base: number,
  totalItems: number,
) => {
  const progress = index / (totalItems - 1 || 1);
  const easeProgress = progress * progress; // Quadratic ease-in of delay values = ease-out cascade speed
  return base + easeProgress * 0.4;
};
