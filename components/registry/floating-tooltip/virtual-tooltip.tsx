"use client";

import { motion, type Transition, useReducedMotion } from "motion/react";
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  DEFAULT_COLLISION_PADDING,
  type FloatingTooltipOffset,
  type FloatingTooltipPlacement,
  type ResolvedTooltipPosition,
  resolveTooltipPosition,
  type TooltipSize,
  type VirtualAnchor,
} from "./position";

const MOVE_TRANSITION = {
  duration: 0.1,
  ease: [0.2, 0.8, 0.2, 1],
} satisfies Transition;

const TOOLTIP_TRANSITION = {
  ...MOVE_TRANSITION,
  layout: MOVE_TRANSITION,
  opacity: { duration: 0.15, ease: "easeOut" },
} satisfies Transition;

const APPEAR_TRANSITION = {
  ...TOOLTIP_TRANSITION,
  left: { duration: 0 },
  top: { duration: 0 },
  width: { duration: 0 },
  height: { duration: 0 },
  layout: { duration: 0 },
} satisfies Transition;

const NO_MOTION_TRANSITION = { duration: 0 } satisfies Transition;
const ENVIRONMENT_SETTLE_DELAY = 100;

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

export type VirtualTooltipProps = {
  anchor: VirtualAnchor | null;
  children: ReactNode;
  collisionPadding?: number;
  contentClassName?: string;
  contentStyle?: CSSProperties;
  highlightClassName?: string;
  highlightColor?: CSSProperties["borderColor"];
  highlightRadius?: CSSProperties["borderRadius"];
  highlightStyle?: CSSProperties;
  highlightThickness?: CSSProperties["borderWidth"];
  id?: string;
  isStable?: boolean;
  offset?: FloatingTooltipOffset;
  open?: boolean;
  placement?: FloatingTooltipPlacement;
  showAnchor?: boolean;
};

