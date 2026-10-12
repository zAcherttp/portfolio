// The factory's models travel as one blob: named entries end to end, the
// whole thing scrambled with an xorshift stream. It keeps casual downloads from
// turning into game files; it is not encryption.

const MAGIC = [0x46, 0x43, 0x54, 0x31]; // "FCT1"
const SEED = 0x9e3779b9;

/** XORs bytes with an xorshift32 stream; applying it twice restores them. */
export function scramble(bytes: Uint8Array, seed = SEED) {
  let x = seed >>> 0 || 1;
  for (let i = 0; i < bytes.length; i++) {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    bytes[i] ^= x & 255;
  }
  return bytes;
}

export interface PackEntry {
  name: string;
  data: Uint8Array;
}

export function packModels(entries: readonly PackEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const names = entries.map((e) => encoder.encode(e.name));
  const header = 4 + 4 + names.reduce((n, name) => n + 1 + name.length + 4, 0);
  const size = header + entries.reduce((n, e) => n + e.data.length, 0);
  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  out.set(MAGIC, 0);
  view.setUint32(4, entries.length, true);
  let at = 8;
  entries.forEach((e, i) => {
    out[at++] = names[i].length;
    out.set(names[i], at);
    at += names[i].length;
    view.setUint32(at, e.data.length, true);
    at += 4;
  });
  for (const e of entries) {
    out.set(e.data, at);
    at += e.data.length;
  }
  scramble(out.subarray(4));
  return out;
}

export function unpackModels(blob: Uint8Array): Map<string, Uint8Array> {
  if (MAGIC.some((b, i) => blob[i] !== b)) {
    throw new Error("Not a factory model pack.");
  }
  const bytes = scramble(blob.slice(4));
  const view = new DataView(bytes.buffer);
  const decoder = new TextDecoder();
  const count = view.getUint32(0, true);
  let at = 4;
  const index: { name: string; length: number }[] = [];
  for (let i = 0; i < count; i++) {
    const n = bytes[at++];
    const name = decoder.decode(bytes.subarray(at, at + n));
    at += n;
    index.push({ name, length: view.getUint32(at, true) });
    at += 4;
  }
  const out = new Map<string, Uint8Array>();
  for (const { name, length } of index) {
    out.set(name, bytes.subarray(at, at + length));
    at += length;
  }
  return out;
}
