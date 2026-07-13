"use client";

import {
  type CSSProperties,
  cloneElement,
  type FocusEventHandler,
  type KeyboardEventHandler,
  type MutableRefObject,
  type PointerEventHandler,
  type ReactElement,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type {
  FloatingTooltipOffset,
  FloatingTooltipPlacement,
  VirtualAnchor,
} from "./position";
import { VirtualTooltip } from "./virtual-tooltip";

type TooltipTriggerProps = {
  "aria-describedby"?: string;
  onBlur?: FocusEventHandler<HTMLElement>;
  onFocus?: FocusEventHandler<HTMLElement>;
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
  onPointerEnter?: PointerEventHandler<HTMLElement>;
  onPointerLeave?: PointerEventHandler<HTMLElement>;
  onPointerMove?: PointerEventHandler<HTMLElement>;
  ref?: Ref<HTMLElement>;
};

export type TooltipHighlightOptions = {
  className?: string;
  color?: CSSProperties["borderColor"];
  radius?: CSSProperties["borderRadius"];
  style?: CSSProperties;
  thickness?: CSSProperties["borderWidth"];
};

export type TooltipProps = {
  children: ReactElement<TooltipTriggerProps>;
  closeDelay?: number;
  collisionPadding?: number;
  content: ReactNode;
  contentClassName?: string;
  contentStyle?: CSSProperties;
  defaultOpen?: boolean;
  disabled?: boolean;
  highlight?: boolean | TooltipHighlightOptions;
  isStable?: boolean;
  offset?: FloatingTooltipOffset;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  openDelay?: number;
  placement?: FloatingTooltipPlacement;
  sideOffset?: number;
  alignOffset?: number;
};

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  if (ref) (ref as MutableRefObject<T | null>).current = value;
}

