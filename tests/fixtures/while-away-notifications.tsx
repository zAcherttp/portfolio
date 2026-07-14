"use client";

import { useState } from "react";
import {
  NotificationCenter,
  useWhileAwayNotifications,
  WhileAwayNotificationsProvider,
} from "@/components/registry/while-away-notifications";
import { Toaster } from "@/components/ui/sonner";

const buttonClassName =
  "rounded-md border border-border bg-background px-3 py-2 text-xs font-medium text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]";

const fixtureSeed = [
  {
    id: "fixture-existing",
    title: "Existing notification",
    description: "This item was already in the current tab.",
    source: "Fixture",
    createdAt: 1_735_689_600_000,
    isNew: false,
  },
] as const;

function DefaultFixtureControls() {
  const { notify, phase } = useWhileAwayNotifications();

  return (
    <div className="flex items-center gap-3">
      <output className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        {phase}
      </output>
      <NotificationCenter />
      <button
        className={buttonClassName}
        type="button"
        onClick={() =>
          notify({
            id: "fixture-immediate",
            title: "Immediate notification",
            description: "Published while this tab is active.",
            source: "Fixture",
          })
        }
      >
        Add now
      </button>
    </div>
  );
}

function ControlledFixture({ overflow = false }: { overflow?: boolean }) {
  const [active, setActive] = useState(true);

  return (
    <WhileAwayNotificationsProvider
      active={active}
      awayThresholdMs={0}
      initialNotifications={fixtureSeed}
      maxCatchUpToasts={3}
      settleDelayMs={0}
    >
      <ControlledFixtureControls
        active={active}
        overflow={overflow}
        setActive={setActive}
      />
      <Toaster expand position="top-right" visibleToasts={5} />
    </WhileAwayNotificationsProvider>
  );
}

function ControlledFixtureControls({
  active,
  overflow,
  setActive,
}: {
  active: boolean;
  overflow: boolean;
  setActive: (active: boolean) => void;
}) {
  const { notify, phase, queueForReturn } = useWhileAwayNotifications();
  const count = overflow ? 5 : 3;

  return (
    <div className="flex w-full max-w-lg flex-col items-center gap-5">
      <div className="flex items-center gap-3">
        <output className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          {phase}
        </output>
        <NotificationCenter />
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          className={buttonClassName}
          type="button"
          onClick={() => setActive(false)}
        >
          Set tab away
        </button>
        <button
          className={buttonClassName}
          type="button"
          onClick={() => {
            for (let index = 0; index < count; index += 1) {
              queueForReturn({
                id: `queued-${overflow ? "overflow" : "batch"}-${index}`,
                title: `Queued notification ${index + 1}`,
                description: "Deterministic activity received while away.",
                source: "Fixture",
                createdAt: 1_735_689_600_000 + index,
              });
            }
          }}
        >
          Queue {count}
        </button>
        <button
          className={buttonClassName}
          type="button"
          onClick={() => setActive(true)}
        >
          Return to tab
        </button>
        <button
          className={buttonClassName}
          type="button"
          onClick={() =>
            notify({
              id: "fixture-immediate",
              title: "Immediate notification",
              description: "Published while this tab is active.",
              source: "Fixture",
            })
          }
        >
          Add now
        </button>
      </div>
      <span className="sr-only">
        Controlled tab is {active ? "active" : "away"}
      </span>
    </div>
  );
}

export function WhileAwayDefaultFixture() {
  return (
    <WhileAwayNotificationsProvider initialNotifications={fixtureSeed}>
      <DefaultFixtureControls />
      <Toaster position="top-right" />
    </WhileAwayNotificationsProvider>
  );
}

export function WhileAwayCatchUpFixture() {
  return <ControlledFixture />;
}

export function WhileAwayDigestFixture() {
  return <ControlledFixture overflow />;
}

export function WhileAwayEmptyFixture() {
  return (
    <WhileAwayNotificationsProvider>
      <NotificationCenter />
      <Toaster position="top-right" />
    </WhileAwayNotificationsProvider>
  );
}
