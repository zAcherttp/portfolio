"use client";

import {
  TransactionDock,
  type TransactionDockItem,
  TransactionDockProvider,
  useTransactionDock,
} from "@/components/registry/transaction-dock";

const fixtureTransactions = [
  {
    id: "fixture-transaction",
    invoice: "INV-1430",
    amount: "23,000",
    cents: "00",
    type: "Payout",
    status: "Approved",
    sender: { name: "Lily Hayes", initials: "LH" },
    email: "lily@example.com",
    account: { network: "Mastercard", lastFour: "1638" },
    date: "15 Dec 2025, 3:32 PM",
    timezone: "EST",
    billing: {
      street: "842 Pinecrest Drive",
      city: "Redwood City",
      region: "California",
      postalCode: "94063",
      email: "lily@example.com",
      phone: "415-982-7614",
    },
    attachment: { name: "INV-1430.pdf", size: "347 KB" },
  },
] as const satisfies readonly TransactionDockItem[];

function TransactionDockFixtureTable() {
  const { openTransaction } = useTransactionDock();

  return (
    <button
      type="button"
      className="rounded-md border border-border px-3 py-2 text-sm"
      onClick={(event) =>
        openTransaction("fixture-transaction", event.currentTarget)
      }
    >
      View transaction details
    </button>
  );
}

export function TransactionDockDefaultFixture() {
  return (
    <TransactionDockProvider transactions={fixtureTransactions}>
      <TransactionDockFixtureTable />
      <TransactionDock />
    </TransactionDockProvider>
  );
}
