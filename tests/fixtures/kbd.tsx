"use client";

import { useEffect, useState } from "react";
import { Keyboard60Preview } from "@/components/docs/keyboard-60-preview";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

export function KbdKeyboardFixture() {
  return <Keyboard60Preview />;
}

export function KbdStatesFixture() {
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);

  return (
    <KbdGroup className="gap-3" data-ready={ready} data-testid="kbd-states">
      <Kbd data-testid="kbd-idle">Idle</Kbd>
      <Kbd data-testid="kbd-controlled" pressed>
        Pressed
      </Kbd>
      <Kbd data-testid="kbd-reactive" keyName="D" reactive>
        D
      </Kbd>
    </KbdGroup>
  );
}
