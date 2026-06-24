"use client";

import { useHotkey } from "@tanstack/react-hotkeys";
import { useCallback, useEffect, useRef, useState } from "react";

interface KeyEvent {
  id: number;
  type:
    | "keydown"
    | "keyup"
    | "compositionstart"
    | "compositionupdate"
    | "compositionend"
    | "hotkey";
  key: string;
  code: string;
  isComposing: boolean;
  compositionData?: string;
  timestamp: number;
  delta: number;
}

let eventId = 0;

export default function HotkeyDebugPage() {
  const [events, setEvents] = useState<KeyEvent[]>([]);
  const lastTimestamp = useRef<number>(Date.now());

  const push = useCallback((e: Omit<KeyEvent, "id" | "delta">) => {
    const now = Date.now();
    const delta = now - lastTimestamp.current;
    lastTimestamp.current = now;
    setEvents((prev) => [{ ...e, id: eventId++, delta }, ...prev].slice(0, 80));
  }, []);

  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "d" && e.key !== "đ") return;
      push({
        type: "keydown",
        key: e.key,
        code: e.code,
        isComposing: e.isComposing,
        timestamp: e.timeStamp,
      });
    };
    const onKeyup = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "d" && e.key !== "đ") return;
      push({
        type: "keyup",
        key: e.key,
        code: e.code,
        isComposing: e.isComposing,
        timestamp: e.timeStamp,
      });
    };
    const onCompositionStart = (e: CompositionEvent) => {
      push({
        type: "compositionstart",
        key: "",
        code: "",
        isComposing: true,
        compositionData: e.data,
        timestamp: e.timeStamp,
      });
    };
    const onCompositionUpdate = (e: CompositionEvent) => {
      push({
        type: "compositionupdate",
        key: "",
        code: "",
        isComposing: true,
        compositionData: e.data,
        timestamp: e.timeStamp,
      });
    };
    const onCompositionEnd = (e: CompositionEvent) => {
      push({
        type: "compositionend",
        key: "",
        code: "",
        isComposing: false,
        compositionData: e.data,
        timestamp: e.timeStamp,
      });
    };

    window.addEventListener("keydown", onKeydown, { capture: true });
    window.addEventListener("keyup", onKeyup, { capture: true });
    window.addEventListener("compositionstart", onCompositionStart, {
      capture: true,
    });
    window.addEventListener("compositionupdate", onCompositionUpdate, {
      capture: true,
    });
    window.addEventListener("compositionend", onCompositionEnd, {
      capture: true,
    });

    return () => {
      window.removeEventListener("keydown", onKeydown, { capture: true });
      window.removeEventListener("keyup", onKeyup, { capture: true });
      window.removeEventListener("compositionstart", onCompositionStart, {
        capture: true,
      });
      window.removeEventListener("compositionupdate", onCompositionUpdate, {
        capture: true,
      });
      window.removeEventListener("compositionend", onCompositionEnd, {
        capture: true,
      });
    };
  }, [push]);

  useHotkey(
    "D",
    (event) => {
      push({
        type: "hotkey",
        key: event.key,
        code: event.code,
        isComposing: event.isComposing,
        timestamp: event.timeStamp,
      });
    },
    { ignoreInputs: false, preventDefault: false, stopPropagation: false },
  );

  const typeColor: Record<KeyEvent["type"], string> = {
    keydown: "#60a5fa",
    keyup: "#94a3b8",
    compositionstart: "#f59e0b",
    compositionupdate: "#fb923c",
    compositionend: "#facc15",
    hotkey: "#4ade80",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0f0f13",
        color: "#e2e8f0",
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        padding: "2rem",
      }}
    >
      <h1
        style={{
          fontSize: "1.25rem",
          fontWeight: 700,
          marginBottom: "0.25rem",
          color: "#f8fafc",
        }}
      >
        {"🔍 Hotkey IME Debug — "}
        <kbd
          style={{
            background: "#1e293b",
            padding: "2px 8px",
            borderRadius: 4,
            fontSize: "1rem",
          }}
        >
          D
        </kbd>
      </h1>
      <p
        style={{
          fontSize: "0.8rem",
          color: "#64748b",
          marginBottom: "1.5rem",
        }}
      >
        Type <strong style={{ color: "#94a3b8" }}>d</strong> or{" "}
        <strong style={{ color: "#94a3b8" }}>dd (Telex → đ)</strong> anywhere.
        Focus the textarea to test IME composition. Rows highlighted in{" "}
        <span style={{ color: "#f87171" }}>red</span> have{" "}
        <code
          style={{ background: "#1e293b", padding: "1px 5px", borderRadius: 3 }}
        >
          code=""
        </code>
        {
          " — these are synthetic Telex replay events; the fix now blocks them. Events with "
        }
        <span style={{ color: "#4ade80" }}>hotkey</span> show when useHotkey
        fires.
      </p>

      <textarea
        placeholder="Focus here and type 'd' / 'dd' in Telex to watch composition events..."
        style={{
          width: "100%",
          maxWidth: 640,
          height: 72,
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: 8,
          color: "#f1f5f9",
          padding: "0.75rem",
          fontSize: "0.9rem",
          fontFamily: "inherit",
          outline: "none",
          resize: "vertical",
          marginBottom: "1.5rem",
          display: "block",
        }}
      />

      <div
        style={{
          display: "flex",
          gap: "1rem",
          flexWrap: "wrap",
          marginBottom: "1rem",
          fontSize: "0.72rem",
        }}
      >
        {(Object.entries(typeColor) as [KeyEvent["type"], string][]).map(
          ([type, color]) => (
            <span
              key={type}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: color,
                  display: "inline-block",
                }}
              />
              {type}
            </span>
          ),
        )}
      </div>

      <div
        style={{
          maxWidth: 900,
          background: "#0a0a0f",
          border: "1px solid #1e293b",
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1.2fr 1fr 1.2fr 1.5fr 0.7fr",
            padding: "0.5rem 1rem",
            background: "#12121a",
            borderBottom: "1px solid #1e293b",
            fontSize: "0.68rem",
            color: "#475569",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          <span>type</span>
          <span>key</span>
          <span>code</span>
          <span>isComposing</span>
          <span>compositionData</span>
          <span>+ms</span>
        </div>

        {events.length === 0 && (
          <div
            style={{
              padding: "2rem",
              textAlign: "center",
              color: "#334155",
              fontSize: "0.85rem",
            }}
          >
            Waiting for keystrokes…
          </div>
        )}

        {events.map((e) => (
          <div
            key={e.id}
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1.2fr 1fr 1.2fr 1.5fr 0.7fr",
              padding: "0.38rem 1rem",
              borderBottom: "1px solid #0f172a",
              fontSize: "0.76rem",
              alignItems: "center",
              background:
                e.type === "hotkey"
                  ? "rgba(74,222,128,0.06)"
                  : e.type === "keydown" && !e.code
                    ? "rgba(248,113,113,0.08)"
                    : "transparent",
            }}
          >
            <span
              style={{
                color: typeColor[e.type],
                fontWeight: e.type === "hotkey" ? 700 : 400,
              }}
            >
              {e.type === "hotkey" && "🔥 "}
              {e.type}
            </span>
            <span style={{ color: "#f1f5f9" }}>
              {e.key ? JSON.stringify(e.key) : "—"}
            </span>
            <span
              style={{
                color: e.code ? "#94a3b8" : "#f87171",
                fontWeight: e.code ? 400 : 700,
              }}
            >
              {e.code || "∅ synthetic"}
            </span>
            <span
              style={{
                color: e.isComposing ? "#f59e0b" : "#475569",
                fontWeight: e.isComposing ? 700 : 400,
              }}
            >
              {String(e.isComposing)}
            </span>
            <span style={{ color: "#a78bfa" }}>
              {e.compositionData !== undefined
                ? JSON.stringify(e.compositionData)
                : "—"}
            </span>
            <span style={{ color: "#475569" }}>+{e.delta}ms</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          setEvents([]);
          eventId = 0;
        }}
        style={{
          marginTop: "1rem",
          padding: "0.4rem 1rem",
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: 6,
          color: "#94a3b8",
          cursor: "pointer",
          fontSize: "0.8rem",
          fontFamily: "inherit",
        }}
      >
        Clear log
      </button>
    </main>
  );
}
