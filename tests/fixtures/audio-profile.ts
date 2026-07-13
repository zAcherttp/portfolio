export type AudioProfile = {
  envelope: number[];
  metrics: {
    centroid: number;
    crest: number;
    highEnergy: number;
    lowEnergy: number;
    midEnergy: number;
    rolloff: number;
  };
  spectrum: number[];
};

const ENVELOPE_POINTS = 80;
const FFT_SIZE = 16_384;
const PROFILE_DURATION = 0.04;
const SPECTRUM_POINTS = 64;

function normalize(values: number[]) {
  const maximum = Math.max(...values, Number.EPSILON);
  return values.map((value) => value / maximum);
}

function fft(real: Float64Array, imaginary: Float64Array) {
  for (let index = 1, reversed = 0; index < FFT_SIZE; index += 1) {
    let bit = FFT_SIZE >> 1;
    while (reversed & bit) {
      reversed ^= bit;
      bit >>= 1;
    }
    reversed ^= bit;
    if (index < reversed) {
      [real[index], real[reversed]] = [real[reversed], real[index]];
      [imaginary[index], imaginary[reversed]] = [
        imaginary[reversed],
        imaginary[index],
      ];
    }
  }

  for (let size = 2; size <= FFT_SIZE; size <<= 1) {
    const angle = (-2 * Math.PI) / size;
    const stepReal = Math.cos(angle);
    const stepImaginary = Math.sin(angle);
    for (let start = 0; start < FFT_SIZE; start += size) {
      let phaseReal = 1;
      let phaseImaginary = 0;
      for (let offset = 0; offset < size / 2; offset += 1) {
        const even = start + offset;
        const odd = even + size / 2;
        const oddReal = real[odd] * phaseReal - imaginary[odd] * phaseImaginary;
        const oddImaginary =
          real[odd] * phaseImaginary + imaginary[odd] * phaseReal;
        real[odd] = real[even] - oddReal;
        imaginary[odd] = imaginary[even] - oddImaginary;
        real[even] += oddReal;
        imaginary[even] += oddImaginary;
        const nextPhaseReal =
          phaseReal * stepReal - phaseImaginary * stepImaginary;
        phaseImaginary = phaseReal * stepImaginary + phaseImaginary * stepReal;
        phaseReal = nextPhaseReal;
      }
    }
  }
}

export function analyzeAudioBuffer(buffer: AudioBuffer): AudioProfile {
  const samples = buffer.getChannelData(0);
  const peakSearchLength = Math.min(
    samples.length,
    Math.round(buffer.sampleRate * 0.06),
  );
  let peakIndex = 0;
  for (let index = 1; index < peakSearchLength; index += 1) {
    if (Math.abs(samples[index]) > Math.abs(samples[peakIndex])) {
      peakIndex = index;
    }
  }
  const profileStart = Math.max(
    0,
    peakIndex - Math.round(buffer.sampleRate * 0.003),
  );
  const profileLength = Math.min(
    samples.length - profileStart,
    Math.round(buffer.sampleRate * PROFILE_DURATION),
  );
  const envelope = Array.from({ length: ENVELOPE_POINTS }, (_, index) => {
    const start = Math.floor((index * profileLength) / ENVELOPE_POINTS);
    const end = Math.max(
      start + 1,
      Math.floor(((index + 1) * profileLength) / ENVELOPE_POINTS),
    );
    let energy = 0;
    for (let sample = start; sample < end; sample += 1) {
      energy += samples[profileStart + sample] ** 2;
    }
    return Math.sqrt(energy / (end - start));
  });

  const real = new Float64Array(FFT_SIZE);
  const imaginary = new Float64Array(FFT_SIZE);
  const fftLength = Math.min(profileLength, FFT_SIZE);
  let peak = 0;
  let totalEnergy = 0;
  for (let index = 0; index < fftLength; index += 1) {
    const sample = samples[profileStart + index];
    real[index] = sample;
    peak = Math.max(peak, Math.abs(sample));
    totalEnergy += sample ** 2;
  }
  fft(real, imaginary);

  const powers = new Float64Array(FFT_SIZE / 2 + 1);
  const maxBin = Math.min(
    powers.length - 1,
    Math.floor((12_000 * FFT_SIZE) / buffer.sampleRate),
  );
  const minBin = Math.max(1, Math.ceil((40 * FFT_SIZE) / buffer.sampleRate));
  let spectralEnergy = 0;
  let weightedFrequency = 0;
  let lowEnergy = 0;
  let midEnergy = 0;
  let highEnergy = 0;
  for (let bin = minBin; bin <= maxBin; bin += 1) {
    const power = real[bin] ** 2 + imaginary[bin] ** 2;
    const frequency = (bin * buffer.sampleRate) / FFT_SIZE;
    powers[bin] = power;
    spectralEnergy += power;
    weightedFrequency += frequency * power;
    if (frequency < 500) lowEnergy += power;
    else if (frequency < 2500) midEnergy += power;
    else highEnergy += power;
  }

  const rolloffTarget = spectralEnergy * 0.85;
  let cumulativeEnergy = 0;
  let rolloff = 0;
  for (let bin = minBin; bin <= maxBin; bin += 1) {
    cumulativeEnergy += powers[bin];
    if (cumulativeEnergy >= rolloffTarget) {
      rolloff = (bin * buffer.sampleRate) / FFT_SIZE;
      break;
    }
  }

  const frequencies = Array.from(
    { length: SPECTRUM_POINTS },
    (_, index) => 40 * (12_000 / 40) ** (index / (SPECTRUM_POINTS - 1)),
  );
  const spectrum = frequencies.map((frequency) => {
    const bin = Math.min(
      maxBin,
      Math.max(minBin, Math.round((frequency * FFT_SIZE) / buffer.sampleRate)),
    );
    return Math.sqrt(powers[bin]);
  });
  const rms = Math.sqrt(totalEnergy / Math.max(1, fftLength));

  return {
    envelope: normalize(envelope),
    metrics: {
      centroid: weightedFrequency / Math.max(spectralEnergy, Number.EPSILON),
      crest: peak / Math.max(rms, Number.EPSILON),
      highEnergy: highEnergy / Math.max(spectralEnergy, Number.EPSILON),
      lowEnergy: lowEnergy / Math.max(spectralEnergy, Number.EPSILON),
      midEnergy: midEnergy / Math.max(spectralEnergy, Number.EPSILON),
      rolloff,
    },
    spectrum: normalize(spectrum),
  };
}
