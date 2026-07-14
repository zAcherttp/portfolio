import type { CSSProperties } from "react";

type CubicBezier = [number, number, number, number];
type MotionCssVariables = CSSProperties &
  Record<`--motion-${string}`, string | number>;

export const MOTION_DURATION_MS = {
  instant: 0,
  hoverOut: 100,
  feedback: 120,
  hover: 140,
  enter: 180,
  move: 200,
  reveal: 240,
  cascade: 380,
} as const;

export const MOTION_EASING = {
  standard: [0.25, 0.1, 0.25, 1],
  out: [0.23, 1, 0.32, 1],
  inOut: [0.77, 0, 0.175, 1],
  cascade: [0.16, 1, 0.3, 1],
} satisfies Record<string, CubicBezier>;

const inSeconds = (duration: number) => duration / 1000;
const asCubicBezier = (easing: CubicBezier) =>
  `cubic-bezier(${easing.join(", ")})`;

export const MOTION_TRANSITION = {
  instant: {
    duration: inSeconds(MOTION_DURATION_MS.instant),
  },
  feedback: {
    duration: inSeconds(MOTION_DURATION_MS.feedback),
    ease: MOTION_EASING.out,
  },
  hover: {
    duration: inSeconds(MOTION_DURATION_MS.hover),
    ease: MOTION_EASING.standard,
  },
  enter: {
    duration: inSeconds(MOTION_DURATION_MS.enter),
    ease: MOTION_EASING.out,
  },
  move: {
    duration: inSeconds(MOTION_DURATION_MS.move),
    ease: MOTION_EASING.inOut,
  },
  reveal: {
    duration: inSeconds(MOTION_DURATION_MS.reveal),
    ease: MOTION_EASING.out,
  },
  cascade: {
    duration: inSeconds(MOTION_DURATION_MS.cascade),
    ease: MOTION_EASING.cascade,
  },
} as const;

export const MOTION_STAGGER = {
  maskOffset: 0.04,
  maxDelay: 0.22,
} as const;

export const getStaggerDelay = (
  index: number,
  totalItems: number,
  offset = 0,
) => {
  const linearProgress = index / (totalItems - 1 || 1);
  const progress = linearProgress * linearProgress;
  return Math.min(
    offset + progress * MOTION_STAGGER.maxDelay,
    MOTION_STAGGER.maxDelay,
  );
};

export const MOTION_CSS_VARIABLES: MotionCssVariables = {
  "--motion-duration-instant": `${MOTION_DURATION_MS.instant}ms`,
  "--motion-duration-hover-out": `${MOTION_DURATION_MS.hoverOut}ms`,
  "--motion-duration-feedback": `${MOTION_DURATION_MS.feedback}ms`,
  "--motion-duration-hover": `${MOTION_DURATION_MS.hover}ms`,
  "--motion-duration-enter": `${MOTION_DURATION_MS.enter}ms`,
  "--motion-duration-move": `${MOTION_DURATION_MS.move}ms`,
  "--motion-duration-reveal": `${MOTION_DURATION_MS.reveal}ms`,
  "--motion-duration-cascade": `${MOTION_DURATION_MS.cascade}ms`,
  "--motion-ease-standard": asCubicBezier(MOTION_EASING.standard),
  "--motion-ease-out": asCubicBezier(MOTION_EASING.out),
  "--motion-ease-in-out": asCubicBezier(MOTION_EASING.inOut),
  "--motion-ease-cascade": asCubicBezier(MOTION_EASING.cascade),
};
