import { getAudioContext } from "@/lib/audio-context";

type PopSoundConfig = {
  type?: OscillatorType;
  startFrequency?: number;
  endFrequency?: number;
  frequencyRampDuration?: number;
  volume?: number;
  endVolume?: number;
  volumeRampDuration?: number;
  duration?: number;
};

const DEFAULT_POP_SOUND: Required<PopSoundConfig> = {
  type: "sine",
  startFrequency: 600,
  endFrequency: 80,
  frequencyRampDuration: 0.04,
  volume: 0.12,
  endVolume: 0.001,
  volumeRampDuration: 0.04,
  duration: 0.05,
};

const POP_SOUND_PRESETS = [
  {
    startFrequency: 850,
    endFrequency: 120,
    volume: 0.09,
    duration: 0.035,
  },
  {
    startFrequency: 450,
    endFrequency: 200,
    volume: 0.1,
    duration: 0.05,
  },
  {
    startFrequency: 700,
    endFrequency: 50,
    volume: 0.12,
    duration: 0.055,
  },
  {
    startFrequency: 300,
    endFrequency: 40,
    volume: 0.15,
    duration: 0.06,
  },
] satisfies PopSoundConfig[];

let lastPresetIndex = -1;

function finiteOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function resolvePopSoundConfig(
  config: PopSoundConfig = {},
): Required<PopSoundConfig> {
  return {
    type: config.type ?? DEFAULT_POP_SOUND.type,
    startFrequency: finiteOr(
      config.startFrequency,
      DEFAULT_POP_SOUND.startFrequency,
    ),
    endFrequency: finiteOr(config.endFrequency, DEFAULT_POP_SOUND.endFrequency),
    frequencyRampDuration: finiteOr(
      config.frequencyRampDuration,
      DEFAULT_POP_SOUND.frequencyRampDuration,
    ),
    volume: finiteOr(config.volume, DEFAULT_POP_SOUND.volume),
    endVolume: finiteOr(config.endVolume, DEFAULT_POP_SOUND.endVolume),
    volumeRampDuration: finiteOr(
      config.volumeRampDuration,
      DEFAULT_POP_SOUND.volumeRampDuration,
    ),
    duration: finiteOr(config.duration, DEFAULT_POP_SOUND.duration),
  };
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function jitter(config: Required<PopSoundConfig>): Required<PopSoundConfig> {
  return {
    ...config,
    startFrequency: config.startFrequency * randomBetween(0.94, 1.06),
    endFrequency: config.endFrequency * randomBetween(0.94, 1.06),
    volume: config.volume * randomBetween(0.9, 1.05),
    duration: config.duration * randomBetween(0.92, 1.1),
  };
}

function pickRandomPreset() {
  let index = Math.floor(Math.random() * POP_SOUND_PRESETS.length);

  if (POP_SOUND_PRESETS.length > 1) {
    while (index === lastPresetIndex) {
      index = Math.floor(Math.random() * POP_SOUND_PRESETS.length);
    }
  }

  lastPresetIndex = index;

  return POP_SOUND_PRESETS[index];
}

export async function playPopSound(config: PopSoundConfig = {}) {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    await ctx.resume();
  }

  const finalConfig = resolvePopSoundConfig(config);
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = finalConfig.type;

  const startFrequency = Math.max(finalConfig.startFrequency, 0.001);
  const endFrequency = Math.max(finalConfig.endFrequency, 0.001);
  const volume = Math.max(finalConfig.volume, 0.001);
  const endVolume = Math.max(finalConfig.endVolume, 0.001);

  osc.frequency.setValueAtTime(startFrequency, now);
  osc.frequency.exponentialRampToValueAtTime(
    endFrequency,
    now + finalConfig.frequencyRampDuration,
  );

  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(
    endVolume,
    now + finalConfig.volumeRampDuration,
  );

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + finalConfig.duration);

  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
}

export function playRandomPopSound() {
  const preset = resolvePopSoundConfig(pickRandomPreset());
  return playPopSound(jitter(preset));
}
