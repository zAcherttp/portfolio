// The factory's models travel as one blob: named entries end to end, gzipped,
// then scrambled with an xorshift stream. It keeps casual downloads from
// turning into game files; it is not encryption. Compressing before
// scrambling keeps the size gzip would have won on the wire, which a
// scrambled blob would otherwise lose.

const MAGIC = [0x46, 0x43, 0x54, 0x32]; // "FCT2"
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

export type Codec = (bytes: Uint8Array) => Promise<Uint8Array>;

interface ByteStream {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<BufferSource>;
}

async function through(bytes: Uint8Array, stream: ByteStream) {
  const source = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(bytes as Uint8Array<ArrayBuffer>);
      controller.close();
    },
  });
  const reader = source.pipeThrough(stream).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/** Gzip by the platform's own streams, in browsers and Node alike. */
export const gzip: Codec = (bytes) =>
  through(bytes, new CompressionStream("gzip"));
export const gunzip: Codec = (bytes) =>
  through(bytes, new DecompressionStream("gzip"));

export interface PackEntry {
  name: string;
  data: Uint8Array;
}

function table(entries: readonly PackEntry[]) {
  const encoder = new TextEncoder();
  const names = entries.map((e) => encoder.encode(e.name));
  const header = 4 + names.reduce((n, name) => n + 1 + name.length + 4, 0);
  const size = header + entries.reduce((n, e) => n + e.data.length, 0);
  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  view.setUint32(0, entries.length, true);
  let at = 4;
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
  return out;
}

export async function packModels(
  entries: readonly PackEntry[],
  compress: Codec = gzip,
): Promise<Uint8Array> {
  const body = await compress(table(entries));
  const out = new Uint8Array(4 + body.length);
  out.set(MAGIC, 0);
  out.set(body, 4);
  scramble(out.subarray(4));
  return out;
}

export async function unpackModels(
  blob: Uint8Array,
  decompress: Codec = gunzip,
): Promise<Map<string, Uint8Array>> {
  if (MAGIC.some((b, i) => blob[i] !== b)) {
    throw new Error("Not a factory model pack.");
  }
  const bytes = await decompress(scramble(blob.slice(4)));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
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
