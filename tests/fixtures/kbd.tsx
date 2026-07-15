"use client";

import { useEffect, useState } from "react";
import { Keyboard60Preview } from "@/components/docs/keyboard-60-preview";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  playThockSound,
  renderThockSoundProfile,
  type ThockSoundEvent,
  type ThockSoundProfile,
} from "@/utils/playThockSound";
import { type AudioProfile, analyzeAudioBuffer } from "./audio-profile";
import { THOCK_REFERENCE_PROFILE } from "./thock-reference-profile";

const soundSizes = [
  { id: "normal", key: "A", label: "Normal" },
  { id: "wide", key: "Enter", label: "Wide" },
  { id: "space", key: "Space", label: "Space" },
] satisfies Array<{
  id: ThockSoundProfile;
  key: string;
  label: string;
}>;

const soundEvents = [
  { id: "down", label: "Down", name: "Thump" },
  { id: "up", label: "Up", name: "Thock" },
] satisfies Array<{ id: ThockSoundEvent; label: string; name: string }>;

type SoundVoiceId = `${ThockSoundProfile}-${ThockSoundEvent}`;

function profilePoints(values: number[]) {
  return values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * 320;
      const y = 78 - value * 64;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function ProfilePlot({
  current,
  profile,
  reference,
}: {
  current?: number[];
  profile: string;
  reference?: number[];
}) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-3 font-mono text-xs text-muted-foreground">
        <span>{profile}</span>
        <span>40 Hz–12 kHz</span>
      </div>
      <svg
        aria-label={`${profile} spectrum comparison`}
        className="h-24 w-full overflow-visible"
        role="img"
        viewBox="0 0 320 80"
      >
        <path className="stroke-border" d="M0 78H320" />
        <path className="stroke-border/60" d="M0 46H320" />
        {reference ? (
          <polyline
            className="fill-none stroke-foreground"
            points={profilePoints(reference)}
            strokeWidth="1.25"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {current ? (
          <polyline
            className="fill-none stroke-muted-foreground"
            points={profilePoints(current)}
            strokeDasharray="3 2"
            strokeWidth="1.25"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
    </div>
  );
}

function formatMetric(value: number, unit: "hz" | "percent" | "ratio") {
  if (unit === "hz") return `${Math.round(value).toLocaleString()} Hz`;
  if (unit === "percent") return `${Math.round(value * 100)}%`;
  return `${value.toFixed(1)}×`;
}

function ProfileMetrics({
  current,
  showReference,
}: {
  current: AudioProfile | null;
  showReference: boolean;
}) {
  const metrics = [
    { key: "centroid", label: "Centroid", unit: "hz" },
    { key: "midEnergy", label: "500–2500 Hz", unit: "percent" },
    { key: "crest", label: "Crest", unit: "ratio" },
  ] as const;

  return (
    <div className="grid grid-cols-3 gap-3 border-border/60 border-t pt-2 font-mono text-xs">
      {metrics.map((metric) => (
        <div className="min-w-0" key={metric.key}>
          <span className="block text-muted-foreground">{metric.label}</span>
          <span className="mt-0.5 block truncate text-foreground">
            {current
              ? formatMetric(current.metrics[metric.key], metric.unit)
              : "Rendering…"}
          </span>
          {showReference ? (
            <span className="block truncate text-muted-foreground">
              ref{" "}
              {formatMetric(
                THOCK_REFERENCE_PROFILE.metrics[metric.key],
                metric.unit,
              )}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

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

export function KbdReducedMotionFixture() {
  return (
    <KbdGroup className="gap-3" data-testid="kbd-reduced-motion">
      <Kbd data-testid="kbd-motion-idle">Idle</Kbd>
      <Kbd data-testid="kbd-motion-pressed" pressed>
        Pressed
      </Kbd>
    </KbdGroup>
  );
}

export function KbdSoundProfilesFixture() {
  const [analyses, setAnalyses] = useState<
    Partial<Record<SoundVoiceId, AudioProfile>>
  >({});
  const [pressed, setPressed] = useState<string | null>(null);
  const [volume, setVolume] = useState(100);

  const play = (size: ThockSoundProfile, event: ThockSoundEvent) => {
    void playThockSound(size, { event, volume: volume / 100 });
  };

  useEffect(() => {
    let active = true;
    setAnalyses({});
    void Promise.all(
      soundSizes.flatMap(({ id }) =>
        soundEvents.map(async ({ id: event }) => {
          const voiceId: SoundVoiceId = `${id}-${event}`;
          const buffer = await renderThockSoundProfile(id, {
            event,
            volume: volume / 100,
          });
          return [voiceId, buffer ? analyzeAudioBuffer(buffer) : null] as const;
        }),
      ),
    ).then((profiles) => {
      if (!active) return;
      const next: Partial<Record<SoundVoiceId, AudioProfile>> = {};
      for (const [profile, analysis] of profiles) {
        if (analysis) next[profile] = analysis;
      }
      setAnalyses(next);
    });
    return () => {
      active = false;
    };
  }, [volume]);

  return (
    <div className="w-full max-w-xl" data-testid="kbd-sound-lab">
      <div className="mb-6 flex items-center justify-between gap-6 border-b border-border pb-4">
        <label className="text-sm font-medium" htmlFor="thock-volume">
          Volume
        </label>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
          <input
            className="h-1 w-full max-w-64 cursor-pointer accent-foreground"
            data-testid="thock-volume"
            id="thock-volume"
            max="200"
            min="25"
            onChange={(event) => setVolume(event.currentTarget.valueAsNumber)}
            step="5"
            type="range"
            value={volume}
          />
          <output
            className="w-11 text-right font-mono text-xs tabular-nums text-muted-foreground"
            htmlFor="thock-volume"
          >
            {volume}%
          </output>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(5rem,1fr)_repeat(3,4.5rem)] items-end gap-3 border-b border-border pb-2 font-mono text-xs text-muted-foreground">
        <span>Event</span>
        {soundSizes.map((size) => (
          <span className="text-center" key={size.id}>
            {size.label}
          </span>
        ))}
      </div>

      {soundEvents.map((soundEvent, eventIndex) => (
        <div
          className="grid grid-cols-[minmax(5rem,1fr)_repeat(3,4.5rem)] items-center gap-3 border-b border-border py-4"
          data-sound-character={soundEvent.id}
          key={soundEvent.id}
        >
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              0{eventIndex + 1}
            </span>
            <span className="text-sm font-medium">
              {soundEvent.label} · {soundEvent.name}
            </span>
          </div>

          {soundSizes.map((size) => {
            const id = `${soundEvent.id}-${size.id}`;
            return (
              <button
                aria-label={`Play ${soundEvent.label} ${size.label}`}
                className="flex h-10 items-center justify-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                data-sound-profile={id}
                key={size.id}
                onClick={(event) => {
                  if (event.detail === 0) play(size.id, soundEvent.id);
                }}
                onPointerCancel={() => setPressed(null)}
                onPointerDown={() => {
                  setPressed(id);
                  play(size.id, soundEvent.id);
                }}
                onPointerLeave={() => setPressed(null)}
                onPointerUp={() => setPressed(null)}
                type="button"
              >
                <Kbd
                  className={size.id === "space" ? "w-16" : undefined}
                  pressed={pressed === id}
                >
                  {size.key}
                </Kbd>
              </button>
            );
          })}
        </div>
      ))}

      <div className="pt-6" data-testid="thock-profile-analysis">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Reference comparison</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              Recorded Up reference · designed Down voice · six variations each
            </p>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <i className="block h-px w-3 bg-foreground" /> Reference
            </span>
            <span className="flex items-center gap-1.5">
              <i className="block w-3 border-muted-foreground border-t border-dashed" />
              Current
            </span>
          </div>
        </div>

        <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2">
          {soundSizes.flatMap((size) =>
            soundEvents.map((soundEvent) => {
              const voiceId: SoundVoiceId = `${size.id}-${soundEvent.id}`;
              const showReference = soundEvent.id === "up";
              return (
                <section
                  className="min-w-0 border-border border-t pt-3"
                  data-analysis-profile={voiceId}
                  key={voiceId}
                >
                  <ProfilePlot
                    current={analyses[voiceId]?.spectrum}
                    profile={`${size.label} · ${soundEvent.label}`}
                    reference={
                      showReference
                        ? THOCK_REFERENCE_PROFILE.spectrum
                        : undefined
                    }
                  />
                  <ProfileMetrics
                    current={analyses[voiceId] ?? null}
                    showReference={showReference}
                  />
                </section>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}
