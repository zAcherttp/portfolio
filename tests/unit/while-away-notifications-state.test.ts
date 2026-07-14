import { describe, expect, it } from "vitest";
import {
  createNotificationItem,
  getUnreadCount,
  notificationReducer,
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

  it("marks every notification read without clearing new labels", () => {
    const item = createNotificationItem({ id: "alert", title: "Alert" }, 1);
    const state = notificationReducer(
      { items: [item] },
      { type: "mark-all-read" },
    );

    expect(state.items[0]).toMatchObject({ read: true, isNew: true });
    expect(getUnreadCount(state.items)).toBe(0);
  });
});
