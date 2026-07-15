"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { type ComponentType, type ReactNode, useEffect, useState } from "react";
import { DitherFooter } from "@/components/DitherFooter";
import { WhileAwayNotificationsPreview } from "@/components/docs/while-away-notifications-preview";
import GitHubContributions from "@/components/profile/GitHubContributions";
import {
  Tooltip,
  type VirtualAnchor,
  VirtualTooltip,
} from "@/components/registry/floating-tooltip";
import {
  TransactionDock,
  type TransactionDockItem,
  TransactionDockProvider,
  useTransactionDock,
} from "@/components/registry/transaction-dock";
import { Kbd } from "@/components/ui/kbd";
import type { ComponentSlug } from "@/data/components";
import { Keyboard60Preview } from "./keyboard-60-preview";

const tooltipData = [
  {
    label: "42 requests",
    column: 1,
    row: 1,
    columns: 5,
    rows: 5,
  },
  {
    label: "18 ms latency",
    column: 1,
    row: 6,
    columns: 3,
    rows: 3,
  },
  {
    label: "99.9% uptime",
    column: 4,
    row: 6,
    columns: 2,
    rows: 3,
  },
  {
    label: "7 deploys",
    column: 6,
    row: 1,
    columns: 5,
    rows: 3,
  },
  {
    label: "1.2k events",
    column: 11,
    row: 1,
    columns: 3,
    rows: 3,
  },
  {
    label: "86 sessions",
    column: 6,
    row: 4,
    columns: 3,
    rows: 5,
  },
  {
    label: "24 jobs",
    column: 9,
    row: 4,
    columns: 5,
    rows: 3,
  },
  {
    label: "312 reads",
    column: 9,
    row: 7,
    columns: 3,
    rows: 2,
  },
  {
    label: "0 errors",
    column: 12,
    row: 7,
    columns: 2,
    rows: 2,
  },
] as const;

const transactionPreviewData = [
  {
    id: "txn-1430",
    invoice: "INV-1430",
    amount: "23,000",
    cents: "00",
    type: "Payout",
    status: "Approved",
    sender: { name: "Lily Hayes", initials: "LH" },
    email: "lilyhaydes124@gmail.com",
    account: { network: "Mastercard", lastFour: "1638" },
    date: "15 Dec 2025, 3:32 PM",
    timezone: "EST",
    billing: {
      street: "842 Pinecrest Drive",
      city: "Redwood City",
      region: "California",
      postalCode: "94063",
      email: "lilyhaydes124@gmail.com",
      phone: "415-982-7614",
    },
    attachment: { name: "INV-1430.pdf", size: "347 KB" },
  },
  {
    id: "txn-1429",
    invoice: "INV-1429",
    amount: "8,420",
    cents: "80",
    type: "Refund",
    status: "Pending",
    sender: { name: "Noah Williams", initials: "NW" },
    email: "noah@northstar.studio",
    account: { network: "Visa", lastFour: "9014" },
    date: "15 Dec 2025, 1:08 PM",
    timezone: "PST",
    billing: {
      street: "310 Valencia Street",
      city: "San Francisco",
      region: "California",
      postalCode: "94103",
      email: "noah@northstar.studio",
      phone: "415-220-4839",
    },
    attachment: { name: "refund-1429.pdf", size: "182 KB" },
  },
  {
    id: "txn-1428",
    invoice: "INV-1428",
    amount: "12,900",
    cents: "25",
    type: "Subscription",
    status: "Approved",
    sender: { name: "Maya Patel", initials: "MP" },
    email: "maya@fieldwork.co",
    account: { network: "Mastercard", lastFour: "4402" },
    date: "14 Dec 2025, 5:44 PM",
    timezone: "CST",
    billing: {
      street: "74 Lakeview Avenue",
      city: "Chicago",
      region: "Illinois",
      postalCode: "60601",
      email: "maya@fieldwork.co",
      phone: "312-555-0186",
    },
    attachment: { name: "receipt-1428.pdf", size: "294 KB" },
  },
  {
    id: "txn-1427",
    invoice: "INV-1427",
    amount: "4,750",
    cents: "00",
    type: "Chargeback",
    status: "Declined",
    sender: { name: "Ethan Cole", initials: "EC" },
    email: "ethan@fableworks.com",
    account: { network: "Visa", lastFour: "7721" },
    date: "14 Dec 2025, 9:17 AM",
    timezone: "EST",
    billing: {
      street: "91 Mercer Street",
      city: "New York",
      region: "New York",
      postalCode: "10012",
      email: "ethan@fableworks.com",
      phone: "212-555-0197",
    },
    attachment: { name: "dispute-1427.pdf", size: "518 KB" },
  },
  {
    id: "txn-1426",
    invoice: "INV-1426",
    amount: "19,300",
    cents: "60",
    type: "Payout",
    status: "Approved",
    sender: { name: "Ava Thompson", initials: "AT" },
    email: "ava@commonform.design",
    account: { network: "Mastercard", lastFour: "2845" },
    date: "13 Dec 2025, 4:02 PM",
    timezone: "GMT",
    billing: {
      street: "18 Clerkenwell Road",
      city: "London",
      region: "Greater London",
      postalCode: "EC1M 5PQ",
      email: "ava@commonform.design",
      phone: "+44 20 7946 0182",
    },
    attachment: { name: "INV-1426.pdf", size: "306 KB" },
  },
] as const satisfies readonly TransactionDockItem[];

