"use client";

import { BellRing, Plus } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  NotificationCenter,
  useWhileAwayNotifications,
  WhileAwayNotificationsProvider,
} from "@/components/registry/while-away-notifications";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  const queuedForCurrentAwayRef = useRef(false);

  useEffect(() => {
    if (phase === "active") {
      queuedForCurrentAwayRef.current = false;
      return;
    }

    if (phase !== "away" || queuedForCurrentAwayRef.current) return;

    queuedForCurrentAwayRef.current = true;
    const index = wakeIndexRef.current;
    const notification = wakeNotifications[index % wakeNotifications.length];
    wakeIndexRef.current += 1;
    queueForReturn({
      ...notification,
      id: `wake-${Date.now()}-${index}`,
      createdAt: Date.now(),
    });
  }, [phase, queueForReturn]);

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
    <Card
      className="w-full max-w-md rounded-3xl shadow-sm"
      data-notification-preview-card
      size="sm"
    >
      <CardHeader
        className="grid-rows-[auto]! gap-0 border-b"
        data-notification-preview-header
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <BellRing aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0">
            <CardTitle>Notification demo</CardTitle>
            <CardDescription className="mt-0.5 text-xs">
              Activity received by this browser tab
            </CardDescription>
          </div>
        </div>
        <CardAction className="self-center">
          <NotificationCenter />
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-3 px-(--radius-3xl) py-2">
        <Badge
          className="gap-1.5 font-normal text-muted-foreground"
          variant="outline"
        >
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-emerald-500"
          />
          Tab scoped · {phaseLabel}
        </Badge>

        <div className="space-y-1.5">
          <p className="max-w-sm text-sm leading-6 text-foreground">
            Switch tabs for two seconds. A temporary notification will be
            waiting when you return.
          </p>
          <p className="max-w-sm text-xs leading-5 text-muted-foreground">
            Reloading or closing this tab clears its demo queue.
          </p>
        </div>
      </CardContent>

      <CardFooter className="justify-between gap-3 rounded-b-[inherit] bg-muted/30 pl-(--radius-3xl)">
        <span className="text-xs text-muted-foreground">
          Preview an active-tab alert
        </span>
        <Button onClick={addNow} size="sm" type="button" variant="outline">
          <Plus aria-hidden="true" data-icon="inline-start" />
          Add one now
        </Button>
      </CardFooter>
    </Card>
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
