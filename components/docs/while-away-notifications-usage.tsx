"use client";

import {
  NotificationCenter,
  WhileAwayNotificationsProvider,
} from "@/components/registry/while-away-notifications";
import { Toaster } from "@/components/ui/sonner";

export function WhileAwayNotificationsUsage() {
  return (
    <WhileAwayNotificationsProvider>
      <NotificationCenter />
      <Toaster position="top-right" />
    </WhileAwayNotificationsProvider>
  );
}