export function VirtualTooltip({
  anchor,
  children,
  collisionPadding = DEFAULT_COLLISION_PADDING,
  contentClassName,
  contentStyle,
  highlightClassName,
  highlightColor = "color-mix(in oklab, var(--subtle-2, currentColor) 80%, transparent)",
  highlightRadius = 2,
  highlightStyle,
  highlightThickness = 1,
  id,
  isStable = true,
  offset,
  open,
  placement = "top",
  showAnchor = false,
}: VirtualTooltipProps) {
  const prefersReducedMotion = useReducedMotion();
  const tooltipRef = useRef<HTMLDivElement>(null);
  const lastAnchorRef = useRef<VirtualAnchor | null>(null);
  const lastChildrenRef = useRef(children);
  const wasOpenRef = useRef(false);
  const suppressPositionMotionRef = useRef(false);
  const releaseMotionFrameRef = useRef<number | null>(null);
  const positionFrameRef = useRef<number | null>(null);
  const settleTimerRef = useRef<number | null>(null);
  const tooltipSizeRef = useRef<TooltipSize | null>(null);
  const environmentStableRef = useRef(true);
  const environmentSettledRef = useRef(true);
  const observedAnchorRef = useRef(anchor);
  const anchorVersionRef = useRef(0);
  const requiredAnchorVersionRef = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [exited, setExited] = useState(true);
  const [anchorVisible, setAnchorVisible] = useState(false);
  const [environmentStable, setEnvironmentStable] = useState(true);
  const [position, setPosition] = useState<ResolvedTooltipPosition | null>(
    null,
  );
  const isOpen = open ?? anchor !== null;

  if (anchor !== observedAnchorRef.current) {
    observedAnchorRef.current = anchor;
    anchorVersionRef.current += 1;
  }

  if (isOpen && !wasOpenRef.current) {
    suppressPositionMotionRef.current = true;
    tooltipSizeRef.current = null;
  }
  wasOpenRef.current = isOpen;

  if (isOpen && anchor) {
    lastAnchorRef.current = anchor;
    lastChildrenRef.current = children;
  }
  const renderedAnchor = anchor ?? lastAnchorRef.current;
  const renderedChildren = isOpen ? children : lastChildrenRef.current;

  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const size = tooltipSizeRef.current;
    if (
      !isOpen ||
      !isStable ||
      !anchor ||
      !size ||
      !environmentStableRef.current
    ) {
      return;
    }

    const viewport = window.visualViewport;
    const viewportLeft = viewport?.pageLeft ?? window.scrollX;
    const viewportTop = viewport?.pageTop ?? window.scrollY;
    const viewportWidth = viewport?.width ?? window.innerWidth;
    const viewportHeight = viewport?.height ?? window.innerHeight;
    const bounds = {
      left: viewportLeft + collisionPadding,
      top: viewportTop + collisionPadding,
      right: viewportLeft + viewportWidth - collisionPadding,
      bottom: viewportTop + viewportHeight - collisionPadding,
    };
    const anchorInViewport =
      anchor.left + anchor.width >= bounds.left &&
      anchor.left <= bounds.right &&
      anchor.top + anchor.height >= bounds.top &&
      anchor.top <= bounds.bottom;

    if (!anchorInViewport) {
      suppressPositionMotionRef.current = true;
      setAnchorVisible(false);
      return;
    }

    const next = resolveTooltipPosition({
      anchor,
      size,
      placement,
      offset,
      bounds,
    });

    setExited(false);
    setAnchorVisible(true);
    setPosition((current) =>
      current?.left === next.left &&
      current.top === next.top &&
      current.placement === next.placement
        ? current
        : next,
    );

    if (suppressPositionMotionRef.current) {
      if (releaseMotionFrameRef.current !== null) {
        window.cancelAnimationFrame(releaseMotionFrameRef.current);
      }
      releaseMotionFrameRef.current = window.requestAnimationFrame(() => {
        suppressPositionMotionRef.current = false;
        releaseMotionFrameRef.current = null;
      });
    }
  }, [anchor, collisionPadding, isOpen, isStable, offset, placement]);

  const updatePositionRef = useRef(updatePosition);

  useLayoutEffect(() => {
    updatePositionRef.current = updatePosition;
  }, [updatePosition]);

  const resumeWhenReady = useCallback(() => {
    const requiredVersion = requiredAnchorVersionRef.current;
    if (
      !environmentSettledRef.current ||
      (requiredVersion !== null && anchorVersionRef.current < requiredVersion)
    ) {
      return false;
    }

    requiredAnchorVersionRef.current = null;
    environmentStableRef.current = true;
    suppressPositionMotionRef.current = true;
    updatePositionRef.current();
    setEnvironmentStable(true);
    return true;
  }, []);

  const schedulePositionUpdate = useCallback(() => {
    if (positionFrameRef.current !== null || !environmentStableRef.current) {
      return;
    }

    positionFrameRef.current = window.requestAnimationFrame(() => {
      positionFrameRef.current = null;
      updatePositionRef.current();
    });
  }, []);

  const pauseUntilEnvironmentSettles = useCallback(() => {
    environmentStableRef.current = false;
    environmentSettledRef.current = false;
    requiredAnchorVersionRef.current = anchorVersionRef.current + 1;
    suppressPositionMotionRef.current = true;
    setEnvironmentStable(false);

    if (positionFrameRef.current !== null) {
      window.cancelAnimationFrame(positionFrameRef.current);
      positionFrameRef.current = null;
    }
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
    }

    settleTimerRef.current = window.setTimeout(() => {
      settleTimerRef.current = null;
      positionFrameRef.current = window.requestAnimationFrame(() => {
        positionFrameRef.current = null;
        environmentSettledRef.current = true;
        resumeWhenReady();
      });
    }, ENVIRONMENT_SETTLE_DELAY);
  }, [resumeWhenReady]);

  useLayoutEffect(() => {
    const tooltip = tooltipRef.current;
    if (tooltip && !tooltipSizeRef.current) {
      tooltipSizeRef.current = {
        width: tooltip.offsetWidth,
        height: tooltip.offsetHeight,
      };
    }
    if (requiredAnchorVersionRef.current !== null) {
      resumeWhenReady();
      return;
    }
    updatePositionRef.current();
  });

  useEffect(() => {
    if (!isOpen) return;

    const tooltip = tooltipRef.current;
    const viewport = window.visualViewport;
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const borderBox = entry.borderBoxSize[0];
      const nextSize = borderBox
        ? { width: borderBox.inlineSize, height: borderBox.blockSize }
        : tooltip
          ? { width: tooltip.offsetWidth, height: tooltip.offsetHeight }
          : null;

      if (
        !nextSize ||
        (tooltipSizeRef.current?.width === nextSize.width &&
          tooltipSizeRef.current.height === nextSize.height)
      ) {
        return;
      }
      tooltipSizeRef.current = nextSize;
      schedulePositionUpdate();
    });
    if (tooltip) resizeObserver.observe(tooltip);

    window.addEventListener("resize", pauseUntilEnvironmentSettles);
    window.addEventListener("scroll", pauseUntilEnvironmentSettles, true);
    viewport?.addEventListener("resize", pauseUntilEnvironmentSettles);
    viewport?.addEventListener("scroll", pauseUntilEnvironmentSettles);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", pauseUntilEnvironmentSettles);
      window.removeEventListener("scroll", pauseUntilEnvironmentSettles, true);
      viewport?.removeEventListener("resize", pauseUntilEnvironmentSettles);
      viewport?.removeEventListener("scroll", pauseUntilEnvironmentSettles);
      if (positionFrameRef.current !== null) {
        window.cancelAnimationFrame(positionFrameRef.current);
        positionFrameRef.current = null;
      }
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
      environmentStableRef.current = true;
      environmentSettledRef.current = true;
      requiredAnchorVersionRef.current = null;
      setEnvironmentStable(true);
    };
  }, [isOpen, pauseUntilEnvironmentSettles, schedulePositionUpdate]);

  useEffect(
    () => () => {
      if (releaseMotionFrameRef.current !== null) {
        window.cancelAnimationFrame(releaseMotionFrameRef.current);
      }
      if (positionFrameRef.current !== null) {
        window.cancelAnimationFrame(positionFrameRef.current);
      }
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
      }
    },
    [],
  );

  if (!mounted || !renderedAnchor || (!isOpen && exited)) return null;

  const transition = prefersReducedMotion
    ? NO_MOTION_TRANSITION
    : suppressPositionMotionRef.current
      ? APPEAR_TRANSITION
      : TOOLTIP_TRANSITION;

  return createPortal(
    <>
      {showAnchor && (
        <motion.div
          animate={{
            left: renderedAnchor.left,
            top: renderedAnchor.top,
            width: renderedAnchor.width,
            height: renderedAnchor.height,
            opacity:
              isOpen && isStable && anchorVisible && environmentStable ? 1 : 0,
          }}
          initial={false}
          transition={transition}
          aria-hidden="true"
          className={joinClassNames(
            "pointer-events-none absolute z-9998 border-solid opacity-0",
            highlightClassName,
          )}
          style={{
            borderColor: highlightColor,
            borderRadius: highlightRadius,
            borderWidth: highlightThickness,
            ...highlightStyle,
          }}
        />
      )}
      <motion.div
        ref={tooltipRef}
        animate={{
          left: position?.left ?? renderedAnchor.left,
          top: position?.top ?? renderedAnchor.top,
          opacity:
            isOpen && isStable && anchorVisible && position && environmentStable
              ? 1
              : 0,
        }}
        initial={false}
        layout="size"
        onAnimationComplete={() => {
          if (!isOpen) setExited(true);
        }}
        transition={transition}
        data-placement={position?.placement ?? placement}
        id={id}
        role="tooltip"
        className={joinClassNames(
          "pointer-events-none absolute z-9999 whitespace-nowrap rounded px-2 py-1 text-[10px] font-medium opacity-0 shadow-md",
          contentClassName,
        )}
        style={{
          backgroundColor: "var(--floating-tooltip-background, #18181b)",
          color: "var(--floating-tooltip-foreground, #fafafa)",
          ...contentStyle,
        }}
      >
        <motion.span layout="size" transition={transition}>
          {renderedChildren}
        </motion.span>
      </motion.div>
    </>,
    document.body,
  );
}
