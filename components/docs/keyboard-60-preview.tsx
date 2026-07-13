"use client";

import type { IndividualKey } from "@tanstack/react-hotkeys";
import { useEffect, useRef, useState } from "react";
import { Kbd } from "@/components/ui/kbd";

type PreviewKey = "ContextMenu" | "Fn";

type KeyDefinition = {
  id?: string;
  label: string;
  keyName?: IndividualKey;
  previewKey?: PreviewKey;
  units?: number;
};

const rows: KeyDefinition[][] = [
  [
    { label: "Esc", keyName: "Escape", units: 1.25 },
    ..."1234567890"
      .split("")
      .map((key) => ({ label: key, keyName: key as IndividualKey })),
    { label: "-", keyName: "-" },
    { label: "=", keyName: "=" },
    { label: "Backspace", keyName: "Backspace", units: 2.5 },
  ],
  [
    { label: "Tab", keyName: "Tab", units: 1.5 },
    ..."QWERTYUIOP"
      .split("")
      .map((key) => ({ label: key, keyName: key as IndividualKey })),
    { label: "[", keyName: "[" },
    { label: "]", keyName: "]" },
    { label: "\\", keyName: "\\", units: 1.5 },
  ],
  [
    { label: "Caps", units: 1.75 },
    ..."ASDFGHJKL"
      .split("")
      .map((key) => ({ label: key, keyName: key as IndividualKey })),
    { label: ";", keyName: ";" },
    { label: "'" },
    { label: "Enter", keyName: "Enter", units: 2.25 },
  ],
  [
    { id: "left-shift", label: "Shift", keyName: "Shift", units: 2.25 },
    ..."ZXCVBNM"
      .split("")
      .map((key) => ({ label: key, keyName: key as IndividualKey })),
    { label: ",", keyName: "," },
    { label: ".", keyName: "." },
    { label: "/", keyName: "/" },
    { id: "right-shift", label: "Shift", keyName: "Shift", units: 2.75 },
  ],
  [
    { id: "left-control", label: "Ctrl", keyName: "Control", units: 1.5 },
    { label: "Meta", keyName: "Meta", units: 1.5 },
    { id: "left-alt", label: "Alt", keyName: "Alt", units: 1.25 },
    { label: "Space", keyName: "Space", units: 6.25 },
    { id: "right-alt", label: "Alt", keyName: "Alt", units: 1.25 },
    { label: "Fn", previewKey: "Fn", units: 1.25 },
    { label: "Menu", previewKey: "ContextMenu", units: 1.5 },
    { id: "right-control", label: "Ctrl", keyName: "Control", units: 1.5 },
  ],
];

function KeyboardKey({
  keyName,
  label,
  previewKey,
  pressedKeys,
  units = 1,
}: KeyDefinition & { pressedKeys: ReadonlySet<PreviewKey> }) {
  const props = {
    className: "w-full min-w-0",
    style: { gridColumn: `span ${units * 4}` },
    children: label,
  };

  return keyName ? (
    <Kbd keyName={keyName} reactive {...props} />
  ) : (
    <Kbd
      pressed={previewKey ? pressedKeys.has(previewKey) : undefined}
      {...props}
    />
  );
}

export function Keyboard60Preview() {
  const menuInvocationUntilRef = useRef(0);
  const [pressedKeys, setPressedKeys] = useState<ReadonlySet<PreviewKey>>(
    new Set(),
  );
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);

  useEffect(() => {
    const resolvePreviewKey = (event: KeyboardEvent): PreviewKey | null => {
      if (
        event.key === "ContextMenu" ||
        event.code === "ContextMenu" ||
        (event.key === "F10" && event.shiftKey)
      ) {
        return "ContextMenu";
      }
      if (event.key === "Fn" || event.code === "Fn") return "Fn";
      return null;
    };

    const setPressed = (key: PreviewKey, pressed: boolean) => {
      setPressedKeys((current) => {
        const next = new Set(current);
        if (pressed) next.add(key);
        else next.delete(key);
        return next;
      });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = resolvePreviewKey(event);
      if (!key) return;
      if (key === "ContextMenu") {
        menuInvocationUntilRef.current = performance.now() + 250;
        event.preventDefault();
      }
      setPressed(key, true);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      const key = resolvePreviewKey(event);
      if (key) setPressed(key, false);
    };
    const handleBlur = () => setPressedKeys(new Set());
    const handleContextMenu = (event: MouseEvent) => {
      if (performance.now() > menuInvocationUntilRef.current) return;
      event.preventDefault();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    document.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("blur", handleBlur);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
      document.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  return (
    <div
      className="w-full min-w-0 overflow-x-auto py-2"
      data-ready={ready}
      data-testid="keyboard-60"
    >
      <div
        className="mx-auto grid w-96 min-w-96 gap-1"
        style={{ gridTemplateRows: `repeat(${rows.length}, 1.25rem)` }}
      >
        {rows.map((row, rowIndex) => (
          <div
            className={
              rowIndex === 0
                ? "grid grid-cols-[repeat(63,minmax(0,1fr))] gap-1"
                : rowIndex === rows.length - 1
                  ? "grid grid-cols-[repeat(64,minmax(0,1fr))] gap-1"
                  : "grid grid-cols-60 gap-1"
            }
            key={row[0].label}
          >
            {row.map((key) => (
              <KeyboardKey
                key={key.id ?? key.label}
                {...key}
                pressedKeys={pressedKeys}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
