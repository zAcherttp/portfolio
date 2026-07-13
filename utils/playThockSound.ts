import { getAudioContext } from "@/utils/audioContext";

export type ThockSoundProfile = "normal" | "space" | "wide";
export type ThockSoundEvent = "down" | "up";

export type ThockSoundOptions = {
  event?: ThockSoundEvent;
  variant?: number;
  volume?: number;
};

type ThockContext = AudioContext | OfflineAudioContext;
type Mode = readonly [frequency: number, level: number, decay: number];

export const THOCK_VARIANT_COUNT = 6;

const PROFILES = ["normal", "wide", "space"] as const;
const EVENTS = ["down", "up"] as const;
const PROFILE_INDEX: Record<ThockSoundProfile, number> = {
  normal: 0,
  wide: 1,
  space: 2,
};
const EVENT_INDEX: Record<ThockSoundEvent, number> = { down: 1, up: 0 };
const PROFILE_METAL: Record<ThockSoundProfile, number> = {
  normal: 0.3,
  wide: 0.15,
  space: 0,
};
const DOWN_PITCH: Record<ThockSoundProfile, number> = {
  normal: 1,
  wide: 0.88,
  space: 0.68,
};
const DOWN_DECAY: Record<ThockSoundProfile, number> = {
  normal: 1,
  wide: 1.08,
  space: 1.2,
};
const DOWN_GLOBAL = {
  decay: 0.08,
  fade: 0.0025,
  noiseAmount: 1,
  outputPeak: 0.06,
} as const;
const VARIANT_PITCH = [1, 0.996, 1.003, 0.994, 1.006, 0.998] as const;
const VARIANT_DECAY = [1, 1.03, 0.98, 1.04, 0.96, 1.01] as const;
const VARIANT_GAIN = [1, 0.98, 1.02, 1.01, 0.97, 1.03] as const;

// This is the exact modal bank from the selected single-hit preset. The 0.15
// decay multiplier remains intentional so the project matches the lab output.
const UP_MODES: readonly Mode[] = [
  [614, 0.34, 0.018],
  [1036, 0.28, 0.015],
  [1144, 0.42, 0.014],
  [1548, 0.26, 0.012],
  [1879, 0.34, 0.011],
  [1978, 0.48, 0.01],
  [2054, 0.52, 0.009],
  [2129, 0.46, 0.0085],
  [2180, 0.45, 0.008],
  [2245, 0.38, 0.0075],
  [2342, 0.28, 0.007],
];

const DOWN_MODES: readonly Mode[] = [
  [105, 0.62, 0.022],
  [185, 0.46, 0.018],
  [330, 0.32, 0.014],
  [610, 0.16, 0.01],
  [910, 0.07, 0.007],
];

const WIDE_KEYS = new Set([
  "Alt",
  "Backspace",
  "CapsLock",
  "ContextMenu",
  "Control",
  "Escape",
  "Fn",
  "Meta",
  "Shift",
  "Tab",
  "Enter",
  "\\",
]);

const fittedBuffers = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();
const variantCounters = new WeakMap<AudioContext, Map<string, number>>();
const outputBuses = new WeakMap<AudioContext, DynamicsCompressorNode>();

export function getThockSoundProfile(
  key: string,
  code = "",
): ThockSoundProfile | null {
  if (key === " " || key === "Space" || code === "Space") return "space";
  if (WIDE_KEYS.has(key) || code === "Backslash") return "wide";
  if (key.length === 1) return "normal";
  return null;
}

export function normalizeThockVolume(volume = 1) {
  if (!Number.isFinite(volume)) return 1;
  return Math.min(2, Math.max(0, volume));
}

function normalizeVariant(variant: number) {
  if (!Number.isFinite(variant)) return 0;
  return Math.abs(Math.trunc(variant)) % THOCK_VARIANT_COUNT;
}

function createSeededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

function getSeed(
  profile: ThockSoundProfile,
  event: ThockSoundEvent,
  variant: number,
) {
  return (
    713 +
    PROFILE_INDEX[profile] * 10_000 +
    EVENT_INDEX[event] * 100_000 +
    variant * 1_009
  );
}

function gaussian(random: () => number) {
  const first = Math.max(1e-9, random());
  const second = random();
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}

