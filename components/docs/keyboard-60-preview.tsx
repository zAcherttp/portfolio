"use client";

import type { IndividualKey } from "@tanstack/react-hotkeys";
import { useEffect, useState } from "react";
import { Kbd } from "@/components/ui/kbd";

type KeyDefinition = {
  id?: string;
  label: string;
  keyName?: IndividualKey;
  units?: number;
};

const rows: KeyDefinition[][] = [
  [
    { label: "Esc", keyName: "Escape" },
    ..."1234567890"
      .split("")
      .map((key) => ({ label: key, keyName: key as IndividualKey })),
    { label: "-", keyName: "-" },
    { label: "=", keyName: "=" },
    { label: "Backspace", keyName: "Backspace", units: 2 },
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
    { id: "left-control", label: "Ctrl", keyName: "Control", units: 1.25 },
    { label: "Meta", keyName: "Meta", units: 1.25 },
    { id: "left-alt", label: "Alt", keyName: "Alt", units: 1.25 },
    { label: "Space", keyName: "Space", units: 6.25 },
    { id: "right-alt", label: "Alt", keyName: "Alt", units: 1.25 },
    { label: "Fn", units: 1.25 },
    { label: "Menu", units: 1.25 },
    { id: "right-control", label: "Ctrl", keyName: "Control", units: 1.25 },
  ],
];

function KeyboardKey({ keyName, label, units = 1 }: KeyDefinition) {
  const props = {
    className: "w-full min-w-0",
    style: { gridColumn: `span ${units * 4}` },
    children: label,
  };

  return keyName ? (
    <Kbd keyName={keyName} reactive {...props} />
  ) : (
    <Kbd {...props} />
  );
}

export function Keyboard60Preview() {
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);

  return (
    <div
      className="w-full min-w-0 overflow-x-auto py-2"
      data-ready={ready}
      data-testid="keyboard-60"
    >
      <div
        className="mx-auto grid w-90 min-w-90 gap-1"
        style={{ gridTemplateRows: `repeat(${rows.length}, 1.25rem)` }}
      >
        {rows.map((row) => (
          <div className="grid grid-cols-60 gap-1" key={row[0].label}>
            {row.map((key) => (
              <KeyboardKey key={key.id ?? key.label} {...key} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
