export type NotificationTone = "neutral" | "success" | "warning";

export type WhileAwayNotification = {
  id: string;
  title: string;
  description?: string;
  source?: string;
  createdAt?: number;
  tone?: NotificationTone;
};

type WhileAwayNotificationInput = WhileAwayNotification & {
  isNew?: boolean;
  read?: boolean;
};

export type WhileAwayNotificationSeed = Omit<
  WhileAwayNotificationInput,
  "createdAt"
> & {
  createdAt: number;
};

export type WhileAwayNotificationItem = WhileAwayNotification & {
  createdAt: number;
  isNew: boolean;
  read: boolean;
};

export type NotificationState = {
  items: WhileAwayNotificationItem[];
};

export type NotificationAction =
  | { type: "add"; item: WhileAwayNotificationItem; retentionLimit?: number }
  | { type: "mark-read"; id: string }
  | { type: "mark-all-read" }
  | { type: "mark-seen"; ids: readonly string[] };

export function createNotificationItem(
  notification: WhileAwayNotificationInput,
  now?: number,
): WhileAwayNotificationItem {
  return {
    ...notification,
    createdAt: notification.createdAt ?? now ?? Date.now(),
    isNew: notification.isNew ?? true,
    read: notification.read ?? false,
  };
}

export function notificationReducer(
  state: NotificationState,
  action: NotificationAction,
): NotificationState {
  if (action.type === "add") {
    if (state.items.some((item) => item.id === action.item.id)) return state;
    const items = [action.item, ...state.items];
    if (
      action.retentionLimit !== undefined &&
      items.length > action.retentionLimit
    ) {
      return { items: items.slice(0, action.retentionLimit) };
    }
    return { items };
  }

  if (action.type === "mark-read") {
    return {
      items: state.items.map((item) =>
        item.id === action.id ? { ...item, read: true } : item,
      ),
    };
  }

  if (action.type === "mark-all-read") {
    return {
      items: state.items.map((item) =>
        item.read ? item : { ...item, read: true },
      ),
    };
  }

  const seenIds = new Set(action.ids);
  return {
    items: state.items.map((item) =>
      item.isNew && seenIds.has(item.id) ? { ...item, isNew: false } : item,
    ),
  };
}

export function getUnreadCount(items: readonly WhileAwayNotificationItem[]) {
  return items.reduce((count, item) => count + Number(!item.read), 0);
}
