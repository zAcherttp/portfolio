"use client";

import { BellRing, Plus } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  NotificationCenter,
  useWhileAwayNotifications,
  WhileAwayNotificationsProvider,
} from "@/components/registry/while-away-notifications";
import { Toaster } from "@/components/ui/sonner";

const wakeNotifications = [
  {
    title: "Mina mentioned you in Design",
    description: "Could you check the empty state before we ship?",
    source: "Workspace",
    tone: "neutral" as const,
  },
  {
    title: "Preview deployment is ready",
    description: "The latest changes passed all deployment checks.",
    source: "Deployments",
    tone: "success" as const,
  },
  {
    title: "Usage is nearing its limit",
    description: "Your workspace has used 82% of this month's allowance.",
    source: "Billing",
    tone: "warning" as const,
  },
] as const;

function PreviewControls() {
  const { notify, phase, queueForReturn } = useWhileAwayNotifications();
  const wakeIndexRef = useRef(0);
  const immediateIndexRef = useRef(0);

  useEffect(() => {
    const queueDemoNotification = () => {
      if (document.visibilityState !== "hidden") return;
      const index = wakeIndexRef.current;
      const notification = wakeNotifications[index % wakeNotifications.length];
      wakeIndexRef.current += 1;
      queueForReturn({
        ...notification,
        id: `wake-${Date.now()}-${index}`,
        createdAt: Date.now(),
      });
    };

    document.addEventListener("visibilitychange", queueDemoNotification);
    return () =>
      document.removeEventListener("visibilitychange", queueDemoNotification);
  }, [queueForReturn]);

  const addNow = () => {
    const index = immediateIndexRef.current;
    const notification = wakeNotifications[index % wakeNotifications.length];
    immediateIndexRef.current += 1;
    notify({
      ...notification,
      id: `active-${Date.now()}-${index}`,
      createdAt: Date.now(),
    });
  };

  const phaseLabel =
    phase === "pending-away"
      ? "Waiting"
      : phase === "returning"
        ? "Returning"
        : phase === "away"
          ? "Away"
          : "Active";

  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <BellRing aria-hidden="true" className="size-4" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">
              Notification demo
            </p>
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-emerald-500"
              />
              Tab scoped · {phaseLabel}
            </div>
          </div>
        </div>
        <NotificationCenter />
      </div>

      <div className="px-4 py-5">
        <p className="max-w-sm text-sm leading-6 text-foreground">
          Switch to another tab for two seconds. A temporary notification will
          be waiting when you return.
        </p>
        <p className="mt-1.5 max-w-sm text-xs leading-5 text-muted-foreground">
          This tab owns its queue. Reloading or closing it clears the demo.
        </p>
        <button
          type="button"
          className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground outline-none transition-[background-color,transform,box-shadow] duration-120 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]"
          onClick={addNow}
        >
          <Plus aria-hidden="true" className="size-3.5" />
          Add one now
        </button>
      </div>
    </div>
  );
}

export function WhileAwayNotificationsPreview() {
  return (
    <WhileAwayNotificationsProvider
      initialNotifications={[
        {
          id: "preview-comment",
          title: "Leo left a comment",
          description: "The revised interaction feels much clearer.",
          source: "Prototype",
          createdAt: 1_752_451_200_000,
          isNew: false,
        },
        {
          id: "preview-archive",
          title: "Weekly archive completed",
          description: "28 projects were backed up successfully.",
          source: "System",
          createdAt: 1_752_447_600_000,
          isNew: false,
          read: true,
          tone: "success",
        },
      ]}
    >
      <PreviewControls />
      <Toaster expand position="top-right" visibleToasts={4} />
    </WhileAwayNotificationsProvider>
  );
}
