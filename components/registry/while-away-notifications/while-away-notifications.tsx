"use client";

import { Bell, Check, Inbox } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  createNotificationItem,
  getUnreadCount,
  type NotificationTone,
  notificationReducer,
  type WhileAwayNotification,
  type WhileAwayNotificationItem,
  type WhileAwayNotificationSeed,
} from "./notification-state";

export type TabAttentionPhase =
  | "active"
  | "pending-away"
  | "away"
  | "returning";

export type WhileAwayNotificationsProviderProps = {
  children: ReactNode;
  initialNotifications?: readonly WhileAwayNotificationSeed[];
  active?: boolean;
  awayThresholdMs?: number;
  settleDelayMs?: number;
  maxCatchUpToasts?: number;
  toastDurationMs?: number;
  onNotificationOpen?: (notification: WhileAwayNotificationItem) => void;
  retentionLimit?: number;
};

type WhileAwayNotificationsContextValue = {
  notifications: readonly WhileAwayNotificationItem[];
  unreadCount: number;
  phase: TabAttentionPhase;
  centerOpen: boolean;
  setCenterOpen: (open: boolean) => void;
  notify: (notification: WhileAwayNotification) => boolean;
  queueForReturn: (notification: WhileAwayNotification) => boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
  openNotification: (notification: WhileAwayNotificationItem) => void;
};

const WhileAwayNotificationsContext =
  createContext<WhileAwayNotificationsContextValue | null>(null);

function readBrowserTabActive() {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible" && document.hasFocus();
}

function useBrowserTabActive() {
  const [active, setActive] = useState(true);

  useEffect(() => {
    const update = () => setActive(readBrowserTabActive());

    update();
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    window.addEventListener("blur", update);
    window.addEventListener("pageshow", update);

    return () => {
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
      window.removeEventListener("blur", update);
      window.removeEventListener("pageshow", update);
    };
  }, []);

  return active;
}

function toneDotClassName(tone: NotificationTone | undefined) {
  if (tone === "success") return "bg-emerald-500";
  if (tone === "warning") return "bg-amber-500";
  return "bg-foreground/70";
}

