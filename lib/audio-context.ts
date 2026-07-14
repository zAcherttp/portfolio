let audioContext: AudioContext | null = null;

export function getAudioContext() {
  if (typeof window === "undefined") return null;

  const AudioContextClass =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioContextClass) return null;

  audioContext ??= new AudioContextClass();

  return audioContext;
}