function smootherstepAttack(time: number, duration: number) {
  const progress = Math.min(1, Math.max(0, time / duration));
  return progress ** 3 * (progress * (progress * 6 - 15) + 10);
}

function renderUpImpact(
  profile: ThockSoundProfile,
  sampleRate: number,
  variant: number,
) {
  const duration = 0.0784;
  const samples = new Float32Array(Math.ceil(duration * sampleRate));
  const random = createSeededRandom(getSeed(profile, "up", variant));
  let roomLowPass = gaussian(random) * 0.12;

  for (let index = 0; index < samples.length; index += 1) {
    roomLowPass += 0.025 * (gaussian(random) - roomLowPass);
    samples[index] += roomLowPass * 0.006 * 0.2;
  }

  let noiseLowPass = 0;
  let previousNoise = 0;
  const brightness = 0.055 + 0.2 * 0.9;
  for (let index = 0; index < samples.length; index += 1) {
    const time = index / sampleRate;
    noiseLowPass += brightness * (gaussian(random) - noiseLowPass);
    const highPassed = noiseLowPass - 0.985 * previousNoise;
    previousNoise = noiseLowPass;
    const envelope = Math.exp(-time / (0.007 * 0.15));
    samples[index] += highPassed * 0.4 * 0.45 * 0.9 * envelope;
  }

  const phases = [0.2, 1.1, 2.2, 0.7, 1.7, 2.8, 0.4, 1.35, 2.45, 0.95, 1.95];
  UP_MODES.forEach(([baseFrequency, level, baseDecay], modeIndex) => {
    const groupGain =
      baseFrequency < 500
        ? 0.8
        : baseFrequency < 1500
          ? 1.2
          : PROFILE_METAL[profile];
    const frequency = baseFrequency * VARIANT_PITCH[variant];
    const decay = baseDecay * 0.15 * VARIANT_DECAY[variant];
    const phase = phases[modeIndex];
    for (let index = 0; index < samples.length; index += 1) {
      const time = index / sampleRate;
      const fade = Math.min(1, time / 0.00025);
      samples[index] +=
        Math.cos(2 * Math.PI * frequency * time + phase) *
        Math.exp(-time / decay) *
        level *
        groupGain *
        fade;
    }
  });

  return finishImpact(samples, 0.6, 0.21 * VARIANT_GAIN[variant]);
}

function renderDownImpact(
  profile: ThockSoundProfile,
  sampleRate: number,
  variant: number,
) {
  const duration = 0.06;
  const samples = new Float32Array(Math.ceil(duration * sampleRate));
  const random = createSeededRandom(getSeed(profile, "down", variant));
  const pitch = DOWN_PITCH[profile] * VARIANT_PITCH[variant];
  const decayScale = DOWN_DECAY[profile] * VARIANT_DECAY[variant];
  let noiseLowPass = 0;

  for (let index = 0; index < samples.length; index += 1) {
    const time = index / sampleRate;
    noiseLowPass += 0.08 * (gaussian(random) - noiseLowPass);
    samples[index] +=
      noiseLowPass *
      DOWN_GLOBAL.noiseAmount *
      Math.exp(-time / (0.0028 * DOWN_GLOBAL.decay * decayScale)) *
      smootherstepAttack(time, DOWN_GLOBAL.fade);
  }

  const phases = [0.15, 0.7, 1.3, 2.1, 2.65];
  DOWN_MODES.forEach(([baseFrequency, level, baseDecay], modeIndex) => {
    const frequency = baseFrequency * pitch;
    const decay = baseDecay * DOWN_GLOBAL.decay * decayScale;
    for (let index = 0; index < samples.length; index += 1) {
      const time = index / sampleRate;
      const fade = smootherstepAttack(time, DOWN_GLOBAL.fade);
      samples[index] +=
        Math.cos(2 * Math.PI * frequency * time + phases[modeIndex]) *
        Math.exp(-time / decay) *
        level *
        fade;
    }
  });

  return finishImpact(
    samples,
    0.5,
    DOWN_GLOBAL.outputPeak * VARIANT_GAIN[variant],
  );
}

