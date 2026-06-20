// Easing curves following official motion standards
export const EASINGS = {
  // Cubic Bezier: Fast start, slow end (ideal for hover/slide reveals)
  easeOutQuint: [0.16, 1, 0.3, 1] as [number, number, number, number],
  // Standard CSS easeInOut
  easeInOut: "easeInOut" as const,
};

// Durations in seconds
export const DURATIONS = {
  enter: 0.8,
  exit: 0,
  fadeExit: 0.144,
  fadeEnter: 0.18,
};

// Orchestration / Stagger helpers
export const getStaggerDelay = (
  index: number,
  base: number,
  totalItems: number,
) => {
  const progress = index / (totalItems - 1 || 1);
  const easeProgress = progress * progress; // Quadratic ease-in of delay values = ease-out cascade speed
  return base + easeProgress * 0.56;
};
