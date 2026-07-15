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
  Minus,
  Tag,
  UserRound,
  X,
} from "lucide-react";
import type {
  CSSProperties,
  MouseEvent,
  ReactNode,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useEffect, useRef, useState } from "react";
import { DrawerSwipeHandle } from "@/components/ui/drawer";
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

type DragSession = {
  pointerId: number;
  startClientY: number;
  startOffset: number;
  currentOffset: number;
  lastClientY: number;
  lastTimestamp: number;
  velocity: number;
};

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
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const cardRef = useRef<HTMLElement>(null);
  const dragSession = useRef<DragSession | null>(null);
  const expanded = mode === "expanded";
  const deckOffset = Math.min(stackDepth, 3) * 6;
  const collapsedHeight = 76;
  const collapsedOffset = Math.max(0, cardHeight - collapsedHeight);
  const x = slot * TRANSACTION_CARD_SLOT_WIDTH - deckOffset;
  const y =
    dragOffset ?? (expanded ? -deckOffset : collapsedOffset - deckOffset);
  const style: TransactionCardStyle = {
    bottom: 16,
    height: "min(38rem, calc(100dvh - 2rem))",
    left: 16,
    pointerEvents: interactive ? "auto" : "none",
    transform: `translate3d(${x}px, ${y}px, 0)`,
    width: "min(19.5rem, calc(100vw - 2rem))",
    zIndex: 60 + (interactive ? 8 : 0) - stackDepth,
  };

  useEffect(() => {
    const element = cardRef.current;
    if (!element) return;

    const measure = () => setCardHeight(element.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive || event.button !== 0) return;
    const card = cardRef.current;
    if (!card) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    const transform = getComputedStyle(card).transform;
    const currentY =
      transform === "none" ? y : new DOMMatrixReadOnly(transform).m42;
    dragSession.current = {
      pointerId: event.pointerId,
      startClientY: event.clientY,
      startOffset: currentY + deckOffset,
      currentOffset: currentY + deckOffset,
      lastClientY: event.clientY,
      lastTimestamp: event.timeStamp,
      velocity: 0,
    };
    setDragOffset(currentY + deckOffset);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = dragSession.current;
    if (!session || session.pointerId !== event.pointerId) return;

    const elapsed = Math.max(1, event.timeStamp - session.lastTimestamp);
    session.velocity = (event.clientY - session.lastClientY) / elapsed;
    session.lastClientY = event.clientY;
    session.lastTimestamp = event.timeStamp;

    const rawOffset =
      session.startOffset + (event.clientY - session.startClientY);
    let nextOffset = rawOffset;
    if (rawOffset < 0) nextOffset = -Math.sqrt(-rawOffset) * 3;
    if (rawOffset > collapsedOffset) {
      nextOffset = collapsedOffset + Math.sqrt(rawOffset - collapsedOffset) * 3;
    }
    session.currentOffset = nextOffset;
    setDragOffset(nextOffset);
  };

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = dragSession.current;
    if (!session || session.pointerId !== event.pointerId) return;

    const projectedOffset = session.currentOffset + session.velocity * 180;
    dragSession.current = null;
    setDragOffset(null);

    if (projectedOffset < collapsedOffset * 0.5) {
      onExpand();
      return;
    }
    if (projectedOffset > collapsedOffset + 48 && session.velocity > 0.45) {
      onClose();
      return;
    }
    onCollapse();
  };

  const cancelDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragSession.current?.pointerId !== event.pointerId) return;
    dragSession.current = null;
    setDragOffset(null);
  };

  return (
    <section
      ref={cardRef}
      aria-label={`Transaction ${transaction.invoice}`}
      className={cn(
        "fixed flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-muted shadow-[0_18px_55px_-24px_rgba(0,0,0,0.38)] will-change-transform",
        "transition-[transform,box-shadow,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
        dragOffset !== null &&
          "cursor-grabbing select-none shadow-[0_24px_70px_-24px_rgba(0,0,0,0.45)] transition-none",
        !interactive && "opacity-90",
      )}
      data-slot="transaction-card"
      style={style}
    >
      <DrawerSwipeHandle
        className="h-4 w-full touch-none items-center justify-center after:h-1 after:w-16 after:bg-muted-foreground/45 after:transition-colors hover:after:bg-muted-foreground/65 active:after:bg-muted-foreground/80"
        onPointerCancel={cancelDrag}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
      />
      <p className="sr-only">
        Review details for transaction {transaction.invoice}.
      </p>

      <header className="flex min-h-16 shrink-0 items-center gap-2 px-3">
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
          <IconButton
            label={expanded ? "Minimize transaction" : "Expand transaction"}
            onClick={expanded ? onCollapse : onExpand}
          >
            {expanded ? (
              <Minus className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5 rotate-180" />
            )}
          </IconButton>
          <IconButton label="Close transaction" onClick={onClose}>
            <X className="size-3.5" />
          </IconButton>
        </div>
      </header>

      <div
        className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-2.5 pb-2.5"
        data-slot="transaction-card-scroll"
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
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border px-1.5 py-0.5">
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 to-rose-300 text-xs font-semibold text-neutral-800">
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
    </section>
  );
}
