"use client";

import type { IndividualKey } from "@tanstack/react-hotkeys";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Kbd } from "@/components/ui/kbd";
import {
  getThockSoundProfile,
  playThockSound,
  type ThockSoundProfile,
} from "@/utils/playThockSound";

type PreviewKey = "ContextMenu" | "Fn";

type KeyDefinition = {
  content?: ReactNode;
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
    {
      content: <ArrowLeft aria-hidden className="size-3" strokeWidth={1.75} />,
      label: "Backspace",
      keyName: "Backspace",
      units: 2.5,
    },
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
    { label: "Caps", keyName: "CapsLock" as IndividualKey, units: 1.75 },
    ..."ASDFGHJKL"
      .split("")
      .map((key) => ({ label: key, keyName: key as IndividualKey })),
    { label: ";", keyName: ";" },
    { label: "'", keyName: "'" as IndividualKey },
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
  content,
  previewKey,
  pressedKeys,
  units = 1,
}: KeyDefinition & { pressedKeys: ReadonlySet<string> }) {
  const props = {
    "aria-label": label,
    className: "w-full min-w-0",
    style: { gridColumn: `span ${units * 4}` },
    children: content ?? label,
  };

  const pressedKey = previewKey ?? keyName;
  return (
    <Kbd
      data-key={keyName}
      pressed={pressedKey ? pressedKeys.has(pressedKey) : undefined}
      {...props}
    />
  );
}

