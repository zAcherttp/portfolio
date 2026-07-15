"use client";

import {
  CalendarDays,
  Check,
  ChevronDown,
  CreditCard,
  Download,
  Ellipsis,
  FileText,
  Hash,
  Mail,
  Tag,
  UserRound,
  X,
} from "lucide-react";
import {
  motion,
  type Transition,
  useDragControls,
  useReducedMotion,
} from "motion/react";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { DrawerSwipeHandle } from "@/components/ui/drawer";
import { MOTION_TRANSITION } from "@/constants/motion";
import { cn } from "@/lib/utils";

export const TRANSACTION_CARD_COLLAPSED_POINT = "4.75rem";
export const TRANSACTION_CARD_EXPANDED_POINT = "38rem";
export const TRANSACTION_CARD_SLOT_WIDTH = 324;

export type TransactionStatus = "Approved" | "Pending" | "Declined";

export type TransactionDockItem = {
  id: string;
  invoice: string;
  amount: string;
  cents?: string;
  type: string;
  status: TransactionStatus;
  sender: {
    name: string;
    initials: string;
  };
  email: string;
  account: {
    network: "Mastercard" | "Visa";
    lastFour: string;
  };
  date: string;
  timezone: string;
  billing: {
    street: string;
    city: string;
    region: string;
    postalCode: string;
    email: string;
    phone: string;
  };
  attachment?: {
    name: string;
    size: string;
  };
};

export type TransactionCardMode =
  | "expanded"
  | "auto-collapsed"
  | "manual-collapsed";

export type TransactionCardProps = {
  transaction: TransactionDockItem;
  mode: TransactionCardMode;
  slot: number;
  stackDepth?: number;
  stackedCount?: number;
  interactive?: boolean;
  onStackOpen?: () => void;
  onClose: () => void;
  onCollapse: () => void;
  onExpand: () => void;
};

type TransactionCardStyle = CSSProperties;

const statusStyles: Record<TransactionStatus, string> = {
  Approved:
    "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-300",
  Pending:
    "bg-amber-500/12 text-amber-700 dark:bg-amber-400/12 dark:text-amber-300",
  Declined:
    "bg-rose-500/12 text-rose-700 dark:bg-rose-400/12 dark:text-rose-300",
};

function stopPropagation(event: MouseEvent) {
  event.stopPropagation();
}

function IconButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-[color,background-color,transform] duration-150 hover:bg-foreground/6 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96]"
      onClick={(event) => {
        stopPropagation(event);
        onClick?.();
      }}
    >
      {children}
    </button>
  );
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Hash;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[1rem_5.6rem_minmax(0,1fr)] items-center gap-2 text-xs leading-5">
      <Icon className="size-3.5 text-muted-foreground/75" aria-hidden="true" />
      <span className="text-muted-foreground">{label}</span>
      <div className="min-w-0 font-medium text-foreground">{children}</div>
    </div>
  );
}

function BillingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[5.6rem_minmax(0,1fr)] gap-2 text-xs leading-5">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium text-foreground">{value}</span>
    </div>
  );
}