function NotificationToast({
  notification,
  onOpen,
}: {
  notification: WhileAwayNotificationItem;
  onOpen: () => void;
}) {
  return (
    <div
      className="w-[min(23rem,calc(100vw-2rem))] rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg"
      data-notification-toast={notification.id}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "mt-1.5 size-2 shrink-0 rounded-full",
            toneDotClassName(notification.tone),
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-5">{notification.title}</p>
          {notification.description ? (
            <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-muted-foreground">
              {notification.description}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground outline-none transition-[background-color,color,transform] duration-120 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]"
          onClick={onOpen}
        >
          Open
        </button>
      </div>
    </div>
  );
}

function CatchUpDigest({
  notifications,
  onOpen,
}: {
  notifications: readonly WhileAwayNotificationItem[];
  onOpen: () => void;
}) {
  return (
    <div
      className="w-[min(23rem,calc(100vw-2rem))] rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg"
      data-notification-digest={notifications.length}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <Bell aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {notifications.length} notifications while you were away
          </p>
          <div className="mt-1 space-y-0.5">
            {notifications.slice(0, 2).map((notification) => (
              <p
                className="truncate text-xs text-muted-foreground"
                key={notification.id}
              >
                {notification.title}
              </p>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground outline-none transition-[background-color,color,transform] duration-120 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]"
          onClick={onOpen}
        >
          View all
        </button>
      </div>
    </div>
  );
}

export function WhileAwayNotificationsProvider({
  children,
  initialNotifications = [],
  active,
  awayThresholdMs = 1500,
  settleDelayMs = 300,
  maxCatchUpToasts = 3,
  toastDurationMs = 5000,
  onNotificationOpen,
  retentionLimit = 30,
}: WhileAwayNotificationsProviderProps) {
  const initialItemsRef = useRef(
    initialNotifications
      .slice(0, retentionLimit)
      .map((notification) => createNotificationItem(notification)),
  );
  const [state, dispatch] = useReducer(notificationReducer, {
    items: initialItemsRef.current,
  });
  const [centerOpen, setCenterOpenState] = useState(false);
  const [phase, setPhaseState] = useState<TabAttentionPhase>("active");
  const browserActive = useBrowserTabActive();
  const tabActive = active ?? browserActive;
  const tabActiveRef = useRef(tabActive);
  const centerOpenRef = useRef(centerOpen);
  const phaseRef = useRef<TabAttentionPhase>(phase);
  const inactiveRef = useRef(false);
  const qualifiedAwayRef = useRef(false);
  const queuedRef = useRef<WhileAwayNotificationItem[]>([]);
  const knownIdsRef = useRef(
    new Set(initialItemsRef.current.map((notification) => notification.id)),
  );
  const activeToastIdsRef = useRef(new Set<string | number>());
  const presentationTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(
    new Set(),
  );
  const awayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const returnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  tabActiveRef.current = tabActive;
  centerOpenRef.current = centerOpen;

  const setPhase = useCallback((nextPhase: TabAttentionPhase) => {
    phaseRef.current = nextPhase;
    setPhaseState(nextPhase);
  }, []);

  const clearPresentationTimers = useCallback(() => {
    for (const timer of presentationTimersRef.current) clearTimeout(timer);
    presentationTimersRef.current.clear();
  }, []);

  const dismissOwnToasts = useCallback(() => {
    clearPresentationTimers();
    for (const id of activeToastIdsRef.current) toast.dismiss(id);
    activeToastIdsRef.current.clear();
  }, [clearPresentationTimers]);

  const setCenterOpen = useCallback(
    (open: boolean) => {
      centerOpenRef.current = open;
      setCenterOpenState(open);
      if (open) dismissOwnToasts();
    },
    [dismissOwnToasts],
  );

  const presentNotification = useCallback(
    (notification: WhileAwayNotificationItem) => {
      if (centerOpenRef.current) return;
      const id = toast.custom(
        (toastId) => (
          <NotificationToast
            notification={notification}
            onOpen={() => {
              setCenterOpen(true);
              toast.dismiss(toastId);
            }}
          />
        ),
        {
          duration: toastDurationMs,
          onDismiss: (t) => activeToastIdsRef.current.delete(t.id),
          onAutoClose: (t) => activeToastIdsRef.current.delete(t.id),
        },
      );
      activeToastIdsRef.current.add(id);
    },
    [setCenterOpen, toastDurationMs],
  );

  const presentDigest = useCallback(
    (notifications: readonly WhileAwayNotificationItem[]) => {
      if (centerOpenRef.current) return;
      const id = toast.custom(
        (toastId) => (
          <CatchUpDigest
            notifications={notifications}
            onOpen={() => {
              setCenterOpen(true);
              toast.dismiss(toastId);
            }}
          />
        ),
        {
          duration: toastDurationMs + 1500,
          onDismiss: (t) => activeToastIdsRef.current.delete(t.id),
          onAutoClose: (t) => activeToastIdsRef.current.delete(t.id),
        },
      );
      activeToastIdsRef.current.add(id);
    },
    [setCenterOpen, toastDurationMs],
  );

  const flushQueue = useCallback(
    (catchUp: boolean) => {
      const notifications = queuedRef.current.splice(0);
      if (notifications.length === 0 || centerOpenRef.current) return;

      if (catchUp && notifications.length > maxCatchUpToasts) {
        presentDigest(notifications);
        return;
      }

      notifications.forEach((notification, index) => {
        const timer = setTimeout(
          () => {
            presentationTimersRef.current.delete(timer);
            presentNotification(notification);
          },
          catchUp ? index * 40 : 0,
        );
        presentationTimersRef.current.add(timer);
      });
    },
    [maxCatchUpToasts, presentDigest, presentNotification],
  );

  const addNotification = useCallback(
    (notification: WhileAwayNotification, forceQueue: boolean) => {
      if (knownIdsRef.current.has(notification.id)) return false;

      const item = createNotificationItem(notification);
      knownIdsRef.current.add(item.id);

      // Keep knownIdsRef in sync with the retention limit by removing evicted IDs
      if (state.items.length >= retentionLimit) {
        const evictCount = state.items.length + 1 - retentionLimit;
        for (let i = 0; i < evictCount; i++) {
          const evictedItem = state.items[state.items.length - 1 - i];
          if (evictedItem) {
            knownIdsRef.current.delete(evictedItem.id);
          }
        }
      }

      dispatch({ type: "add", item, retentionLimit });

      const shouldQueue =
        forceQueue || !tabActiveRef.current || phaseRef.current !== "active";
      if (shouldQueue) {
        queuedRef.current.push(item);
        if (queuedRef.current.length > retentionLimit) {
          queuedRef.current.shift();
        }
      } else {
        presentNotification(item);
      }

      return true;
    },
    [presentNotification, state.items, retentionLimit],
  );

  const notify = useCallback(
    (notification: WhileAwayNotification) =>
      addNotification(notification, false),
    [addNotification],
  );

  const queueForReturn = useCallback(
    (notification: WhileAwayNotification) =>
      addNotification(notification, true),
    [addNotification],
  );

  const markRead = useCallback((id: string) => {
    dispatch({ type: "mark-read", id });
  }, []);

  const markAllRead = useCallback(() => {
    dispatch({ type: "mark-all-read" });
  }, []);

  const openNotification = useCallback(
    (notification: WhileAwayNotificationItem) => {
      markRead(notification.id);
      onNotificationOpen?.(notification);
    },
    [markRead, onNotificationOpen],
  );

  useEffect(() => {
    if (!centerOpen) return;
    const newIds = state.items
      .filter((notification) => notification.isNew)
      .map((notification) => notification.id);
    if (newIds.length === 0) return;

    const timer = setTimeout(() => {
      dispatch({ type: "mark-seen", ids: newIds });
    }, 800);
    return () => clearTimeout(timer);
  }, [centerOpen, state.items]);

  useEffect(() => {
    if (!tabActive) {
      if (returnTimerRef.current) clearTimeout(returnTimerRef.current);
      inactiveRef.current = true;
      qualifiedAwayRef.current = false;
      setPhase("pending-away");

      if (awayThresholdMs <= 0) {
        qualifiedAwayRef.current = true;
        setPhase("away");
      } else {
        awayTimerRef.current = setTimeout(() => {
          if (!inactiveRef.current) return;
          qualifiedAwayRef.current = true;
          setPhase("away");
        }, awayThresholdMs);
      }
      return;
    }

    if (awayTimerRef.current) clearTimeout(awayTimerRef.current);
    if (!inactiveRef.current) {
      setPhase("active");
      return;
    }

    const catchUp = qualifiedAwayRef.current;
    inactiveRef.current = false;
    qualifiedAwayRef.current = false;

    const completeReturn = () => {
      flushQueue(catchUp);
      setPhase("active");
    };

    if (catchUp && settleDelayMs > 0) {
      setPhase("returning");
      returnTimerRef.current = setTimeout(completeReturn, settleDelayMs);
    } else {
      completeReturn();
    }
  }, [awayThresholdMs, flushQueue, setPhase, settleDelayMs, tabActive]);

  useEffect(
    () => () => {
      if (awayTimerRef.current) clearTimeout(awayTimerRef.current);
      if (returnTimerRef.current) clearTimeout(returnTimerRef.current);
      clearPresentationTimers();
    },
    [clearPresentationTimers],
  );

  const value = useMemo<WhileAwayNotificationsContextValue>(
    () => ({
      notifications: state.items,
      unreadCount: getUnreadCount(state.items),
      phase,
      centerOpen,
      setCenterOpen,
      notify,
      queueForReturn,
      markRead,
      markAllRead,
      openNotification,
    }),
    [
      centerOpen,
      markAllRead,
      markRead,
      notify,
      openNotification,
      phase,
      queueForReturn,
      setCenterOpen,
      state.items,
    ],
  );

  return (
    <WhileAwayNotificationsContext.Provider value={value}>
      {children}
    </WhileAwayNotificationsContext.Provider>
  );
}

export function useWhileAwayNotifications() {
  const context = useContext(WhileAwayNotificationsContext);
  if (!context) {
    throw new Error(
      "useWhileAwayNotifications must be used within WhileAwayNotificationsProvider.",
    );
  }
  return context;
}

function formatNotificationTime(createdAt: number, now: number | null) {
  if (now === null) return "recent";
  const elapsedSeconds = Math.max(0, Math.floor((now - createdAt) / 1000));
  if (elapsedSeconds < 60) return "now";
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return `${elapsedMinutes}m`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h`;
  return `${Math.floor(elapsedHours / 24)}d`;
}

export type NotificationCenterProps = {
  className?: string;
  title?: string;
  emptyMessage?: string;
};

export function NotificationCenter({
  className,
  title = "Notifications",
  emptyMessage = "You're all caught up.",
}: NotificationCenterProps) {
  const {
    notifications,
    unreadCount,
    centerOpen,
    setCenterOpen,
    markAllRead,
    openNotification,
  } = useWhileAwayNotifications();
  const [clock, setClock] = useState<number | null>(null);

  useEffect(() => {
    if (!centerOpen) return;
    const updateClock = () => setClock(Date.now());
    updateClock();
    const timer = setInterval(updateClock, 60_000);
    return () => clearInterval(timer);
  }, [centerOpen]);

  const badge = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <Popover onOpenChange={setCenterOpen} open={centerOpen}>
      <PopoverTrigger
        aria-label={
          unreadCount === 0
            ? "Open notifications"
            : `Open notifications, ${unreadCount} unread`
        }
        className={cn(
          "relative inline-flex size-10 items-center justify-center rounded-full border border-border bg-background text-foreground outline-none transition-[background-color,transform,box-shadow] duration-120 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]",
          className,
        )}
      >
        <Bell aria-hidden="true" className="size-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-foreground px-1 font-mono text-[9px] font-semibold leading-4 text-background ring-2 ring-background">
            {badge}
          </span>
        ) : null}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(23rem,calc(100vw-2rem))] origin-(--transform-origin) gap-0 overflow-hidden rounded-2xl p-0 shadow-xl transition-[opacity,transform] duration-180 ease-[cubic-bezier(0.23,1,0.32,1)] data-closed:animate-none data-closed:opacity-0 data-closed:scale-[0.97] data-ending-style:opacity-0 data-ending-style:scale-[0.97] data-open:animate-none data-starting-style:opacity-0 data-starting-style:scale-[0.97] motion-reduce:transform-none motion-reduce:transition-opacity"
        data-notification-center
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <PopoverTitle className="text-sm font-semibold">
              {title}
            </PopoverTitle>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {unreadCount === 0
                ? "No unread notifications"
                : `${unreadCount} unread`}
            </p>
          </div>
          {unreadCount > 0 ? (
            <button
              type="button"
              className="rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground outline-none transition-[background-color,color,transform] duration-120 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]"
              onClick={markAllRead}
            >
              Mark all read
            </button>
          ) : null}
        </div>

        {notifications.length === 0 ? (
          <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Inbox aria-hidden="true" className="size-4" />
            </span>
            <p className="mt-3 text-sm font-medium">{emptyMessage}</p>
            <p className="mt-1 max-w-52 text-xs leading-5 text-muted-foreground">
              New activity will stay in this tab until you return.
            </p>
          </div>
        ) : (
          <ul
            aria-label="Notification list"
            className="max-h-[22rem] overflow-y-auto overscroll-contain py-1"
          >
            {notifications.map((notification) => (
              <li key={notification.id}>
                <button
                  type="button"
                  className="group grid w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-3 px-4 py-3 text-left outline-none transition-[background-color,transform] duration-120 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-muted/70 focus-visible:bg-muted active:scale-[0.99]"
                  data-new={notification.isNew || undefined}
                  data-notification-id={notification.id}
                  data-read={notification.read || undefined}
                  onClick={() => openNotification(notification)}
                >
                  <span className="relative flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    {notification.read ? (
                      <Check aria-hidden="true" className="size-3.5" />
                    ) : (
                      <span
                        aria-hidden="true"
                        className={cn(
                          "size-2 rounded-full",
                          toneDotClassName(notification.tone),
                        )}
                      />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cn(
                        "block truncate text-xs leading-5",
                        notification.read
                          ? "font-normal text-muted-foreground"
                          : "font-medium text-foreground",
                      )}
                    >
                      {notification.title}
                    </span>
                    {notification.description ? (
                      <span className="mt-0.5 line-clamp-2 block text-[11px] leading-4 text-muted-foreground">
                        {notification.description}
                      </span>
                    ) : null}
                    {notification.source ? (
                      <span className="mt-1 block text-[10px] text-subtle">
                        {notification.source}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex min-w-10 flex-col items-end gap-1.5 pt-0.5">
                    <span className="font-mono text-[9px] text-subtle">
                      {formatNotificationTime(notification.createdAt, clock)}
                    </span>
                    {notification.isNew ? (
                      <span className="rounded-full bg-foreground px-1.5 py-0.5 font-mono text-[8px] font-semibold tracking-wide text-background">
                        NEW
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