function finishImpact(
  samples: Float32Array<ArrayBuffer>,
  drive: number,
  outputPeak: number,
) {
  let previousInput = 0;
  let previousOutput = 0;
  let peak = Number.EPSILON;
  for (let index = 0; index < samples.length; index += 1) {
    const input = samples[index];
    let output = input - previousInput + 0.995 * previousOutput;
    previousInput = input;
    previousOutput = output;
    output = Math.tanh(output * drive);
    samples[index] = output;
    peak = Math.max(peak, Math.abs(output));
  }
  const scale = outputPeak / peak;
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] *= scale;
  }
  return samples;
}

function getFittedBuffer(
  ctx: BaseAudioContext,
  profile: ThockSoundProfile,
  event: ThockSoundEvent,
  variant: number,
) {
  let buffers = fittedBuffers.get(ctx);
  if (!buffers) {
    buffers = new Map();
    fittedBuffers.set(ctx, buffers);
  }
  const cacheKey = `${profile}:${event}:${variant}`;
  const cached = buffers.get(cacheKey);
  if (cached) return cached;

  const samples =
    event === "up"
      ? renderUpImpact(profile, ctx.sampleRate, variant)
      : renderDownImpact(profile, ctx.sampleRate, variant);
  const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
  buffer.copyToChannel(samples, 0);
  buffers.set(cacheKey, buffer);
  return buffer;
}

function createOutputBus(ctx: ThockContext, destination: AudioNode) {
  const output = ctx.createDynamicsCompressor();
  output.threshold.value = -3;
  output.knee.value = 2;
  output.ratio.value = 12;
  output.attack.value = 0.005;
  output.release.value = 0.06;
  output.connect(destination);
  return output;
}

function getOutputBus(ctx: AudioContext) {
  let output = outputBuses.get(ctx);
  if (!output) {
    output = createOutputBus(ctx, ctx.destination);
    outputBuses.set(ctx, output);
  }
  return output;
}

function getNextVariant(
  ctx: AudioContext,
  profile: ThockSoundProfile,
  event: ThockSoundEvent,
) {
  let counters = variantCounters.get(ctx);
  if (!counters) {
    counters = new Map();
    variantCounters.set(ctx, counters);
  }
  const key = `${profile}:${event}`;
  const variant = counters.get(key) ?? 0;
  counters.set(key, (variant + 1) % THOCK_VARIANT_COUNT);
  return variant;
}

function scheduleThockSound(
  ctx: ThockContext,
  destination: AudioNode,
  profile: ThockSoundProfile,
  event: ThockSoundEvent,
  variant: number,
  volume: number,
  startTime = ctx.currentTime,
) {
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = getFittedBuffer(ctx, profile, event, variant);
  gain.gain.setValueAtTime(volume, startTime);
  source.connect(gain);
  gain.connect(destination);
  source.start(startTime);
  source.onended = () => {
    source.disconnect();
    gain.disconnect();
  };
}

export async function playThockSound(
  profile: ThockSoundProfile = "normal",
  options: ThockSoundOptions = {},
) {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === "suspended") await ctx.resume();
  if (ctx.state !== "running") return;

  const event = options.event ?? "up";
  const variant =
    options.variant === undefined
      ? getNextVariant(ctx, profile, event)
      : normalizeVariant(options.variant);
  scheduleThockSound(
    ctx,
    getOutputBus(ctx),
    profile,
    event,
    variant,
    normalizeThockVolume(options.volume),
  );
}

export async function renderThockSoundProfile(
  profile: ThockSoundProfile = "normal",
  options: ThockSoundOptions = {},
) {
  if (typeof OfflineAudioContext === "undefined") return null;

  const sampleRate = 48_000;
  const duration = 0.1;
  const event = options.event ?? "up";
  const variant = normalizeVariant(options.variant ?? 0);
  const ctx = new OfflineAudioContext(1, sampleRate * duration, sampleRate);
  const output = createOutputBus(ctx, ctx.destination);
  scheduleThockSound(
    ctx,
    output,
    profile,
    event,
    variant,
    normalizeThockVolume(options.volume),
    0.008,
  );
  return ctx.startRendering();
}

export function getThockSoundVoices() {
  return PROFILES.flatMap((profile) =>
    EVENTS.map((event) => ({ event, profile })),
  );
}
