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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  createNotificationItem,
  getUnreadCount,
  type NotificationTone,
  notificationReducer,
  sortNotificationsForCenter,
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
  markSeen: (ids: readonly string[]) => void;
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

const notificationRailStyles = {
  neutral: "bg-muted-foreground",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  info: "bg-sky-500",
} as const;

function NotificationStatusRail({
  tone,
}: {
  tone: keyof typeof notificationRailStyles;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block h-4 w-0.5 rounded-full",
        notificationRailStyles[tone],
      )}
      data-slot="notification-status-rail"
    />
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
      const id = toast(notification.title, {
        action: {
          label: "Open",
          onClick: () => setCenterOpen(true),
        },
        description: notification.description,
        duration: toastDurationMs,
        icon: <NotificationStatusRail tone={notification.tone ?? "neutral"} />,
        onDismiss: (t) => activeToastIdsRef.current.delete(t.id),
        onAutoClose: (t) => activeToastIdsRef.current.delete(t.id),
        testId: `notification-toast-${notification.id}`,
      });
      activeToastIdsRef.current.add(id);
    },
    [setCenterOpen, toastDurationMs],
  );

  const presentDigest = useCallback(
    (notifications: readonly WhileAwayNotificationItem[]) => {
      if (centerOpenRef.current) return;
      const id = toast(
        `${notifications.length} notifications while you were away`,
        {
          action: {
            label: "View all",
            onClick: () => setCenterOpen(true),
          },
          description: notifications
            .slice(0, 2)
            .map((notification) => notification.title)
            .join(" · "),
          duration: toastDurationMs + 1500,
          icon: <NotificationStatusRail tone="info" />,
          onDismiss: (t) => activeToastIdsRef.current.delete(t.id),
          onAutoClose: (t) => activeToastIdsRef.current.delete(t.id),
          testId: "notification-digest",
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

  const markSeen = useCallback((ids: readonly string[]) => {
    if (ids.length === 0) return;
    dispatch({ type: "mark-seen", ids });
  }, []);

  const openNotification = useCallback(
    (notification: WhileAwayNotificationItem) => {
      markRead(notification.id);
      onNotificationOpen?.(notification);
    },
    [markRead, onNotificationOpen],
  );

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
      markSeen,
      openNotification,
    }),
    [
      centerOpen,
      markAllRead,
      markRead,
      markSeen,
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

type NotificationListItemProps = {
  centerOpen: boolean;
  clock: number | null;
  notification: WhileAwayNotificationItem;
  onOpen: (notification: WhileAwayNotificationItem) => void;
  onSeen: (ids: readonly string[]) => void;
  showSeparator: boolean;
};

function NotificationListItem({
  centerOpen,
  clock,
  notification,
  onOpen,
  onSeen,
  showSeparator,
}: NotificationListItemProps) {
  const itemRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!centerOpen || !notification.isNew) return;

    const item = itemRef.current;
    const viewport = item?.closest('[data-slot="scroll-area-viewport"]');
    if (!item || !viewport || typeof IntersectionObserver === "undefined") {
      return;
    }

    let viewed = false;
    let cleared = false;
    const clearNewLabel = () => {
      if (!viewed || cleared) return;
      cleared = true;
      onSeen([notification.id]);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && entry.intersectionRatio >= 0.75) {
          viewed = true;
          return;
        }

        if (entry && !entry.isIntersecting) clearNewLabel();
      },
      { root: viewport, threshold: [0, 0.75] },
    );

    observer.observe(item);
    return () => {
      observer.disconnect();
      clearNewLabel();
    };
  }, [centerOpen, notification.id, notification.isNew, onSeen]);

  return (
    <li ref={itemRef}>
      <Item
        className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-3 rounded-lg px-3 pt-2 pb-3 text-left hover:bg-muted/60 focus-visible:z-10 focus-visible:bg-muted"
        data-new={notification.isNew || undefined}
        data-notification-id={notification.id}
        data-read={notification.read || undefined}
        onClick={() => onOpen(notification)}
        render={<button type="button" />}
        size="xs"
      >
        <ItemMedia className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
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
        </ItemMedia>
        <ItemContent className="min-w-0 gap-0.5">
          <ItemTitle
            className={cn(
              "text-xs leading-5 font-normal",
              notification.read ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {notification.title}
          </ItemTitle>
          {notification.description ? (
            <ItemDescription className="text-xs leading-4">
              {notification.description}
            </ItemDescription>
          ) : null}
          {notification.source ? (
            <span className="mt-1 block text-xs text-subtle">
              {notification.source}
            </span>
          ) : null}
        </ItemContent>
        <ItemActions className="min-w-10 flex-col items-end gap-1.5 self-start pt-0.5">
          <span className="font-mono text-xs text-subtle">
            {formatNotificationTime(notification.createdAt, clock)}
          </span>
          {notification.isNew ? (
            <Badge className="font-mono text-xs tracking-wide">NEW</Badge>
          ) : null}
        </ItemActions>
      </Item>
      {showSeparator ? <ItemSeparator className="my-0" /> : null}
    </li>
  );
}

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
    markSeen,
    openNotification,
  } = useWhileAwayNotifications();
  const [clock, setClock] = useState<number | null>(null);
  const [notificationOrder, setNotificationOrder] = useState<readonly string[]>(
    [],
  );

  useEffect(() => {
    if (!centerOpen) return;
    const updateClock = () => setClock(Date.now());
    updateClock();
    const timer = setInterval(updateClock, 60_000);
    return () => clearInterval(timer);
  }, [centerOpen]);

  useEffect(() => {
    if (!centerOpen) {
      setNotificationOrder((currentOrder) =>
        currentOrder.length === 0 ? currentOrder : [],
      );
      return;
    }

    setNotificationOrder((currentOrder) => {
      const sortedIds = sortNotificationsForCenter(notifications).map(
        (notification) => notification.id,
      );
      const availableIds = new Set(sortedIds);
      const currentIds = new Set(currentOrder);
      const incomingIds = sortedIds.filter((id) => !currentIds.has(id));
      const nextOrder = [
        ...incomingIds,
        ...currentOrder.filter((id) => availableIds.has(id)),
      ];

      return nextOrder.length === currentOrder.length &&
        nextOrder.every((id, index) => id === currentOrder[index])
        ? currentOrder
        : nextOrder;
    });
  }, [centerOpen, notifications]);

  const orderedNotifications = useMemo(() => {
    const sortedNotifications = sortNotificationsForCenter(notifications);
    if (!centerOpen || notificationOrder.length === 0) {
      return sortedNotifications;
    }

    const notificationsById = new Map(
      notifications.map((notification) => [notification.id, notification]),
    );
    const ordered = notificationOrder.flatMap((id) => {
      const notification = notificationsById.get(id);
      return notification ? [notification] : [];
    });
    const orderedIds = new Set(notificationOrder);

    return [
      ...ordered,
      ...sortedNotifications.filter(
        (notification) => !orderedIds.has(notification.id),
      ),
    ];
  }, [centerOpen, notificationOrder, notifications]);

  const badge = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <Popover onOpenChange={setCenterOpen} open={centerOpen}>
      <PopoverTrigger
        aria-label={
          unreadCount === 0
            ? "Open notifications"
            : `Open notifications, ${unreadCount} unread`
        }
        render={
          <Button
            className={cn("relative rounded-lg", className)}
            size="icon-lg"
            variant="outline"
          />
        }
      >
        <Bell aria-hidden="true" className="size-4" />
        {unreadCount > 0 ? (
          <Badge className="absolute -right-1 -top-1 h-5 min-w-5 px-1 font-mono text-xs font-semibold leading-none ring-2 ring-background">
            {badge}
          </Badge>
        ) : null}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(23rem,calc(100vw-2rem))] origin-(--transform-origin) gap-0 overflow-hidden rounded-4xl p-0 shadow-xl transition-[opacity,transform] duration-180 ease-[cubic-bezier(0.23,1,0.32,1)] data-closed:animate-none data-closed:opacity-0 data-closed:scale-[0.97] data-ending-style:opacity-0 data-ending-style:scale-[0.97] data-open:animate-none data-starting-style:opacity-0 data-starting-style:scale-[0.97] motion-reduce:transform-none motion-reduce:transition-opacity"
        data-notification-center
      >
        <div
          className="flex items-center justify-between gap-3 border-b border-border pl-(--radius-4xl) pr-4 py-4"
          data-notification-center-header
        >
          <PopoverHeader className="min-w-0 gap-0.5">
            <PopoverTitle className="text-sm font-semibold">
              {title}
            </PopoverTitle>
          </PopoverHeader>
          {unreadCount > 0 ? (
            <Button
              onClick={markAllRead}
              size="xs"
              type="button"
              variant="ghost"
            >
              Mark all read
            </Button>
          ) : null}
        </div>

        {notifications.length === 0 ? (
          <Empty className="min-h-52 rounded-none border-0 px-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Inbox aria-hidden="true" className="size-4" />
              </EmptyMedia>
              <EmptyTitle>{emptyMessage}</EmptyTitle>
              <EmptyDescription className="max-w-52 text-xs leading-5">
                New activity will stay in this tab until you return.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ScrollArea
            className="max-h-[min(22rem,calc(100dvh-7rem))] overscroll-contain **:data-[slot=scroll-area-viewport]:max-h-[min(22rem,calc(100dvh-7rem))]"
            data-notification-scroll-area
          >
            <ItemGroup aria-label="Notification list">
              {orderedNotifications.map((notification) => (
                <NotificationListItem
                  centerOpen={centerOpen}
                  clock={clock}
                  key={notification.id}
                  notification={notification}
                  onOpen={openNotification}
                  onSeen={markSeen}
                  showSeparator={false}
                />
              ))}
            </ItemGroup>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
