"use client";

import {
  createContext,
  type ReactNode,
  type RefCallback,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import {
  TRANSACTION_CARD_SLOT_WIDTH,
  TransactionCard,
  type TransactionCardMode,
  type TransactionDockItem,
} from "./transaction-card";

type TransactionPanel = {
  id: string;
  mode: TransactionCardMode;
  openedAt: number;
  lastActiveAt: number;
  collapsedAt: number | null;
};

type TransactionDockContextValue = {
  transactions: readonly TransactionDockItem[];
  panels: readonly TransactionPanel[];
  totalSlots: number;
  dockRef: RefCallback<HTMLDivElement>;
  closeTransaction: (id: string) => void;
  collapseTransaction: (id: string) => void;
  openTransaction: (id: string) => void;
};

export type TransactionDockProviderProps = {
  children: ReactNode;
  transactions: readonly TransactionDockItem[];
  maxExpanded?: number;
};

export type TransactionDockProps = {
  className?: string;
};

const TransactionDockContext =
  createContext<TransactionDockContextValue | null>(null);

function findLeastRecentlyActive(panels: readonly TransactionPanel[]) {
  return panels
    .filter((panel) => panel.mode === "expanded")
    .toSorted((a, b) => a.lastActiveAt - b.lastActiveAt)[0];
}

function findMostRecentlyAutoCollapsed(panels: readonly TransactionPanel[]) {
  return panels
    .filter((panel) => panel.mode === "auto-collapsed")
    .toSorted((a, b) => (b.collapsedAt ?? 0) - (a.collapsedAt ?? 0))[0];
}

function useAvailableDockSlots() {
  const [slots, setSlots] = useState(1);
  const [dockElement, setDockElement] = useState<HTMLDivElement | null>(null);
  const dockRef = useCallback((element: HTMLDivElement | null) => {
    setDockElement(element);
  }, []);

  useEffect(() => {
    if (!dockElement) return;

    const updateSlots = (containerWidth: number) => {
      const availableWidth = Math.max(
        TRANSACTION_CARD_SLOT_WIDTH,
        containerWidth - 32,
      );
      setSlots(
        Math.max(
          1,
          Math.min(4, Math.floor(availableWidth / TRANSACTION_CARD_SLOT_WIDTH)),
        ),
      );
    };

    updateSlots(dockElement.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => {
      updateSlots(entry?.contentRect.width ?? dockElement.clientWidth);
    });
    observer.observe(dockElement);
    return () => observer.disconnect();
  }, [dockElement]);

  return { dockRef, slots };
}

export function TransactionDockProvider({
  children,
  transactions,
  maxExpanded = 3,
}: TransactionDockProviderProps) {
  const [panels, setPanels] = useState<TransactionPanel[]>([]);
  const sequence = useRef(0);
  const { dockRef, slots: totalSlots } = useAvailableDockSlots();
  const hasCollapsedPanel = panels.some((panel) => panel.mode !== "expanded");
  const reservedStackSlots = hasCollapsedPanel && totalSlots > 1 ? 1 : 0;
  const expandedCapacity = Math.max(
    1,
    Math.min(maxExpanded, totalSlots - reservedStackSlots),
  );

  const nextSequence = useCallback(() => {
    sequence.current += 1;
    return sequence.current;
  }, []);

  const rebalancePanels = useCallback(
    (current: TransactionPanel[]) => {
      let next = current;
      let expandedCount = next.filter(
        (panel) => panel.mode === "expanded",
      ).length;

      while (expandedCount > expandedCapacity) {
        const victim = findLeastRecentlyActive(next);
        if (!victim) break;
        const collapsedAt = nextSequence();
        next = next.map((panel) =>
          panel.id === victim.id
            ? { ...panel, mode: "auto-collapsed", collapsedAt }
            : panel,
        );
        expandedCount -= 1;
      }

      while (expandedCount < expandedCapacity) {
        const returning = findMostRecentlyAutoCollapsed(next);
        if (!returning) break;
        const lastActiveAt = nextSequence();
        next = next.map((panel) =>
          panel.id === returning.id
            ? {
                ...panel,
                mode: "expanded",
                collapsedAt: null,
                lastActiveAt,
              }
            : panel,
        );
        expandedCount += 1;
      }

      return next;
    },
    [expandedCapacity, nextSequence],
  );

  useEffect(() => {
    setPanels((current) => rebalancePanels(current));
  }, [rebalancePanels]);

  useEffect(() => {
    const ids = new Set(transactions.map((transaction) => transaction.id));
    setPanels((current) => current.filter((panel) => ids.has(panel.id)));
  }, [transactions]);

  const openTransaction = useCallback(
    (id: string) => {
      if (!transactions.some((transaction) => transaction.id === id)) return;

      setPanels((current) => {
        const existing = current.find((panel) => panel.id === id);
        if (existing) {
          const lastActiveAt = nextSequence();
          if (existing.mode === "expanded") {
            return current.map((panel) =>
              panel.id === id
                ? { ...panel, lastActiveAt, openedAt: lastActiveAt }
                : panel,
            );
          }

          let next = current;
          const expandedCount = current.filter(
            (panel) => panel.mode === "expanded",
          ).length;
          if (expandedCount >= expandedCapacity) {
            const victim = findLeastRecentlyActive(
              current.filter((panel) => panel.id !== id),
            );
            if (victim) {
              const collapsedAt = nextSequence();
              next = next.map((panel) =>
                panel.id === victim.id
                  ? { ...panel, mode: "auto-collapsed", collapsedAt }
                  : panel,
              );
            }
          }

          return next.map((panel) =>
            panel.id === id
              ? {
                  ...panel,
                  mode: "expanded",
                  collapsedAt: null,
                  lastActiveAt,
                  openedAt: lastActiveAt,
                }
              : panel,
          );
        }

        const openedAt = nextSequence();
        let next = current;
        const expandedCount = current.filter(
          (panel) => panel.mode === "expanded",
        ).length;
        if (expandedCount >= expandedCapacity) {
          const victim = findLeastRecentlyActive(current);
          if (victim) {
            const collapsedAt = nextSequence();
            next = next.map((panel) =>
              panel.id === victim.id
                ? { ...panel, mode: "auto-collapsed", collapsedAt }
                : panel,
            );
          }
        }

        return [
          ...next,
          {
            id,
            mode: "expanded",
            openedAt,
            lastActiveAt: openedAt,
            collapsedAt: null,
          },
        ];
      });
    },
    [expandedCapacity, nextSequence, transactions],
  );

  const collapseTransaction = useCallback(
    (id: string) => {
      const collapsedAt = nextSequence();
      setPanels((current) =>
        current.map((panel) =>
          panel.id === id
            ? { ...panel, mode: "manual-collapsed", collapsedAt }
            : panel,
        ),
      );
    },
    [nextSequence],
  );

  const closeTransaction = useCallback(
    (id: string) => {
      setPanels((current) => {
        const closing = current.find((panel) => panel.id === id);
        if (!closing) return current;

        let next = current.filter((panel) => panel.id !== id);
        if (closing.mode === "expanded") {
          const returning = findMostRecentlyAutoCollapsed(next);
          const expandedCount = next.filter(
            (panel) => panel.mode === "expanded",
          ).length;
          if (returning && expandedCount < expandedCapacity) {
            const lastActiveAt = nextSequence();
            next = next.map((panel) =>
              panel.id === returning.id
                ? {
                    ...panel,
                    mode: "expanded",
                    collapsedAt: null,
                    lastActiveAt,
                  }
                : panel,
            );
          }
        }
        return next;
      });
    },
    [expandedCapacity, nextSequence],
  );

  const value = useMemo<TransactionDockContextValue>(
    () => ({
      transactions,
      panels,
      totalSlots,
      dockRef,
      closeTransaction,
      collapseTransaction,
      openTransaction,
    }),
    [
      transactions,
      panels,
      totalSlots,
      dockRef,
      closeTransaction,
      collapseTransaction,
      openTransaction,
    ],
  );

  return (
    <TransactionDockContext.Provider value={value}>
      {children}
    </TransactionDockContext.Provider>
  );
}

export function useTransactionDock() {
  const context = useContext(TransactionDockContext);
  if (!context) {
    throw new Error(
      "useTransactionDock must be used inside TransactionDockProvider.",
    );
  }
  return context;
}

export function TransactionDock({ className }: TransactionDockProps) {
  const {
    transactions,
    panels,
    totalSlots,
    dockRef,
    closeTransaction,
    collapseTransaction,
    openTransaction,
  } = useTransactionDock();
  const transactionsById = useMemo(
    () =>
      new Map(transactions.map((transaction) => [transaction.id, transaction])),
    [transactions],
  );
  const expandedPanels = panels
    .filter((panel) => panel.mode === "expanded")
    .toSorted((a, b) => b.openedAt - a.openedAt);
  const collapsedPanels = panels
    .filter((panel) => panel.mode !== "expanded")
    .toSorted((a, b) => (b.collapsedAt ?? 0) - (a.collapsedAt ?? 0));
  const showCollapsedDeck = totalSlots > 1 || expandedPanels.length === 0;
  const topCollapsed = collapsedPanels[0];

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 pointer-events-none z-50 w-full",
        className,
      )}
      data-panel-count={panels.length}
      data-slot-count={totalSlots}
      data-transaction-dock=""
      ref={dockRef}
    >
      {expandedPanels.map((panel, slot) => {
        const transaction = transactionsById.get(panel.id);
        if (!transaction) return null;
        const mobileQueueCount =
          totalSlots === 1 && slot === 0 ? collapsedPanels.length + 1 : 1;

        return (
          <TransactionCard
            key={panel.id}
            transaction={transaction}
            mode={panel.mode}
            slot={slot}
            stackedCount={mobileQueueCount}
            onStackOpen={() => {
              if (topCollapsed) openTransaction(topCollapsed.id);
            }}
            onClose={() => closeTransaction(panel.id)}
            onCollapse={() => collapseTransaction(panel.id)}
            onExpand={() => openTransaction(panel.id)}
          />
        );
      })}

      {showCollapsedDeck
        ? collapsedPanels.map((panel, index) => {
            const transaction = transactionsById.get(panel.id);
            if (!transaction) return null;

            return (
              <TransactionCard
                key={panel.id}
                transaction={transaction}
                mode={panel.mode}
                slot={expandedPanels.length}
                stackDepth={index}
                stackedCount={collapsedPanels.length}
                interactive={index === 0}
                onStackOpen={() => openTransaction(panel.id)}
                onClose={() => closeTransaction(panel.id)}
                onCollapse={() => collapseTransaction(panel.id)}
                onExpand={() => openTransaction(panel.id)}
              />
            );
          })
        : null}
    </div>
  );
}

export type { TransactionDockItem } from "./transaction-card";