type PreviewFrameMode = "canvas" | "compact" | "wide";

function PreviewFrame({
  children,
  mode,
}: {
  children: ReactNode;
  mode: PreviewFrameMode;
}) {
  const layoutClassName =
    mode === "compact"
      ? "w-fit p-6"
      : mode === "canvas"
        ? "w-full overflow-hidden"
        : "w-full px-4 py-6 sm:px-6";

  return (
    <div
      className={`rounded-2xl bg-background ${layoutClassName}`}
      data-preview-frame={mode}
    >
      {children}
    </div>
  );
}

function FloatingTooltipPreview() {
  const [active, setActive] = useState<{
    anchor: VirtualAnchor;
    label: string;
  } | null>(null);

  const selectBlock = (element: HTMLElement, label: string) => {
    const rect = element.getBoundingClientRect();
    const viewport = window.visualViewport;
    setActive({
      label,
      anchor: {
        left: (viewport?.pageLeft ?? window.scrollX) + rect.left,
        top: (viewport?.pageTop ?? window.scrollY) + rect.top,
        width: rect.width,
        height: rect.height,
      },
    });
  };

  return (
    <div
      className="mx-auto grid aspect-13/8 w-full max-w-lg grid-cols-13 grid-rows-8 gap-1.5"
      onPointerLeave={() => setActive(null)}
    >
      {tooltipData.map((item) => (
        <button
          key={item.label}
          type="button"
          aria-label={item.label}
          className="min-h-0 min-w-0 rounded-sm bg-muted-foreground/20 focus-visible:outline-none"
          style={{
            gridColumn: `${item.column} / span ${item.columns}`,
            gridRow: `${item.row} / span ${item.rows}`,
          }}
          onFocus={(event) => selectBlock(event.currentTarget, item.label)}
          onBlur={() => setActive(null)}
          onPointerEnter={(event) =>
            selectBlock(event.currentTarget, item.label)
          }
        />
      ))}
      <VirtualTooltip
        anchor={active?.anchor ?? null}
        highlightColor="color-mix(in oklab, var(--foreground) 40%, transparent)"
        highlightRadius={4}
        highlightThickness={2}
        showAnchor
      >
        {active?.label}
      </VirtualTooltip>
    </div>
  );
}

