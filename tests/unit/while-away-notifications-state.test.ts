import { describe, expect, expectTypeOf, it } from "vitest";
import {
  createNotificationItem,
  getUnreadCount,
  type NotificationState,
  notificationReducer,
  sortNotificationsForCenter,
  type WhileAwayNotificationSeed,
} from "@/components/registry/while-away-notifications/notification-state";

describe("while-away notification state", () => {
  it("normalizes new unread notifications with a stable timestamp", () => {
    expect(
      createNotificationItem({ id: "deploy", title: "Deployment ready" }, 1234),
    ).toEqual({
      id: "deploy",
      title: "Deployment ready",
      createdAt: 1234,
      isNew: true,
      read: false,
    });
  });

  it("requires and preserves deterministic timestamps for initial items", () => {
    expectTypeOf<WhileAwayNotificationSeed>().toMatchTypeOf<{
      createdAt: number;
    }>();
    expect(
      createNotificationItem(
        { id: "seed", title: "Existing item", createdAt: 5678 },
        1234,
      ).createdAt,
    ).toBe(5678);
  });

  it("deduplicates stable notification IDs", () => {
    const item = createNotificationItem(
      { id: "comment", title: "New comment" },
      1234,
    );
    const state = notificationReducer({ items: [] }, { type: "add", item });

    expect(notificationReducer(state, { type: "add", item })).toBe(state);
  });

  it("keeps seen and read state independent", () => {
    const first = createNotificationItem({ id: "first", title: "First" }, 1);
    const second = createNotificationItem({ id: "second", title: "Second" }, 2);
    const initial = { items: [second, first] };
    const seen = notificationReducer(initial, {
      type: "mark-seen",
      ids: ["first"],
    });
    const read = notificationReducer(seen, {
      type: "mark-read",
      id: "second",
    });

    expect(read.items.find((item) => item.id === "first")).toMatchObject({
      isNew: false,
      read: false,
    });
    expect(read.items.find((item) => item.id === "second")).toMatchObject({
      isNew: true,
      read: true,
    });
    expect(getUnreadCount(read.items)).toBe(1);
  });

  it("marks every notification read and clears every new label", () => {
    const newItem = createNotificationItem(
      { id: "new-alert", title: "New alert" },
      1,
    );
    const readNewItem = createNotificationItem(
      { id: "read-new-alert", title: "Read new alert", read: true },
      2,
    );
    const state = notificationReducer(
      { items: [newItem, readNewItem] },
      { type: "mark-all-read" },
    );

    expect(state.items).toEqual([
      expect.objectContaining({ id: "new-alert", read: true, isNew: false }),
      expect.objectContaining({
        id: "read-new-alert",
        read: true,
        isNew: false,
      }),
    ]);
    expect(getUnreadCount(state.items)).toBe(0);
  });

  it("sorts new notifications first without mutating the source list", () => {
    const notifications = [
      createNotificationItem(
        { id: "seen-newer", title: "Seen newer", isNew: false },
        4,
      ),
      createNotificationItem({ id: "new-older", title: "New older" }, 1),
      createNotificationItem(
        { id: "seen-older", title: "Seen older", isNew: false },
        2,
      ),
      createNotificationItem({ id: "new-newer", title: "New newer" }, 3),
    ];
    const originalOrder = notifications.map((notification) => notification.id);

    expect(
      sortNotificationsForCenter(notifications).map(
        (notification) => notification.id,
      ),
    ).toEqual(["new-newer", "new-older", "seen-newer", "seen-older"]);
    expect(notifications.map((notification) => notification.id)).toEqual(
      originalOrder,
    );
  });

  it("enforces retentionLimit by evicting oldest items", () => {
    const item1 = createNotificationItem({ id: "1", title: "First" }, 1);
    const item2 = createNotificationItem({ id: "2", title: "Second" }, 2);
    const item3 = createNotificationItem({ id: "3", title: "Third" }, 3);

    let state: NotificationState = { items: [] };
    state = notificationReducer(state, {
      type: "add",
      item: item1,
      retentionLimit: 2,
    });
    state = notificationReducer(state, {
      type: "add",
      item: item2,
      retentionLimit: 2,
    });
    expect(state.items).toHaveLength(2);
    expect(state.items[0].id).toBe("2");
    expect(state.items[1].id).toBe("1");

    state = notificationReducer(state, {
      type: "add",
      item: item3,
      retentionLimit: 2,
    });
    expect(state.items).toHaveLength(2);
    expect(state.items[0].id).toBe("3");
    expect(state.items[1].id).toBe("2");
  });
});