function getVirtualAnchor(element: HTMLElement): VirtualAnchor {
  const rect = element.getBoundingClientRect();
  const viewport = window.visualViewport;
  return {
    left: (viewport?.pageLeft ?? window.scrollX) + rect.left,
    top: (viewport?.pageTop ?? window.scrollY) + rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function getOffset(
  placement: FloatingTooltipPlacement,
  sideOffset: number,
  alignOffset: number,
): FloatingTooltipOffset {
  switch (placement) {
    case "top-left":
      return { x: -sideOffset + alignOffset, y: -sideOffset };
    case "top":
      return { x: alignOffset, y: -sideOffset };
    case "top-right":
      return { x: sideOffset + alignOffset, y: -sideOffset };
    case "right":
      return { x: sideOffset, y: alignOffset };
    case "bottom-right":
      return { x: sideOffset + alignOffset, y: sideOffset };
    case "bottom":
      return { x: alignOffset, y: sideOffset };
    case "bottom-left":
      return { x: -sideOffset + alignOffset, y: sideOffset };
    case "left":
      return { x: -sideOffset, y: alignOffset };
  }
}

export function Tooltip({
  alignOffset = 0,
  children,
  closeDelay = 0,
  collisionPadding,
  content,
  contentClassName,
  contentStyle,
  defaultOpen = false,
  disabled = false,
  highlight = false,
  isStable,
  offset,
  onOpenChange,
  open,
  openDelay = 0,
  placement = "top",
  sideOffset = 6,
}: TooltipProps) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLElement>(null);
  const anchorRef = useRef<VirtualAnchor | null>(null);
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const pointerInsideRef = useRef(false);
  const focusInsideRef = useRef(false);
  const [anchor, setAnchor] = useState<VirtualAnchor | null>(null);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = open !== undefined;
  const isOpen = open ?? uncontrolledOpen;

  const clearOpenTimer = useCallback(() => {
    if (openTimerRef.current === null) return;
    window.clearTimeout(openTimerRef.current);
    openTimerRef.current = null;
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current === null) return;
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }, []);

  const commitOpen = useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) setUncontrolledOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );

  const measureAnchor = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return null;
    const nextAnchor = getVirtualAnchor(trigger);
    anchorRef.current = nextAnchor;
    setAnchor(nextAnchor);
    return nextAnchor;
  }, []);

  const requestOpen = useCallback(() => {
    if (disabled) return;
    clearCloseTimer();
    measureAnchor();
    if (isOpen) return;

    clearOpenTimer();
    if (openDelay <= 0) {
      commitOpen(true);
      return;
    }
    openTimerRef.current = window.setTimeout(() => {
      openTimerRef.current = null;
      commitOpen(true);
    }, openDelay);
  }, [
    clearCloseTimer,
    clearOpenTimer,
    commitOpen,
    disabled,
    isOpen,
    measureAnchor,
    openDelay,
  ]);

  const requestClose = useCallback(() => {
    clearOpenTimer();
    if (pointerInsideRef.current || focusInsideRef.current) return;
    clearCloseTimer();

    const close = () => {
      closeTimerRef.current = null;
      commitOpen(false);
    };
    if (closeDelay <= 0) {
      close();
      return;
    }
    closeTimerRef.current = window.setTimeout(close, closeDelay);
  }, [clearCloseTimer, clearOpenTimer, closeDelay, commitOpen]);

  useLayoutEffect(() => {
    if (isOpen && !anchorRef.current) measureAnchor();
  }, [isOpen, measureAnchor]);

  useEffect(() => {
    if (!isOpen) return;
    const trigger = triggerRef.current;
    if (!trigger) return;

    const resizeObserver = new ResizeObserver(measureAnchor);
    resizeObserver.observe(trigger);
    const invalidateAnchor = () => {
      clearOpenTimer();
      clearCloseTimer();
      anchorRef.current = null;
      setAnchor(null);
      commitOpen(false);
    };
    window.addEventListener("scroll", invalidateAnchor, true);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("scroll", invalidateAnchor, true);
    };
  }, [clearCloseTimer, clearOpenTimer, commitOpen, isOpen, measureAnchor]);

  useEffect(
    () => () => {
      clearOpenTimer();
      clearCloseTimer();
    },
    [clearCloseTimer, clearOpenTimer],
  );

  const childProps = children.props;
  const describedBy = [
    childProps["aria-describedby"],
    isOpen ? tooltipId : undefined,
  ]
    .filter(Boolean)
    .join(" ");
  const trigger = cloneElement(children, {
    "aria-describedby": describedBy || undefined,
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      assignRef(childProps.ref, node);
    },
    onPointerEnter: (event) => {
      childProps.onPointerEnter?.(event);
      if (event.defaultPrevented || event.pointerType === "touch") return;
      pointerInsideRef.current = true;
      requestOpen();
    },
    onPointerMove: (event) => {
      childProps.onPointerMove?.(event);
      if (
        event.defaultPrevented ||
        event.pointerType === "touch" ||
        anchorRef.current
      ) {
        return;
      }
      pointerInsideRef.current = true;
      requestOpen();
    },
    onPointerLeave: (event) => {
      childProps.onPointerLeave?.(event);
      if (event.defaultPrevented) return;
      pointerInsideRef.current = false;
      requestClose();
    },
    onFocus: (event) => {
      childProps.onFocus?.(event);
      if (event.defaultPrevented) return;
      focusInsideRef.current = true;
      requestOpen();
    },
    onBlur: (event) => {
      childProps.onBlur?.(event);
      if (event.defaultPrevented) return;
      if (
        event.relatedTarget instanceof Node &&
        event.currentTarget.contains(event.relatedTarget)
      ) {
        return;
      }
      focusInsideRef.current = false;
      requestClose();
    },
    onKeyDown: (event) => {
      childProps.onKeyDown?.(event);
      if (event.defaultPrevented || event.key !== "Escape") return;
      event.preventDefault();
      pointerInsideRef.current = false;
      focusInsideRef.current = false;
      clearOpenTimer();
      clearCloseTimer();
      commitOpen(false);
    },
  });
  const highlightOptions = typeof highlight === "object" ? highlight : {};

  return (
    <>
      {trigger}
      <VirtualTooltip
        anchor={anchor}
        collisionPadding={collisionPadding}
        contentClassName={contentClassName}
        contentStyle={contentStyle}
        highlightClassName={highlightOptions.className}
        highlightColor={highlightOptions.color}
        highlightRadius={highlightOptions.radius}
        highlightStyle={highlightOptions.style}
        highlightThickness={highlightOptions.thickness}
        id={tooltipId}
        isStable={isStable}
        offset={offset ?? getOffset(placement, sideOffset, alignOffset)}
        open={isOpen}
        placement={placement}
        showAnchor={Boolean(highlight)}
      >
        {content}
      </VirtualTooltip>
    </>
  );
}
