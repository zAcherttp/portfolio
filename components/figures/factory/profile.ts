/**
 * Pass timing, off unless asked for: set `window.__factoryProfile = {}` in
 * the console to apply the overrides below, and `timing: true` to time each
 * pass on the GPU (timer queries, where the browser has them) and on the CPU
 * that submits it. It works in production builds too, so a real device can
 * be measured.
 */
export type Pass =
  | "cpu"
  | "shadows"
  | "prepass"
  | "scene"
  | "smoke"
  | "ink"
  | "down";

export interface Profile {
  frames?: number;
  /** Milliseconds per pass, summed over `frames`: CPU submit, and GPU. */
  ms?: Partial<Record<Pass, number>>;
  gpu?: Partial<Record<Pass, number>>;
  gpuFrames?: number;
  /** The last frame's supersampling and target size. */
  drawnFactor?: number;
  size?: [number, number];
  /** The main pass's draw calls, triangles and shader programs. */
  info?: {
    calls: number;
    triangles: number;
    programs: number;
    lights: number;
    views: number;
    units: number;
  };
  /** Overrides, to see what each part costs. */
  factor?: number;
  lights?: boolean;
  timing?: boolean;
}

declare global {
  interface Window {
    __factoryProfile?: Profile;
  }
}

interface Timer {
  ext: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
  pending: { pass: Pass; query: WebGLQuery; frame: boolean }[];
  open: WebGLQuery | null;
}
const timers = new WeakMap<WebGL2RenderingContext, Timer>();

export function profiler(gl: WebGL2RenderingContext) {
  const profile =
    typeof window !== "undefined" ? window.__factoryProfile : undefined;
  if (!profile) return null;
  profile.ms ??= {};
  profile.gpu ??= {};
  const { ms, gpu } = profile;
  let timer = timers.get(gl);
  if (!timer) {
    timer = {
      ext: gl.getExtension("EXT_disjoint_timer_query_webgl2"),
      pending: [],
      open: null,
    };
    timers.set(gl, timer);
  }
  const t = timer;
  // Collect what the GPU has finished timing.
  if (t.ext) {
    const disjoint = gl.getParameter(t.ext.GPU_DISJOINT_EXT);
    while (t.pending.length > 0) {
      const { pass, query, frame } = t.pending[0];
      if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) break;
      t.pending.shift();
      if (!disjoint && profile.timing) {
        gpu[pass] =
          (gpu[pass] ?? 0) + gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6;
        if (frame) profile.gpuFrames = (profile.gpuFrames ?? 0) + 1;
      }
      gl.deleteQuery(query);
    }
  }
  const begin = () => {
    if (!t.ext || !profile.timing) return;
    t.open = gl.createQuery();
    if (t.open) gl.beginQuery(t.ext.TIME_ELAPSED_EXT, t.open);
  };
  begin();
  let last = performance.now();
  return {
    profile,
    /** Close the pass just done: its CPU time now, its GPU time later. */
    mark(pass: Pass, final = false) {
      if (!profile.timing) return;
      const now = performance.now();
      ms[pass] = (ms[pass] ?? 0) + now - last;
      last = now;
      if (t.ext && t.open) {
        gl.endQuery(t.ext.TIME_ELAPSED_EXT);
        t.pending.push({ pass, query: t.open, frame: final });
        t.open = null;
      }
      if (!final) begin();
    },
  };
}

interface MeshTime {
  name: string;
  triangles: number;
  instances: number;
  ms: number;
}

/**
 * Once: draw every mesh on its own under a timer query, into whatever target
 * is bound, and list them by GPU time in `profile.meshes` once all resolve.
 */
export function timeMeshes(
  gl: WebGL2RenderingContext,
  profile: Profile & { meshes?: MeshTime[] | "pending" },
  render: (object: import("three").Object3D) => void,
  root: import("three").Object3D,
) {
  const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2");
  if (!ext || profile.meshes) return;
  profile.meshes = "pending";
  const meshes: import("three").Mesh[] = [];
  root.traverseVisible((o) => {
    if ((o as import("three").Mesh).isMesh)
      meshes.push(o as import("three").Mesh);
  });
  const runs = meshes.map((mesh) => {
    const query = gl.createQuery() as WebGLQuery;
    const children = mesh.children.map((c) => c.visible);
    for (const c of mesh.children) c.visible = false;
    gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
    render(mesh);
    gl.endQuery(ext.TIME_ELAPSED_EXT);
    mesh.children.forEach((c, i) => {
      c.visible = children[i];
    });
    const g = mesh.geometry;
    const count = g.index ? g.index.count : (g.attributes.position?.count ?? 0);
    const instances = (mesh as import("three").InstancedMesh).isInstancedMesh
      ? (mesh as import("three").InstancedMesh).count
      : 1;
    return { mesh, query, triangles: (count / 3) * instances, instances };
  });
  const poll = () => {
    if (
      !runs.every((r) =>
        gl.getQueryParameter(r.query, gl.QUERY_RESULT_AVAILABLE),
      )
    ) {
      setTimeout(poll, 50);
      return;
    }
    profile.meshes = runs
      .map((r) => ({
        name: r.mesh.name || r.mesh.parent?.name || r.mesh.type,
        triangles: Math.round(r.triangles),
        instances: r.instances,
        ms: gl.getQueryParameter(r.query, gl.QUERY_RESULT) / 1e6,
      }))
      .sort((a, b) => b.ms - a.ms);
    for (const r of runs) gl.deleteQuery(r.query);
  };
  poll();
}
