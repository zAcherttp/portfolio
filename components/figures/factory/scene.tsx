"use client";

/* eslint-disable react/no-unknown-property */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  BELT_SEGMENT,
  type BeltPath,
  BUILDINGS,
  type FactoryLayout,
  type ModelName,
  pointOnBelt,
} from "./layout";
import { DEFAULT_LOOK, type FactoryLook, lookStrengths } from "./look";
import { loadModels, type Model } from "./models";
import {
  applyPalette,
  createCompositeMaterial,
  createCompositeUniforms,
  createDownsampleMaterial,
  createInkTarget,
  createSceneMaterial,
  createSceneTarget,
  createSharedUniforms,
  type Palette,
  type SharedUniforms,
} from "./shaders";
import { type ItemKind, type Line, stepLine } from "./sim";
import { frameBox, lightFromLeft, viewBasis } from "./view";

const ITEM_KINDS: readonly ItemKind[] = ["ore", "ingot", "screw"];
/** Most pixels a supersampled frame may have. */
const PIXEL_BUDGET = 20e6;
/** Drill turns per second while the miner works. */
const DRILL_SPEED = Math.PI * 0.8;

/** Position and heading `s` metres along a polyline. */
function sample(
  points: readonly THREE.Vector3[],
  lengths: number[],
  s: number,
) {
  let i = 1;
  while (i < points.length - 1 && lengths[i] < s) i++;
  const a = points[i - 1];
  const b = points[i];
  const run = lengths[i] - lengths[i - 1];
  const k = run > 0 ? (s - lengths[i - 1]) / run : 0;
  return {
    position: a.clone().lerp(b, k),
    tangent: b.clone().sub(a).normalize(),
  };
}

/**
 * Bends the 2 m belt mesh along a path: whole tiles stretched to fit, every
 * vertex carried into the path's frame (along, up, across), so curves stay
 * continuous like the game's spline belts.
 */