function GitHubPreview() {
  return (
    <PreviewFrame mode="wide">
      <div className="flex min-h-40 w-full min-w-0 items-center">
        <GitHubContributions />
      </div>
    </PreviewFrame>
  );
}

function ThemeHotkeyPreview() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const dark = mounted && resolvedTheme === "dark";
  const Icon = dark ? Sun : Moon;

  useEffect(() => setMounted(true), []);

  return (
    <div className="flex min-h-40 items-center justify-center">
      <PreviewFrame mode="compact">
        <Tooltip content="Toggle theme">
          <button
            type="button"
            onClick={() => setTheme(dark ? "light" : "dark")}
            className="docs-pressable -m-6 inline-flex items-center justify-center gap-2 rounded-2xl p-6 outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Toggle theme"
          >
            <Icon className="size-4" />
            <Kbd>D</Kbd>
          </button>
        </Tooltip>
      </PreviewFrame>
    </div>
  );
}

function DitherPreview() {
  return (
    <PreviewFrame mode="canvas">
      <DitherFooter className="h-44 w-full" testId="dither-showcase" />
    </PreviewFrame>
  );
}

function KbdPreview() {
  return (
    <PreviewFrame mode="wide">
      <Keyboard60Preview />
    </PreviewFrame>
  );
}

function TransactionTablePreview() {
  const { openTransaction } = useTransactionDock();

  return (
    <div className="w-full overflow-x-auto">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">Transactions</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Open several rows, then swipe a collapsed card upward.
          </p>
        </div>
        <span className="hidden rounded-full bg-muted px-2.5 py-1 font-mono text-xs text-muted-foreground sm:inline-flex">
          max 3 expanded
        </span>
      </div>

      <table className="w-full min-w-[36rem] border-collapse text-left text-xs">
        <thead>
          <tr className="border-y border-border text-muted-foreground">
            <th className="px-2 py-2 font-normal">Invoice</th>
            <th className="px-2 py-2 font-normal">Sender</th>
            <th className="px-2 py-2 font-normal">Status</th>
            <th className="px-2 py-2 font-normal">Amount</th>
            <th className="px-2 py-2 text-right font-normal">Action</th>
          </tr>
        </thead>
        <tbody>
          {transactionPreviewData.map((transaction) => (
            <tr key={transaction.id} className="border-b border-border/75">
              <td className="px-2 py-2.5 font-mono text-foreground">
                {transaction.invoice}
              </td>
              <td className="px-2 py-2.5 text-muted-foreground">
                {transaction.sender.name}
              </td>
              <td className="px-2 py-2.5">
                <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
                  {transaction.status}
                </span>
              </td>
              <td className="px-2 py-2.5 font-medium text-foreground">
                ${transaction.amount}.{transaction.cents}
              </td>
              <td className="px-2 py-2.5 text-right">
                <button
                  type="button"
                  className="rounded-md border border-border px-2.5 py-1.5 font-medium text-foreground outline-none transition-[background-color,transform] duration-150 hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]"
                  onClick={() => openTransaction(transaction.id)}
                >
                  View details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TransactionDockPreview() {
  return (
    <PreviewFrame mode="wide">
      <TransactionDockProvider
        transactions={transactionPreviewData}
        maxExpanded={3}
      >
        <TransactionTablePreview />
        <TransactionDock />
      </TransactionDockProvider>
    </PreviewFrame>
  );
}

const previewRegistry = {
  "floating-tooltip": FloatingTooltipPreview,
  "activity-grid": GitHubPreview,
  "contribution-graph": GitHubPreview,
  "dither-footer": DitherPreview,
  "theme-hotkey": ThemeHotkeyPreview,
  "transaction-dock": TransactionDockPreview,
  "while-away-notifications": WhileAwayNotificationsPreview,
  kbd: KbdPreview,
} satisfies Record<ComponentSlug, ComponentType>;

export function ComponentPreview({ slug }: { slug: ComponentSlug }) {
  const Preview = previewRegistry[slug];
  return <Preview />;
}