export function Keyboard60Preview() {
  const captureButtonRef = useRef<HTMLButtonElement>(null);
  const captureRegionRef = useRef<HTMLDivElement>(null);
  const keyboardRef = useRef<HTMLDivElement>(null);
  const menuInvocationUntilRef = useRef(0);
  const pressedSoundKeysRef = useRef(new Map<string, ThockSoundProfile>());
  const [captureEnabled, setCaptureEnabled] = useState(false);
  const [captureSupported, setCaptureSupported] = useState(false);
  const [pressedKeys, setPressedKeys] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [ready, setReady] = useState(false);

  const clearPressedKeys = useCallback(() => {
    pressedSoundKeysRef.current.clear();
    setPressedKeys(new Set());
  }, []);

  const releaseCapture = useCallback(
    (restoreFocus = false) => {
      clearPressedKeys();
      setCaptureEnabled(false);
      if (restoreFocus) {
        requestAnimationFrame(() => captureButtonRef.current?.focus());
      }
    },
    [clearPressedKeys],
  );

  useEffect(() => {
    setReady(true);
    if (!window.matchMedia) return;

    const capability = window.matchMedia(
      "(any-hover: hover) and (any-pointer: fine)",
    );
    const updateCapability = () => {
      setCaptureSupported(capability.matches);
      if (!capability.matches) releaseCapture();
    };
    updateCapability();
    capability.addEventListener("change", updateCapability);
    return () => capability.removeEventListener("change", updateCapability);
  }, [releaseCapture]);

  useEffect(() => {
    if (!captureEnabled) return;

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

    const resolvePressedKey = (event: KeyboardEvent) => {
      const previewKey = resolvePreviewKey(event);
      if (previewKey) return previewKey;
      if (event.key === " " || event.code === "Space") return "Space";
      return event.key.length === 1 ? event.key.toUpperCase() : event.key;
    };

    const setPressed = (key: string, pressed: boolean) => {
      setPressedKeys((current) => {
        if (current.has(key) === pressed) return current;
        const next = new Set(current);
        if (pressed) next.add(key);
        else next.delete(key);
        return next;
      });
    };

    const reconcileReleasedModifiers = (event: KeyboardEvent) => {
      const released = [
        {
          active: event.altKey,
          codes: ["AltLeft", "AltRight", "Alt"],
          key: "Alt",
        },
        {
          active: event.ctrlKey,
          codes: ["ControlLeft", "ControlRight", "Control"],
          key: "Control",
        },
        {
          active: event.metaKey,
          codes: ["MetaLeft", "MetaRight", "Meta"],
          key: "Meta",
        },
        {
          active: event.shiftKey,
          codes: ["ShiftLeft", "ShiftRight", "Shift"],
          key: "Shift",
        },
      ].filter((modifier) => !modifier.active);
      if (released.length === 0) return;

      for (const modifier of released) {
        for (const code of modifier.codes)
          pressedSoundKeysRef.current.delete(code);
      }
      setPressedKeys((current) => {
        const staleKeys = released
          .map((modifier) => modifier.key)
          .filter((key) => current.has(key));
        if (staleKeys.length === 0) return current;
        const next = new Set(current);
        for (const key of staleKeys) next.delete(key);
        return next;
      });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        releaseCapture(true);
        return;
      }
      reconcileReleasedModifiers(event);
      const isModifierKey = ["Alt", "Control", "Meta", "Shift"].includes(
        event.key,
      );
      const preservesBrowserShortcut =
        (event.altKey || event.ctrlKey || event.metaKey) && !isModifierKey;
      if (preservesBrowserShortcut) return;
      event.stopPropagation();

      const target = event.target;
      const targetKeepsSpace =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(
            target.tagName,
          ));
      const thockProfile = getThockSoundProfile(event.key, event.code);
      if (thockProfile) event.preventDefault();
      if ((event.key === " " || event.code === "Space") && targetKeepsSpace) {
        event.preventDefault();
      }
      const soundKey = event.code || event.key;
      if (
        !event.repeat &&
        thockProfile &&
        !pressedSoundKeysRef.current.has(soundKey)
      ) {
        pressedSoundKeysRef.current.set(soundKey, thockProfile);
        void playThockSound(thockProfile, { event: "down" });
      }

      const key = resolvePressedKey(event);
      if (key === "ContextMenu") {
        menuInvocationUntilRef.current = performance.now() + 250;
        event.preventDefault();
      }
      setPressed(key, true);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      const isModifierKey = ["Alt", "Control", "Meta", "Shift"].includes(
        event.key,
      );
      const preservesBrowserShortcut =
        (event.altKey || event.ctrlKey || event.metaKey) && !isModifierKey;
      if (preservesBrowserShortcut) return;
      event.stopPropagation();

      const soundKey = event.code || event.key;
      const thockProfile = pressedSoundKeysRef.current.get(soundKey);
      if (thockProfile) {
        event.preventDefault();
        pressedSoundKeysRef.current.delete(soundKey);
        void playThockSound(thockProfile, { event: "up" });
      }
      setPressed(resolvePressedKey(event), false);
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !captureRegionRef.current?.contains(event.target)
      ) {
        releaseCapture();
      }
    };
    const handleBlur = () => releaseCapture();
    const handleVisibilityChange = () => {
      if (document.hidden) releaseCapture();
    };
    const handleContextMenu = (event: MouseEvent) => {
      if (performance.now() > menuInvocationUntilRef.current) return;
      event.preventDefault();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      pressedSoundKeysRef.current.clear();
    };
  }, [captureEnabled, releaseCapture]);

  const toggleCapture = () => {
    if (captureEnabled) {
      releaseCapture(true);
      return;
    }
    setCaptureEnabled(true);
    requestAnimationFrame(() => keyboardRef.current?.focus());
  };

  return (
    <div className="w-full" ref={captureRegionRef}>
      {captureSupported ? (
        <div
          className="mb-3 flex justify-center"
          data-testid="keyboard-capture-consent"
        >
          <button
            aria-pressed={captureEnabled}
            className="rounded-md border border-border bg-muted/50 px-2.5 py-1.5 font-medium text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            onClick={toggleCapture}
            ref={captureButtonRef}
            type="button"
          >
            {captureEnabled
              ? "Release keyboard capture"
              : "Enable keyboard capture"}
          </button>
        </div>
      ) : null}
      <div
        className="w-full min-w-0 overflow-x-auto py-2 focus:outline-none"
        data-capture-state={captureEnabled ? "enabled" : "static"}
        data-ready={ready}
        data-testid="keyboard-60"
        ref={keyboardRef}
        tabIndex={-1}
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
    </div>
  );
}