function sweepBelt(path: BeltPath, model: Model) {
  const points = path.points.map((p) => new THREE.Vector3(...p));
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    lengths.push(lengths[i - 1] + points[i].distanceTo(points[i - 1]));
  }
  const total = lengths[lengths.length - 1];
  const tiles = Math.max(1, Math.round(total / BELT_SEGMENT));
  const tile = total / tiles;
  const src = model.geometry;
  const pos = src.getAttribute("position");
  const nrm = src.getAttribute("normal");
  const part = src.getAttribute("_part");
  const index = src.getIndex();
  const count = pos.count;
  const positions = new Float32Array(count * tiles * 3);
  const normals = new Float32Array(count * tiles * 3);
  const parts = new Uint16Array(count * tiles);
  const indices: number[] = [];
  const world = new THREE.Vector3(0, 1, 0);
  const across = new THREE.Vector3();
  const up = new THREE.Vector3();
  for (let t = 0; t < tiles; t++) {
    for (let v = 0; v < count; v++) {
      const along = Math.min(Math.max(pos.getX(v), 0), BELT_SEGMENT);
      const s = Math.min((t + along / BELT_SEGMENT) * tile, total);
      const { position, tangent } = sample(points, lengths, s);
      across.crossVectors(tangent, world).normalize();
      up.crossVectors(across, tangent).normalize();
      const o = (t * count + v) * 3;
      const p = position
        .addScaledVector(up, pos.getY(v))
        .addScaledVector(across, pos.getZ(v));
      positions[o] = p.x;
      positions[o + 1] = p.y;
      positions[o + 2] = p.z;
      const n = tangent
        .multiplyScalar(nrm.getX(v))
        .addScaledVector(up, nrm.getY(v))
        .addScaledVector(across, nrm.getZ(v))
        .normalize();
      normals[o] = n.x;
      normals[o + 1] = n.y;
      normals[o + 2] = n.z;
      parts[t * count + v] = part.getX(v);
    }
    if (index) {
      for (let k = 0; k < index.count; k++) {
        indices.push(index.getX(k) + t * count);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("_part", new THREE.BufferAttribute(parts, 1));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function buildScene(
  models: Map<ModelName, Model>,
  layout: FactoryLayout,
  line: Line,
  shared: SharedUniforms,
) {
  const model = (name: ModelName) => {
    const m = models.get(name);
    if (!m) throw new Error(`Missing model ${name}.`);
    return m;
  };
  const root = new THREE.Group();
  let idBase = 0;
  const take = (n: number) => {
    const base = idBase;
    idBase += n;
    return base;
  };
  const material = (m: Model) =>
    createSceneMaterial(shared, { parts: m.parts, idBase: take(m.partCount) });

  // Foundations: every tile keeps its own part ids so seams ink.
  const tile = model("foundation");
  const tiles = new THREE.InstancedMesh(
    tile.geometry,
    createSceneMaterial(shared, {
      parts: tile.parts,
      idBase: take(tile.partCount * layout.tiles.length),
      instanceStride: tile.partCount,
    }),
    layout.tiles.length,
  );
  const m4 = new THREE.Matrix4();
  layout.tiles.forEach(([x, z], i) => {
    tiles.setMatrixAt(i, m4.makeTranslation(x, 0, z));
  });
  tiles.frustumCulled = false;
  root.add(tiles);

  // Buildings: one material each so they can wake and spin on their own.
  const buildingMaterials = layout.buildings.map((b) => {
    const m = model(BUILDINGS[b.kind].model);
    const mat = material(m);
    const mesh = new THREE.Mesh(m.geometry, mat);
    mesh.position.set(...b.position);
    mesh.rotation.y = b.yaw;
    root.add(mesh);
    if (b.kind === "miner") {
      const node = model("node-iron");
      const rock = new THREE.Mesh(node.geometry, material(node));
      // The node sits under the miner, its top just below the slab's level.
      rock.position.set(b.position[0], b.position[1] - 0.5, b.position[2]);
      root.add(rock);
    }
    return mat;
  });

  for (const path of layout.belts) {
    const m = model(path.tier === "mk3" ? "belt-mk3" : "belt");
    root.add(new THREE.Mesh(sweepBelt(path, m), material(m)));
  }

  // Items: one instanced mesh per kind, sized for every belt that carries it.
  const items = new Map<ItemKind, THREE.InstancedMesh>();
  for (const kind of ITEM_KINDS) {
    const capacity = line.belts
      .filter((b) => b.item === kind)
      .reduce((n, b) => n + Math.floor(b.length / b.spacing) + 2, 0);
    if (capacity === 0) continue;
    const m = model(kind);
    const mesh = new THREE.InstancedMesh(
      m.geometry,
      createSceneMaterial(shared, {
        parts: m.parts,
        idBase: take(capacity),
        instanceStride: 1,
        partIds: false,
        swatches: m.swatches,
      }),
      capacity,
    );
    mesh.count = 0;
    mesh.frustumCulled = false;
    items.set(kind, mesh);
    root.add(mesh);
  }

  return { root, buildingMaterials, items };
}

export interface FactorySceneProps {
  line: Line;
  layout: FactoryLayout;
  palette: Palette;
  /** Advance the simulation every frame. */
  running: boolean;
  /** Bump to redraw a still frame after the line changed outside the loop. */
  version: number;
  /** Wheel to zoom, drag to pan, double-click to reset. */
  explore: boolean;
  /** How the drawing is inked. */
  look?: FactoryLook;
  onReady?: () => void;
}

function Factory({
  models,
  line,
  layout,
  palette,
  running,
  version,
  explore,
  look = DEFAULT_LOOK,
}: FactorySceneProps & { models: Map<ModelName, Model> }) {
  const shared = useMemo(createSharedUniforms, []);
  const compositeUniforms = useMemo(createCompositeUniforms, []);
  const basis = useMemo(() => viewBasis(), []);
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const size = useThree((s) => s.size);

  const scene = useMemo(
    () => buildScene(models, layout, line, shared),
    [models, layout, line, shared],
  );

  const composite = useMemo(() => {
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      createCompositeMaterial(compositeUniforms),
    );
    quad.frustumCulled = false;
    const quadScene = new THREE.Scene();
    quadScene.add(quad);
    const downsample = createDownsampleMaterial();
    const down = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), downsample);
    down.frustumCulled = false;
    const downScene = new THREE.Scene();
    downScene.add(down);
    return {
      scene: quadScene,
      downScene,
      downsample,
      camera: new THREE.Camera(),
    };
  }, [compositeUniforms]);

  const target = useMemo(() => createSceneTarget(1, 1), []);
  const ink = useMemo(() => createInkTarget(1, 1), []);
  useEffect(
    () => () => {
      target.dispose();
      ink.dispose();
    },
    [target, ink],
  );

  useEffect(() => {
    void look;
    invalidate();
  }, [look, invalidate]);

  // Theme tokens and the light from screen-left.
  useEffect(() => {
    applyPalette(palette, shared, compositeUniforms);
    shared.uLight.value.set(...lightFromLeft(basis));
    invalidate();
  }, [palette, shared, compositeUniforms, basis, invalidate]);

  useEffect(() => {
    void version;
    invalidate();
  }, [version, invalidate]);

  // Framing: the whole factory fits, then the viewer's zoom and pan apply.
  const view = useRef({ zoom: 1, x: 0, y: 0 });
  const frame = useMemo(
    () => frameBox(layout.min, layout.max, basis),
    [layout, basis],
  );
  const fit =
    Math.min(size.width / frame.width, size.height / frame.height) * 0.96;
  const applyView = () => {
    const { zoom, x, y } = view.current;
    const [cx, cy, cz] = frame.center;
    const { right: r, up: u, back: b } = basis;
    const px = cx + r[0] * x + u[0] * y;
    const py = cy + r[1] * x + u[1] * y;
    const pz = cz + r[2] * x + u[2] * y;
    camera.position.set(px + b[0] * 150, py + b[1] * 150, pz + b[2] * 150);
    camera.up.set(0, 1, 0);
    camera.lookAt(px, py, pz);
    camera.near = 1;
    camera.far = 300;
    camera.zoom = fit * zoom;
    camera.updateProjectionMatrix();
    compositeUniforms.uDepthRange.value = camera.far - camera.near;
    invalidate();
  };
  const applyRef = useRef(applyView);
  applyRef.current = applyView;
  // Re-frame when the canvas resizes or the layout changes.
  useLayoutEffect(() => {
    void fit;
    void frame;
    applyRef.current();
  }, [fit, frame]);

  useEffect(() => {
    if (!explore) return;
    const el = gl.domElement;
    const scale = () => fit * view.current.zoom;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left - rect.width / 2;
      const sy = e.clientY - rect.top - rect.height / 2;
      const before = scale();
      const zoom = Math.min(
        40,
        Math.max(0.5, view.current.zoom * Math.exp(-e.deltaY * 0.0015)),
      );
      view.current.zoom = zoom;
      const after = scale();
      // Keep the point under the pointer where it is.
      view.current.x += sx * (1 / before - 1 / after);
      view.current.y -= sy * (1 / before - 1 / after);
      applyRef.current();
    };
    let drag: { x: number; y: number } | null = null;
    const down = (e: PointerEvent) => {
      drag = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      view.current.x -= (e.clientX - drag.x) / scale();
      view.current.y += (e.clientY - drag.y) / scale();
      drag = { x: e.clientX, y: e.clientY };
      applyRef.current();
    };
    const up = () => {
      drag = null;
    };
    const reset = () => {
      view.current = { zoom: 1, x: 0, y: 0 };
      applyRef.current();
    };
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("dblclick", reset);
    el.style.cursor = "grab";
    el.style.touchAction = "none";
    return () => {
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("dblclick", reset);
    };
  }, [explore, gl, fit]);

  const spin = useRef(0);
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const quaternion = useMemo(() => new THREE.Quaternion(), []);
  const euler = useMemo(() => new THREE.Euler(0, 0, 0, "YXZ"), []);
  const position = useMemo(() => new THREE.Vector3(), []);
  const unit = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const buffer = useMemo(() => new THREE.Vector2(), []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    // The parent owns the line; this loop only moves it forward.
    if (running) stepLine(line, dt);

    const miner = line.nodes[0];
    if (running && miner?.status === "working")
      spin.current += dt * DRILL_SPEED;
    scene.buildingMaterials.forEach((material, i) => {
      material.uniforms.uLit.value =
        line.nodes[i]?.status === "working" ? 1 : 0;
      material.uniforms.uSpin.value = spin.current;
    });

    for (const mesh of scene.items.values()) mesh.count = 0;
    line.belts.forEach((belt, i) => {
      const mesh = scene.items.get(belt.item);
      const path = layout.belts[i];
      if (!mesh || !path) return;
      for (const t of belt.items) {
        if (mesh.count >= mesh.instanceMatrix.count) break;
        const point = pointOnBelt(path, t);
        position.set(...point.position);
        quaternion.setFromEuler(euler.set(-point.pitch, point.yaw, 0, "YXZ"));
        matrix.compose(position, quaternion, unit);
        mesh.setMatrixAt(mesh.count, matrix);
        mesh.count += 1;
      }
    });
    for (const mesh of scene.items.values())
      mesh.instanceMatrix.needsUpdate = true;

    const { gl: renderer } = state;
    renderer.getDrawingBufferSize(buffer);
    // Supersample, but stay inside what the GPU can hold and a pixel budget:
    // a high-DPI screen already has fine pixels, so it needs less.
    const limit = renderer.capabilities.maxTextureSize;
    const factor = Math.max(
      1,
      Math.min(
        look.supersample,
        Math.floor(limit / Math.max(buffer.x, buffer.y)),
        Math.floor(Math.sqrt(PIXEL_BUDGET / (buffer.x * buffer.y))),
      ),
    );
    const w = buffer.x * factor;
    const h = buffer.y * factor;
    if (target.width !== w || target.height !== h) {
      target.setSize(w, h);
      ink.setSize(w, h);
    }
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);
    renderer.render(scene.root, state.camera);

    // Ink at the supersampled size, then average down onto the canvas.
    const strengths = lookStrengths(look, camera.zoom);
    compositeUniforms.tColor.value = target.textures[0];
    compositeUniforms.tData.value = target.textures[1];
    compositeUniforms.tDepth.value = target.depthTexture;
    compositeUniforms.uRadius.value = look.lineWidth;
    compositeUniforms.uCrease.value = strengths.crease;
    compositeUniforms.uDetail.value = strengths.detail;
    renderer.setRenderTarget(ink);
    renderer.clear(true, true, true);
    renderer.render(composite.scene, composite.camera);

    composite.downsample.uniforms.tInk.value = ink.texture;
    composite.downsample.uniforms.uFactor.value = factor;
    renderer.setRenderTarget(null);
    renderer.clear(true, true, true);
    renderer.render(composite.downScene, composite.camera);
  }, 1);

  return null;
}

/** Loads the packed models, then draws; nothing shows until they are in. */
function Loaded(props: FactorySceneProps) {
  const [models, setModels] = useState<Map<ModelName, Model> | null>(null);
  const { onReady } = props;
  useEffect(() => {
    const controller = new AbortController();
    loadModels(controller.signal)
      .then((m) => {
        setModels(m);
        onReady?.();
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [onReady]);
  return models ? <Factory {...props} models={models} /> : null;
}

export default function FactoryScene(props: FactorySceneProps) {
  return (
    <Canvas
      orthographic
      dpr={[1, 2]}
      frameloop={props.running ? "always" : "demand"}
      gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
      aria-hidden
      className="absolute! inset-0"
    >
      <Loaded {...props} />
    </Canvas>
  );
}