export function TransactionCard({
  transaction,
  mode,
  slot,
  stackDepth = 0,
  stackedCount = 1,
  interactive = true,
  onStackOpen,
  onClose,
  onCollapse,
  onExpand,
}: TransactionCardProps) {
  const [billingOpen, setBillingOpen] = useState(true);
  const [cardHeight, setCardHeight] = useState(608);
  const [dragging, setDragging] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const didDrag = useRef(false);
  const previousMode = useRef(mode);
  const contentId = useId();
  const dragControls = useDragControls();
  const shouldReduceMotion = useReducedMotion();
  const expanded = mode === "expanded";
  const modeChanged = previousMode.current !== mode;
  const isAutomaticCascade =
    modeChanged &&
    (mode === "auto-collapsed" || previousMode.current === "auto-collapsed");
  const deckOffset = Math.min(stackDepth, 3) * 6;
  const collapsedHeight = 76;
  const collapsedOffset = Math.max(0, cardHeight - collapsedHeight);
  const x = slot * TRANSACTION_CARD_SLOT_WIDTH - deckOffset;
  const y = expanded ? -deckOffset : collapsedOffset - deckOffset;
  const transition = {
    bottom: shouldReduceMotion
      ? MOTION_TRANSITION.instant
      : isAutomaticCascade
        ? MOTION_TRANSITION.cascade
        : modeChanged
          ? MOTION_TRANSITION.reveal
          : MOTION_TRANSITION.move,
    left: shouldReduceMotion
      ? MOTION_TRANSITION.instant
      : MOTION_TRANSITION.move,
    opacity: shouldReduceMotion
      ? MOTION_TRANSITION.feedback
      : MOTION_TRANSITION.enter,
    y: shouldReduceMotion
      ? MOTION_TRANSITION.instant
      : MOTION_TRANSITION.reveal,
  } satisfies Transition;
  const style: TransactionCardStyle = {
    height: "min(38rem, calc(100dvh - 2rem))",
    pointerEvents: interactive ? "auto" : "none",
    width: "min(19.5rem, calc(100vw - 2rem))",
    zIndex: 60 + (interactive ? 8 : 0) - stackDepth,
  };

  useEffect(() => {
    previousMode.current = mode;
  }, [mode]);

  useLayoutEffect(() => {
    const card = cardRef.current;
    const activeElement = document.activeElement;
    if (
      !card ||
      !(activeElement instanceof HTMLElement) ||
      !card.contains(activeElement)
    ) {
      return;
    }

    if (!interactive) {
      const nextHandle = Array.from(
        document.querySelectorAll<HTMLButtonElement>(
          '[data-slot="transaction-card-handle"]',
        ),
      ).find(
        (handle) =>
          !card.contains(handle) &&
          !handle.closest("[inert]") &&
          handle.getClientRects().length > 0,
      );
      nextHandle?.focus();
      return;
    }

    if (!expanded && contentRef.current?.contains(activeElement)) {
      handleRef.current?.focus();
    }
  }, [expanded, interactive]);

  useEffect(() => {
    const element = cardRef.current;
    if (!element) return;

    const measure = () => setCardHeight(element.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const finishDrag = (offset: number, velocity: number) => {
    const startingOffset = expanded ? 0 : collapsedOffset;
    const projectedOffset = startingOffset + offset + velocity * 0.18;
    setDragging(false);
    if (projectedOffset < collapsedOffset * 0.5) {
      onExpand();
      return;
    }
    if (projectedOffset > collapsedOffset + 48 && velocity > 450) {
      onClose();
      return;
    }
    onCollapse();
  };

  return (
    <motion.section
      ref={cardRef}
      aria-hidden={interactive ? undefined : true}
      aria-label={`Transaction ${transaction.invoice}`}
      className={cn(
        "fixed flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-muted shadow-[0_18px_55px_-24px_rgba(0,0,0,0.38)]",
        dragging &&
          "cursor-grabbing select-none shadow-[0_24px_70px_-24px_rgba(0,0,0,0.45)] will-change-transform",
        !interactive && "opacity-90",
      )}
      animate={{
        bottom: 16 - y,
        left: 16 + x,
        opacity: interactive ? 1 : 0.9,
        y: 0,
      }}
      data-transaction-id={transaction.id}
      data-mode={mode}
      data-slot="transaction-card"
      drag={interactive ? "y" : false}
      dragConstraints={{
        bottom: collapsedOffset - y + 96,
        top: -deckOffset - y - 48,
      }}
      dragControls={dragControls}
      dragDirectionLock
      dragElastic={0.12}
      dragListener={false}
      dragMomentum={false}
      dragSnapToOrigin
      exit={
        shouldReduceMotion
          ? { opacity: 0 }
          : {
              opacity: 0,
              transition: {
                opacity: MOTION_TRANSITION.enter,
                y: MOTION_TRANSITION.enter,
              },
              y: collapsedHeight,
            }
      }
      initial={
        shouldReduceMotion
          ? { bottom: 16 - y, left: 16 + x, opacity: 0 }
          : {
              bottom: 16 - y,
              left: 16 + x,
              opacity: 0,
              y: collapsedHeight,
            }
      }
      inert={interactive ? undefined : true}
      onDragEnd={(_event, info) => finishDrag(info.offset.y, info.velocity.y)}
      onDragStart={() => {
        didDrag.current = true;
        setDragging(true);
      }}
      style={style}
      transition={transition}
    >
      <button
        ref={handleRef}
        type="button"
        aria-controls={contentId}
        aria-expanded={expanded}
        aria-label={`Transaction details for ${transaction.invoice}`}
        className="group/handle relative z-10 flex h-6 w-full shrink-0 touch-none cursor-grab items-center justify-center rounded-t-[inherit] outline-none active:cursor-grabbing"
        data-slot="transaction-card-handle"
        onClick={(event) => {
          if (didDrag.current && event.detail !== 0) {
            didDrag.current = false;
            return;
          }
          didDrag.current = false;
          if (expanded) onCollapse();
          else onExpand();
        }}
        onPointerDown={(event) => {
          didDrag.current = false;
          if (interactive && event.button === 0) dragControls.start(event);
        }}
      >
        <DrawerSwipeHandle className="pointer-events-none h-full w-full items-center justify-center after:h-1 after:w-16 after:bg-muted-foreground/45 after:transition-[background-color,box-shadow] group-hover/handle:after:bg-muted-foreground/65 group-active/handle:after:bg-muted-foreground/80 group-focus-visible/handle:after:bg-foreground group-focus-visible/handle:after:ring-2 group-focus-visible/handle:after:ring-ring group-focus-visible/handle:after:ring-offset-2 group-focus-visible/handle:after:ring-offset-muted" />
      </button>
      <p className="sr-only">
        Review details for transaction {transaction.invoice}.
      </p>

      <header className="flex min-h-13 shrink-0 items-center gap-2 px-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-foreground">
            Transaction details
          </h2>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {transaction.invoice} · ${transaction.amount}
            {transaction.cents ? `.${transaction.cents}` : ""}
          </p>
        </div>

        {stackedCount > 1 ? (
          <button
            type="button"
            aria-label={`Open next transaction; ${stackedCount - 1} more in the stack`}
            className="rounded-full bg-foreground/8 px-2 py-0.5 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-foreground/12 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            onClick={(event) => {
              stopPropagation(event);
              onStackOpen?.();
            }}
          >
            +{stackedCount - 1}
          </button>
        ) : null}

        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton label={`Download ${transaction.invoice}`}>
            <Download className="size-3.5" />
          </IconButton>
          <IconButton label="More transaction actions">
            <Ellipsis className="size-3.5" />
          </IconButton>
          <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
          <IconButton label="Close transaction" onClick={onClose}>
            <X className="size-3.5" />
          </IconButton>
        </div>
      </header>

      <div
        ref={contentRef}
        id={contentId}
        aria-hidden={!expanded}
        className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-2.5 pb-2.5"
        data-slot="transaction-card-scroll"
        inert={expanded ? undefined : true}
      >
        <div className="rounded-xl border border-border/65 bg-background p-4 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
          <p className="text-xs text-muted-foreground">Amount</p>
          <p className="mt-0.5 tracking-[-0.04em] text-3xl font-medium text-foreground">
            ${transaction.amount}
            <span className="ml-0.5 text-base font-normal text-muted-foreground/60">
              .{transaction.cents ?? "00"}
            </span>
          </p>

          <div className="mt-4 space-y-1.5">
            <DetailRow icon={Hash} label="Invoice no.">
              {transaction.invoice}
            </DetailRow>
            <DetailRow icon={Tag} label="Transaction type">
              {transaction.type}
            </DetailRow>
            <DetailRow icon={Check} label="Status">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
                  statusStyles[transaction.status],
                )}
              >
                {transaction.status === "Approved" ? (
                  <Check className="size-3" aria-hidden="true" />
                ) : null}
                {transaction.status}
              </span>
            </DetailRow>
            <DetailRow icon={UserRound} label="Sender">
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border pl-0.5 pr-1.5 py-0.5">
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-linear-to-br from-amber-200 to-rose-300 text-xs font-semibold text-neutral-800">
                  {transaction.sender.initials}
                </span>
                <span className="truncate">{transaction.sender.name}</span>
              </span>
            </DetailRow>
            <DetailRow icon={Mail} label="Sender email">
              <span className="block truncate">{transaction.email}</span>
            </DetailRow>
            <DetailRow icon={CreditCard} label="Account">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5">
                <span className="flex -space-x-1" aria-hidden="true">
                  <span className="size-2.5 rounded-full bg-red-500" />
                  <span className="size-2.5 rounded-full bg-amber-400/90" />
                </span>
                <span className="tracking-[0.14em] text-muted-foreground">
                  ••••
                </span>
                {transaction.account.lastFour}
              </span>
            </DetailRow>
            <DetailRow icon={CalendarDays} label="Date">
              <span className="flex flex-wrap items-center gap-1.5">
                {transaction.date}
                <span className="rounded-full border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
                  {transaction.timezone}
                </span>
              </span>
            </DetailRow>
          </div>

          <section className="mt-4 rounded-xl bg-muted/75 px-3 py-2.5">
            <button
              type="button"
              aria-expanded={billingOpen}
              className="flex w-full items-center justify-between rounded-md py-1 text-left text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setBillingOpen((open) => !open)}
            >
              Billing information
              <ChevronDown
                className={cn(
                  "size-3.5 text-muted-foreground transition-transform duration-200",
                  billingOpen && "rotate-180",
                )}
              />
            </button>
            <div
              className={cn(
                "grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out",
                billingOpen
                  ? "grid-rows-[1fr] opacity-100"
                  : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="min-h-0">
                <div className="mt-2 space-y-0.5 border-t border-border/70 pt-2.5">
                  <BillingRow
                    label="Street address"
                    value={transaction.billing.street}
                  />
                  <BillingRow label="City" value={transaction.billing.city} />
                  <BillingRow
                    label="State"
                    value={transaction.billing.region}
                  />
                  <BillingRow
                    label="Zip code"
                    value={transaction.billing.postalCode}
                  />
                  <BillingRow label="Email" value={transaction.billing.email} />
                  <BillingRow
                    label="Mobile number"
                    value={transaction.billing.phone}
                  />
                </div>
              </div>
            </div>
          </section>

          {transaction.attachment ? (
            <section className="mt-4">
              <p className="mb-1.5 text-xs text-muted-foreground">
                Attachments
              </p>
              <div className="flex items-center gap-2 rounded-xl border border-border px-3 py-2.5">
                <span className="inline-flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <FileText className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium">
                  {transaction.attachment.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {transaction.attachment.size}
                </span>
                <IconButton label="Attachment actions">
                  <Ellipsis className="size-3.5" />
                </IconButton>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </motion.section>
  );
}
