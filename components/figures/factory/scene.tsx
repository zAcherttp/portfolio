"use client";

/* eslint-disable react/no-unknown-property */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import {
  type Layer,
  layerPose,
  type Player,
  type Pose,
  poseOf,
  startLayer,
  startPlayer,
  stepLayer,
  stepPlayer,
} from "./animation";
import {
  type Explore,
  panBy,
  release,
  type Stage,
  viewOf,
  WHOLE,
  zoomAbout,
} from "./explore";
import { itemYaw } from "./game";
import {
  BELT_SEGMENT,
  type BeltPath,
  BUILDINGS,
  contentPoints,
  type FactoryLayout,
  lightsOf,
  type ModelName,
  pointOnBelt,
  portVolumes,
  powerOf,
  shadowViews,
  smokeOf,
  toWorld,
  wirePoints,
} from "./layout";
import {
  DEFAULT_LOOK,
  type FactoryLook,
  HALFTONE_CELL,
  lookStrengths,
} from "./look";
import { type Animation, loadModels, type Model } from "./models";
import { profiler, timeMeshes } from "./profile";
import { createGovernor, govern } from "./quality";
import {
  builtShare,
  type RevealMode,
  revealClock,
  revealPlanOf,
  scheduleOf,
  seamsAt,
} from "./reveal";
import {
  applyPalette,
  createCompositeMaterial,
  createCompositeUniforms,
  createDownsampleMaterial,
  createInkTarget,
  createPartsTexture,
  createPortTexture,
  createSceneMaterial,
  createSceneTarget,
  createSharedUniforms,
  createSmokeMaterial,
  createSmokeTarget,
  createSparkMaterial,
  MAX_LIGHTS,
  MAX_VIEWS,
  type Palette,
  rgb,
  type SharedUniforms,
} from "./shaders";
import { flashLevel, type ItemKind, type Line, stepLine } from "./sim";
import { createSmoke, MAX_PUFFS, puffLook, stepSmoke } from "./smoke";
import { createWelder, MAX_SPARKS, sparkLook, stepWelder } from "./sparks";
import { framePoints, lightFromLeft, viewBasis } from "./view";

const ITEM_KINDS: readonly ItemKind[] = ["ore", "ingot", "screw"];
/** Most pixels a supersampled frame may have. */
const PIXEL_BUDGET = 20e6;
/** The view eases after the gestures with this time constant, seconds. */
const EASE = 0.09;
/** Under a drag, panning follows with this much softer time constant. */
const PAN_EASE = 0.015;
/** Wheel zoom per CSS pixel of scroll. */
const WHEEL_ZOOM = 0.002;
/** A double-click on the deck zooms in this far. */
const CLICK_ZOOM = 2.5;
/** On the deck, keys pan by this much; page keys by this share of it. */
const KEY_STEP = 80;
const PAGE_STEP = 0.8;
/** The default reveal: already standing. */
const BUILT_REVEAL = { mode: "built", armed: true } as const;
/** Drill turns per second while the miner works. */
const DRILL_SPEED = Math.PI * 0.8;
/** Seconds a machine's accents take to wake, and to fall asleep. */
const WAKE_UP = 0.25;
const WAKE_DOWN = 0.6;
/** Build_PowerLine's cable: PowerLine_static is 8.5 cm thick. */
const WIRE_RADIUS = 0.0425;
/** The structure tone role, for wires. */
const STRUCTURE_ROLE = 1;
/** Texels along each face of a light's shadow cube. */
const SHADOW_SIZE = 256;
/** What the shadow cubes read as while they are drawn. */
const NO_SHADOWS: (THREE.Texture | null)[] = Array.from(
  { length: MAX_VIEWS },
  () => null,
);
/**
 * The bone a building's producing loop moves furthest up and down (the
 * smelter's press), with the lowest and highest it sits.
 */
function pressOf(animation: Animation) {
  const clip = animation.clips.producing;
  if (!clip) return null;
  const data = animation.texture.image.data as Float32Array;
  const width = animation.texture.image.width;
  let best: { bone: number; low: number; high: number } | null = null;
  for (let bone = 0; bone < animation.bones; bone++) {
    let low = Infinity;
    let high = -Infinity;
    for (let f = 0; f < clip.frames; f++) {
      const y = data[(bone * width + clip.start + f) * 4 + 1];
      low = Math.min(low, y);
      high = Math.max(high, y);
    }
    if (!best || high - low > best.high - best.low) best = { bone, low, high };
  }
  return best;
}

/** How far down a bone sits at a pose, from the animation texture. */
function boneHeight(animation: Animation, bone: number, pose: Pose) {
  const data = animation.texture.image.data as Float32Array;
  const width = animation.texture.image.width;
  const at = (column: number) => data[(bone * width + column) * 4 + 1];
  return at(pose.a) + (at(pose.b) - at(pose.a)) * pose.mix;
}

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
  const mask = src.getAttribute("_mask");
  const index = src.getIndex();
  const count = pos.count;
  const positions = new Float32Array(count * tiles * 3);
  const normals = new Float32Array(count * tiles * 3);
  const parts = new Uint16Array(count * tiles);
  const masks = mask ? new Float32Array(count * tiles * 4) : null;
  const alongs = new Float32Array(count * tiles);
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
      alongs[t * count + v] = s;
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
      if (mask && masks) {
        const m = (t * count + v) * 4;
        masks[m] = mask.getX(v);
        masks[m + 1] = mask.getY(v);
        masks[m + 2] = mask.getZ(v);
        masks[m + 3] = mask.getW(v);
      }
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
  if (masks)
    geometry.setAttribute("_mask", new THREE.BufferAttribute(masks, 4));
  geometry.setAttribute("_along", new THREE.BufferAttribute(alongs, 1));
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
  const material = (m: Model, ports: readonly number[] = []) =>
    createSceneMaterial(shared, {
      parts: m.parts,
      idBase: take(m.partCount),
      ports,
      glowMask: m.glowMask,
      glyph: m.glyph,
    });

  // Every opening of every building darkens inward; the scene holds them all.
  const doors = portVolumes(
    layout,
    (b) => model(BUILDINGS[b.kind].model).openings,
  );
  // Lights the buildings give off; an opening that glows takes its light.
  const lights = lightsOf(
    layout,
    (b) => model(BUILDINGS[b.kind].model).openings,
  ).slice(0, MAX_LIGHTS);
  lights.forEach((light, i) => {
    shared.uLightA.value[i].set(...light.position, light.reach);
    // A face's facing; a sphere's band, as sines of its elevations.
    const [low, high] = light.band.map((deg) =>
      Math.sin((deg * Math.PI) / 180),
    );
    if (light.kind !== "sphere")
      shared.uLightB.value[i].set(...light.normal, 1);
    else shared.uLightB.value[i].set(low, high, 0, 0);
    shared.uLightC.value[i].set(
      light.halfWidth,
      light.halfHeight,
      0,
      light.radius,
    );
  });
  shared.uLightCount.value = lights.length;
  const views = shadowViews(lights).slice(0, MAX_VIEWS);
  views.forEach((view, v) => {
    shared.uViewA.value[v].set(...view.origin, view.size);
    shared.uViewLight.value[v] = view.light;
  });
  shared.uViewCount.value = views.length;
  shared.uPorts.value = createPortTexture(
    doors.ports.map((port) => ({
      ...port,
      light: lights.findIndex(
        (l) => l.building === port.building && l.port === port.name,
      ),
    })),
  );

  // What gets placed together, for the build reveal: the platform (and the
  // node under the miner), each belt, the pole, each wire, and the items.
  const groups = {
    platform: [] as THREE.ShaderMaterial[],
    belts: [] as THREE.ShaderMaterial[],
    pole: [] as THREE.ShaderMaterial[],
    wires: [] as THREE.ShaderMaterial[],
    items: [] as THREE.ShaderMaterial[],
  };
  /** Each wire's length, metres, in the order they are run. */
  const wireLengths: number[] = [];

  // Foundations: every tile keeps its own part ids so seams ink. Tiles under
  // a building on its node are drawn faint, so the node shows through.
  const tile = model("foundation");
  const m4 = new THREE.Matrix4();
  for (const faint of [false, true]) {
    const at = layout.tiles.filter((_, i) => layout.faint[i] === faint);
    if (at.length === 0) continue;
    const tiles = new THREE.InstancedMesh(
      tile.geometry,
      createSceneMaterial(shared, {
        parts: tile.parts,
        idBase: take(tile.partCount * at.length),
        instanceStride: tile.partCount,
        faint,
      }),
      at.length,
    );
    at.forEach(([x, z], i) => {
      tiles.setMatrixAt(i, m4.makeTranslation(x, 0, z));
    });
    tiles.frustumCulled = false;
    groups.platform.push(tiles.material);
    root.add(tiles);
  }

  // Buildings: one material each so they can wake, spin and animate on their own.
  const players: (Player | null)[] = [];
  const layers: (Layer | null)[] = [];
  const buildingMaterials = layout.buildings.map((b, i) => {
    const m = model(BUILDINGS[b.kind].model);
    const mat = createSceneMaterial(shared, {
      parts: m.parts,
      idBase: take(m.partCount),
      animation: m.animation,
      ports: doors.byBuilding[i],
      glowAccents: BUILDINGS[b.kind].glowAccents ?? false,
      cutout: m.cutout,
      glowMask: m.glowMask,
      glyph: m.glyph,
    });
    const core = BUILDINGS[b.kind].core;
    if (core) {
      const centre = toWorld(b, core.at);
      const tip = toWorld(b, [
        core.at[0] + core.axis[0],
        core.at[1] + core.axis[1],
        core.at[2] + core.axis[2],
      ]);
      mat.uniforms.uCore.value.set(...centre, core.length);
      mat.uniforms.uCoreAxis.value.set(
        tip[0] - centre[0],
        tip[1] - centre[1],
        tip[2] - centre[2],
        core.width,
      );
    }
    players.push(m.animation ? startPlayer(m.animation.clips) : null);
    layers.push(m.animation?.layer ? startLayer() : null);
    const mesh = new THREE.Mesh(m.geometry, mat);
    mesh.position.set(...b.position);
    mesh.rotation.y = b.yaw;
    root.add(mesh);
    if (b.kind === "miner") {
      const node = model("node-iron");
      const rock = new THREE.Mesh(node.geometry, material(node));
      // The node sits under the miner, its top just below the slab's level.
      rock.position.set(b.position[0], b.position[1] - 0.5, b.position[2]);
      groups.platform.push(rock.material);
      root.add(rock);
    }
    return mat;
  });

  // Power: the feed pole, and the wires that sag from it and from machine to
  // machine, each its own part so its outline inks.
  const power = powerOf(layout);
  const pole = model("power-pole");
  for (const at of power.poles) {
    const mesh = new THREE.Mesh(pole.geometry, material(pole));
    mesh.position.set(...at);
    groups.pole.push(mesh.material);
    root.add(mesh);
  }
  const wireParts = createPartsTexture(new Uint8Array([STRUCTURE_ROLE]));
  for (const wire of power.wires) {
    const curve = new THREE.CatmullRomCurve3(
      wirePoints(wire).map((p) => new THREE.Vector3(...p)),
    );
    const tube = new THREE.TubeGeometry(curve, 32, WIRE_RADIUS, 6, false);
    // Metres along the wire, from where it is run.
    const length = curve.getLength();
    const uv = tube.getAttribute("uv");
    const along = new Float32Array(uv.count);
    for (let v = 0; v < uv.count; v++) along[v] = uv.getX(v) * length;
    tube.setAttribute("_along", new THREE.BufferAttribute(along, 1));
    wireLengths.push(length);
    tube.setAttribute(
      "_part",
      new THREE.BufferAttribute(
        new Uint16Array(tube.getAttribute("position").count),
        1,
      ),
    );
    const wireMaterial = createSceneMaterial(shared, {
      parts: wireParts,
      idBase: take(1),
    });
    if (wire.fade !== undefined) {
      wireMaterial.uniforms.uFade.value.set(length * wire.fade, length);
    }
    groups.wires.push(wireMaterial);
    root.add(new THREE.Mesh(tube, wireMaterial));
  }

  layout.belts.forEach((path, i) => {
    const m = model(path.tier === "mk3" ? "belt-mk3" : "belt");
    const beltMaterial = material(m, doors.byBelt[i]);
    groups.belts.push(beltMaterial);
    root.add(new THREE.Mesh(sweepBelt(path, m), beltMaterial));
  });

  // Chimney smoke: one camera-facing square per puff, all in one mesh.
  const chimneys = smokeOf(layout).map((c) => {
    const animation = model(
      BUILDINGS[layout.buildings[c.building].kind].model,
    ).animation;
    return {
      building: c.building,
      source: createSmoke(c.position),
      press: animation ? pressOf(animation) : null,
    };
  });
  const puffs = new THREE.InstancedMesh(
    (() => {
      const square = new THREE.PlaneGeometry(2, 2);
      const capacity = Math.max(1, chimneys.length * MAX_PUFFS);
      square.setAttribute(
        "aPuff",
        new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4),
      );
      square.setAttribute(
        "aAlpha",
        new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1),
      );
      return square;
    })(),
    createSmokeMaterial(shared),
    Math.max(1, chimneys.length * MAX_PUFFS),
  );
  puffs.count = 0;
  puffs.frustumCulled = false;
  // Drawn on its own after the scene, against the scene's depth.
  const smoke = new THREE.Scene();
  smoke.add(puffs);

  // Weld sparks: a welder per constructor, all its sparks in one mesh of
  // streaks (two corners at the head, two at the tail).
  const welders = layout.buildings.flatMap((b, i) =>
    b.kind === "constructor" ? [{ building: i, welder: createWelder() }] : [],
  );
  const sparkCapacity = Math.max(1, welders.length * MAX_SPARKS);
  const streak = new THREE.InstancedBufferGeometry();
  streak.setAttribute(
    "position",
    new THREE.BufferAttribute(
      new Float32Array([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0]),
      3,
    ),
  );
  streak.setIndex([0, 1, 2, 0, 2, 3]);
  for (const [name, size] of [
    ["aHead", 3],
    ["aTail", 3],
    ["aHeat", 1],
  ] as const) {
    streak.setAttribute(
      name,
      new THREE.InstancedBufferAttribute(
        new Float32Array(sparkCapacity * size),
        size,
      ),
    );
  }
  streak.instanceCount = 0;
  const sparks = new THREE.Mesh(streak, createSparkMaterial(shared));
  sparks.frustumCulled = false;
  sparks.renderOrder = 1;
  root.add(sparks);

  // Items: one instanced mesh per kind, sized for every belt that carries it.
  const items = new Map<ItemKind, THREE.InstancedMesh>();
  for (const kind of ITEM_KINDS) {
    const capacity = line.belts
      .filter((b) => b.item === kind)
      .reduce((n, b) => n + Math.floor(b.length / b.spacing) + 2, 0);
    if (capacity === 0) continue;
    const m = model(kind);
    // Each item fades into the ports at either end of the belt it rides.
    const geometry = m.geometry.clone();
    geometry.setAttribute(
      "_ports",
      new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2),
    );
    const mesh = new THREE.InstancedMesh(
      geometry,
      createSceneMaterial(shared, {
        parts: m.parts,
        idBase: take(capacity),
        instanceStride: 1,
        partIds: false,
        swatches: m.swatches,
        portsPerInstance: true,
      }),
      capacity,
    );
    mesh.count = 0;
    mesh.frustumCulled = false;
    groups.items.push(mesh.material);
    items.set(kind, mesh);
    root.add(mesh);
  }

  const animations = layout.buildings.map(
    (b) => model(BUILDINGS[b.kind].model).animation ?? null,
  );
  return {
    root,
    groups,
    wireLengths,
    buildingMaterials,
    wake: layout.buildings.map(() => 0),
    power: 0,
    lights,
    views,
    items,
    players,
    layers,
    animations,
    beltPorts: doors.byBelt,
    chimneys,
    puffs,
    welders,
    sparks,
    smoke,
  };
}

/** Where the deck is: open or not, and the slot it grew out of. */
export interface DeckState {
  open: boolean;
  slot: { left: number; top: number; width: number; height: number } | null;
  element: HTMLElement | null;
  /** Hold the slot's view on the opened deck until it is shown. */
  hold: boolean;
  /** Supersample as the slot did, so ink keeps its weight across the swap. */
  factor: number | null;
}

/** Where the deck stands, as each frame is drawn. */
export type DeckPhase = "slot" | "opening" | "open" | "closing" | "closed";

/** A frame just drawn: copy `canvas` now, before the browser shows it. */
export interface DrawnFrame {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  factor: number;
  deck: DeckPhase;
}

export interface FactorySceneProps {
  line: Line;
  layout: FactoryLayout;
  palette: Palette;
  /** Advance the simulation every frame. */
  running: boolean;
  /** Bump to redraw a still frame after the line changed outside the loop. */
  version: number;
  /** Free exploring: the wheel zooms, a drag pans, a double-click resets. */
  explore: boolean;
  /** Snap the view instead of easing it. */
  reducedMotion?: boolean;
  /**
   * The deck the drawing sits on. Closed, it sits in its slot on the page;
   * open, it fills the screen to explore, grown out of `slot` (its box on
   * screen when it opened), clipping `element` as it grows and shrinks.
   */
  deck?: DeckState;
  /** Bump to close the open deck back into its slot. */
  closeDeck?: number;
  /** Each frame once drawn, with where the deck stands. */
  onDrawn?: (frame: DrawnFrame) => void;
  /**
   * Filled with a function that takes a new palette and draws with it at
   * once, so a theme change can land in the same frame as the page's.
   */
  repaint?: RefObject<((palette: Palette) => void) | null>;
  /** How the drawing is inked. */
  look?: FactoryLook;
  /** Line time per real second, for checking the line quickly. */
  speed?: number;
  /** Draw every triangle's edges, to see where the geometry goes. */
  wireframe?: boolean;
  /** The models failed to load or the drawing could not start. */
  onError?: (reason: string) => void;
  /** The GPU dropped the drawing; `restored` once it can be drawn again. */
  onContext?: (state: "lost" | "restored") => void;
  /**
   * How the factory appears: placed piece by piece, or risen on one seam,
   * once `armed`; already built by default.
   */
  reveal?: { mode: RevealMode; armed: boolean };
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
  speed = 1,
  wireframe = false,
  reveal = BUILT_REVEAL,
  reducedMotion = false,
  deck,
  closeDeck = 0,
  onDrawn,
  repaint,
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

  // Each shadow view keeps a cube of distances to what it sees.
  const shadows = useMemo(() => {
    const floats = gl.extensions.has("EXT_color_buffer_float");
    return scene.views.map((view) => {
      const { reach } = scene.lights[view.light];
      const target = new THREE.WebGLCubeRenderTarget(SHADOW_SIZE, {
        type: floats ? THREE.HalfFloatType : THREE.UnsignedByteType,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        generateMipmaps: false,
      });
      const camera = new THREE.CubeCamera(0.02, reach, target);
      camera.position.set(...view.origin);
      camera.updateMatrixWorld();
      return {
        target,
        camera,
        reach,
        light: view.light,
        moving: view.moving,
        drawn: false,
      };
    });
  }, [gl, scene]);
  useEffect(() => {
    shadows.forEach((shadow, i) => {
      shared.uShadows.value[i] = shadow.target.texture;
    });
    invalidate();
    return () => {
      for (const shadow of shadows) shadow.target.dispose();
    };
  }, [shadows, shared, invalidate]);

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
  const smokeTarget = useMemo(() => createSmokeTarget(1, 1), []);

  // Compile every shader before the first frame, in the background where the
  // browser can, each for the target it draws to (three.js keeps a shader
  // per kind of target). Compiled by the first frame instead, they hold it
  // up for a second or more, and the page with it.
  const ready = useRef(false);
  useEffect(() => {
    ready.current = false;
    let live = true;
    const was = gl.getRenderTarget();
    const compile = (
      root: THREE.Object3D,
      eye: THREE.Camera,
      on: THREE.WebGLRenderTarget | null,
    ) => {
      gl.setRenderTarget(on);
      return gl.compileAsync(root, eye);
    };
    const compiling = Promise.all([
      compile(scene.root, camera, target),
      compile(scene.smoke, camera, smokeTarget),
      compile(composite.scene, composite.camera, ink),
      compile(composite.downScene, composite.camera, null),
    ]);
    gl.setRenderTarget(was);
    compiling
      .catch(() => undefined)
      .then(() => {
        if (!live) return;
        ready.current = true;
        invalidate();
      });
    return () => {
      live = false;
    };
  }, [gl, scene, camera, target, smokeTarget, composite, ink, invalidate]);
  useEffect(
    () => () => {
      target.dispose();
      ink.dispose();
      smokeTarget.dispose();
    },
    [target, ink, smokeTarget],
  );

  useEffect(() => {
    void look;
    invalidate();
  }, [look, invalidate]);

  useEffect(() => {
    scene.root.traverse((object) => {
      const { material } = object as THREE.Mesh;
      if (material && !Array.isArray(material)) {
        (material as THREE.ShaderMaterial).wireframe = wireframe;
      }
    });
    invalidate();
  }, [scene, wireframe, invalidate]);

  // Theme tokens and the light from screen-left.
  const paint = useCallback(
    (palette: Palette) => {
      applyPalette(palette, shared, compositeUniforms);
      // Each light and each building's glowing body take their palette colour.
      scene.lights.forEach((light, l) => {
        shared.uLightColour.value[l].set(...rgb(palette[light.colour]));
      });
      scene.buildingMaterials.forEach((material, i) => {
        const colour =
          BUILDINGS[layout.buildings[i].kind].lightColour ?? "glow";
        material.uniforms.uGlowColour.value.set(...rgb(palette[colour]));
      });
      // Ports fade to the shade of walls facing the picture's right.
      shared.uPortFace.value.set(basis.right[0], 0, basis.right[2]).normalize();
      shared.uLight.value.set(...lightFromLeft(basis));
    },
    [shared, compositeUniforms, basis, scene, layout],
  );
  useEffect(() => {
    paint(palette);
    invalidate();
  }, [palette, paint, invalidate]);
  // A theme change, drawn there and then rather than a frame or two after
  // React passes the palette down.
  const advance = useThree((s) => s.advance);
  useEffect(() => {
    if (!repaint) return;
    repaint.current = (next) => {
      paint(next);
      advance(performance.now());
    };
    return () => {
      repaint.current = null;
    };
  }, [repaint, paint, advance]);

  useEffect(() => {
    void version;
    invalidate();
  }, [version, invalidate]);

  // Framing: the whole factory fits, then the viewer's zoom and pan apply.
  // `explored` is where the gestures put it; `shown` eases after it.
  const explored = useRef<Explore>(WHOLE);
  const shown = useRef({ zoom: 1, x: 0, y: 0 });
  const frame = useMemo(
    () => framePoints(contentPoints(layout), basis),
    [layout, basis],
  );
  const fit =
    Math.min(size.width / frame.width, size.height / frame.height) * 0.96;
  const stage: Stage = {
    width: frame.width,
    height: frame.height,
    fit,
    viewWidth: size.width,
    viewHeight: size.height,
  };
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const applyView = () => {
    const { zoom, x, y } = shown.current;
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

  // The view eases after where the gestures put it, in log space for zoom so
  // zooming in and out feel alike. While it moves, frames draw lighter.
  const viewMoving = useRef(false);
  /** A drag is panning the view now. */
  const dragging = useRef(false);
  const easeView = (delta: number, again: () => void) => {
    const target = viewOf(explored.current, stageRef.current);
    const now = shown.current;
    const step = Math.min(delta, 0.1);
    const k = reducedMotion ? 1 : 1 - Math.exp(-step / EASE);
    // Under a drag that only pans, the view follows nearly at once: easing
    // there reads as lag. Zooming keeps one ease for all, so the point under
    // the pointer stays put.
    const zooming = Math.abs(Math.log(target.zoom / now.zoom)) > 1e-4;
    const kPan =
      dragging.current && !zooming
        ? reducedMotion
          ? 1
          : 1 - Math.exp(-step / PAN_EASE)
        : k;
    const next = {
      zoom: Math.exp(
        Math.log(now.zoom) + (Math.log(target.zoom) - Math.log(now.zoom)) * k,
      ),
      x: now.x + (target.x - now.x) * kPan,
      y: now.y + (target.y - now.y) * kPan,
    };
    const moving =
      Math.abs(next.zoom / target.zoom - 1) > 1e-4 ||
      Math.abs(next.x - target.x) > 1e-3 ||
      Math.abs(next.y - target.y) > 1e-3;
    const shownNext = moving ? next : target;
    const changed =
      shownNext.zoom !== now.zoom ||
      shownNext.x !== now.x ||
      shownNext.y !== now.y;
    shown.current = shownNext;
    if (changed) applyRef.current();
    clipDeck();
    if (!moving && phase.current === "closing") phase.current = "closed";
    // Moving, it draws light; once it stops, one more frame at full quality.
    const settled = viewMoving.current && !moving;
    viewMoving.current = moving;
    if (moving || settled) again();
  };

  // The deck: closed, the drawing sits in its slot on the page; open, it
  // fills the screen, grown out of the slot, to explore; closed again, it
  // shrinks back into the slot. `slotView` is the view, on the open deck,
  // that draws the factory exactly where and as large as the slot did.
  const deckOpen = deck?.open ?? false;
  const deckRef = useRef(deck);
  deckRef.current = deck;
  const phase = useRef<DeckPhase>("slot");
  const slotView = useRef<Explore>(WHOLE);
  const drawnRef = useRef(onDrawn);
  drawnRef.current = onDrawn;
  const deckHold = deck?.hold ?? false;

  // Opening: once the canvas fills the screen, draw the slot's view there and
  // hold it until the deck is shown; then ease out to the whole factory.
  useLayoutEffect(() => {
    const d = deckRef.current;
    if (!deckOpen) {
      phase.current = "slot";
      explored.current = WHOLE;
      shown.current = { zoom: 1, x: 0, y: 0 };
      if (d?.element) d.element.style.clipPath = "";
      applyRef.current();
      return;
    }
    const slot = d?.slot;
    if (phase.current !== "slot" || !slot) return;
    // Still the slot's size: the canvas has not grown yet.
    if (
      Math.abs(size.width - slot.width) < 1 &&
      Math.abs(size.height - slot.height) < 1
    )
      return;
    const fitSlot =
      Math.min(slot.width / frame.width, slot.height / frame.height) * 0.96;
    const rect = gl.domElement.getBoundingClientRect();
    const view: Explore = {
      zoom: fitSlot / fit,
      x: (rect.left + rect.width / 2 - (slot.left + slot.width / 2)) / fitSlot,
      y: (slot.top + slot.height / 2 - (rect.top + rect.height / 2)) / fitSlot,
      pullX: 0,
      pullY: 0,
    };
    slotView.current = view;
    shown.current = { zoom: view.zoom, x: view.x, y: view.y };
    explored.current = view;
    phase.current = "opening";
    applyRef.current();
  }, [deckOpen, size, fit, frame, gl]);

  useEffect(() => {
    if (deckHold || phase.current !== "opening") return;
    phase.current = "open";
    explored.current = WHOLE;
    invalidate();
  }, [deckHold, invalidate]);

  const close = () => {
    if (phase.current !== "open") return;
    phase.current = "closing";
    explored.current = slotView.current;
    invalidate();
  };
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (closeDeck > 0) closeRef.current();
  }, [closeDeck]);

  // While it grows or shrinks, the deck shows only as far as the factory has
  // grown: clipped from the slot's box out to the screen.
  const clipDeck = () => {
    const d = deckRef.current;
    if (!d?.element || !d.slot || phase.current === "slot") return;
    const z0 = slotView.current.zoom;
    const q =
      z0 < 1
        ? Math.min(1, Math.max(0, Math.log(shown.current.zoom) / Math.log(z0)))
        : 0;
    if (q < 1e-3) {
      d.element.style.clipPath = "";
      return;
    }
    const { left, top, width, height } = d.slot;
    // The deck's own size: the viewport without its scrollbar.
    const right = d.element.clientWidth - left - width;
    const bottom = d.element.clientHeight - top - height;
    d.element.style.clipPath = `inset(${top * q}px ${right * q}px ${bottom * q}px ${left * q}px)`;
  };

  // Gestures, exploring freely (the full-screen view) or on the open deck
  // alike: the wheel and a pinch zoom about the pointer, a drag pans with
  // rubber-band edges, a double-click returns it whole. On the deck, keys pan
  // too, and zooming out past the whole factory (or Esc) closes it back into
  // its slot.
  const set = (next: Explore) => {
    explored.current = next;
    invalidate();
  };
  const setRef = useRef(set);
  setRef.current = set;

  useEffect(() => {
    if (!explore && !deckOpen) return;
    const free = explore;
    const el = gl.domElement;
    // On the deck, only while it is fully open: not as it grows or shrinks.
    const live = () => free || phase.current === "open";
    const put = (next: Explore) => {
      if (live()) setRef.current(next);
    };
    const shut = () => closeRef.current();
    const local = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect();
      return [
        clientX - rect.left - rect.width / 2,
        clientY - rect.top - rect.height / 2,
      ] as const;
    };
    const pan = (dx: number, dy: number) => {
      // Pulled far past an edge, it settles back to the whole factory.
      put(panBy(explored.current, dx, dy, stageRef.current).state);
    };
    const zoomBy = (factor: number, sx: number, sy: number) => {
      // Zooming out past the whole factory on the deck closes it.
      if (!free && factor < 1 && explored.current.zoom <= 1.001) {
        shut();
        return;
      }
      put(zoomAbout(explored.current, factor, sx, sy, stageRef.current));
    };
    let settle = 0;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      // Scrolling zooms about the pointer, freely or on the deck alike.
      const [sx, sy] = local(e.clientX, e.clientY);
      zoomBy(Math.exp(-e.deltaY * unit * WHEEL_ZOOM), sx, sy);
    };
    const touches = new Map<number, { x: number; y: number }>();
    let drag: { id: number; x: number; y: number } | null = null;
    let pinch = 0;
    const spread = () => {
      const [a, b] = [...touches.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType === "touch") {
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (touches.size === 2) {
          drag = null;
          dragging.current = false;
          pinch = spread();
          return;
        }
      }
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
      dragging.current = true;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (touches.has(e.pointerId)) {
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (touches.size === 2 && pinch > 0) {
          const now = spread();
          const [a, b] = [...touches.values()];
          const [sx, sy] = local((a.x + b.x) / 2, (a.y + b.y) / 2);
          zoomBy(now / pinch, sx, sy);
          pinch = now;
          return;
        }
      }
      if (!drag || drag.id !== e.pointerId) return;
      pan(e.clientX - drag.x, e.clientY - drag.y);
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    };
    const up = (e: PointerEvent) => {
      touches.delete(e.pointerId);
      if (touches.size < 2) pinch = 0;
      if (drag?.id === e.pointerId) {
        drag = null;
        dragging.current = false;
        put(release(explored.current));
      }
    };
    const double = (e: MouseEvent) => {
      if (free || explored.current.zoom > 1.001) {
        put(WHOLE);
        return;
      }
      const [sx, sy] = local(e.clientX, e.clientY);
      put(zoomAbout(explored.current, CLICK_ZOOM, sx, sy, stageRef.current));
    };
    // On the deck, keys pan and Esc closes; the page behind keeps still.
    const key = (e: KeyboardEvent) => {
      if (free) return;
      if (e.key === "Escape") {
        shut();
        return;
      }
      const view = window.innerHeight * PAGE_STEP;
      const moves: Record<string, [number, number]> = {
        ArrowDown: [0, -KEY_STEP],
        ArrowUp: [0, KEY_STEP],
        ArrowLeft: [KEY_STEP, 0],
        ArrowRight: [-KEY_STEP, 0],
        PageDown: [0, -view],
        PageUp: [0, view],
        " ": [0, e.shiftKey ? view : -view],
      };
      const step = moves[e.key];
      if (!step) return;
      e.preventDefault();
      pan(step[0], step[1]);
      window.clearTimeout(settle);
      settle = window.setTimeout(() => put(release(explored.current)), 140);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("dblclick", double);
    window.addEventListener("keydown", key);
    el.style.cursor = "grab";
    el.style.touchAction = "none";
    return () => {
      window.clearTimeout(settle);
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("dblclick", double);
      window.removeEventListener("keydown", key);
      el.style.cursor = "";
      el.style.touchAction = "";
    };
  }, [explore, deckOpen, gl]);

  // Adaptive quality while frames run: see quality.ts.
  const quality = useRef(createGovernor(look.supersample));
  // What it learns holds: stepping back up as the line stops would show.
  useEffect(() => {
    quality.current = createGovernor(look.supersample);
    invalidate();
  }, [invalidate, look.supersample]);

  // Placing: each piece's step in the build, and when the build began.
  const plan = useMemo(
    () => revealPlanOf(layout, scene.wireLengths),
    [layout, scene],
  );
  const schedule = useMemo(() => scheduleOf(plan), [plan]);
  const revealed = useRef<{ time: number | null; done: boolean }>({
    time: null,
    done: false,
  });
  const built = useMemo(() => layout.buildings.map(() => 1), [layout]);

  const spin = useRef(0);
  const shadowFrame = useRef(0);
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const quaternion = useMemo(() => new THREE.Quaternion(), []);
  const euler = useMemo(() => new THREE.Euler(0, 0, 0, "YZX"), []);
  const position = useMemo(() => new THREE.Vector3(), []);
  const origin = useMemo(() => new THREE.Vector3(), []);
  const unit = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const buffer = useMemo(() => new THREE.Vector2(), []);

  // The game's smoke rides the press: it puffs while the press is down in its
  // producing loop, and stops while it is up.
  const puffing = (
    building: number,
    press: ReturnType<typeof pressOf>,
  ): boolean => {
    if (!line.nodes[building]?.crafting) return false;
    const animation = scene.animations[building];
    const player = scene.players[building];
    if (!press || !animation || !player) return true;
    if (player.clip !== "producing") return false;
    const y = boneHeight(
      animation,
      press.bone,
      poseOf(player, animation.clips),
    );
    return y < (press.low + press.high) / 2;
  };

  useFrame((state, delta) => {
    if (!ready.current) return;
    const prof = profiler(state.gl.getContext() as WebGL2RenderingContext);
    const dt = Math.min(delta, 0.1) * speed;
    easeView(delta, state.invalidate);
    // Placing: each group's seam, and how much of each building stands.
    const r = revealed.current;
    r.time = revealClock(r.time, reveal.armed, delta);
    const seams = seamsAt(reveal.mode, r.time, plan, schedule);
    const { groups } = scene;
    for (const m of groups.platform) m.uniforms.uBuild.value.x = seams.platform;
    for (const m of groups.pole) m.uniforms.uBuild.value.x = seams.pole;
    for (const m of groups.items) m.uniforms.uBuild.value.x = seams.items;
    groups.belts.forEach((m, i) => {
      m.uniforms.uAlong.value = seams.belts[i];
    });
    groups.wires.forEach((m, i) => {
      m.uniforms.uAlong.value = seams.wires[i];
    });
    scene.buildingMaterials.forEach((m, i) => {
      const { base, top } = plan.buildings[i];
      m.uniforms.uBuild.value.x = seams.buildings[i];
      built[i] = builtShare(seams.buildings[i], base, top);
    });
    if (!seams.done && r.time !== null) {
      // Keep drawing until it stands, and let shadows catch up as it grows;
      // not before it starts, though, while it waits to be seen.
      state.invalidate();
      if (shadowFrame.current % 3 === 0) {
        for (const shadow of shadows) shadow.drawn = false;
      }
    } else if (!r.done) {
      for (const shadow of shadows) shadow.drawn = false;
    }
    r.done = seams.done;
    // The parent owns the line; this loop only moves it forward.
    if (running) stepLine(line, dt);
    const q = quality.current;
    // Frames come one after another while the line runs or the view moves;
    // only then does their pace say anything.
    if (running || viewMoving.current) govern(q, delta);

    const miner = line.nodes[0];
    if (running && miner?.status === "working")
      spin.current += dt * DRILL_SPEED;
    scene.buildingMaterials.forEach((material, i) => {
      const working = line.nodes[i]?.status === "working";
      // Wake and sleep ease: up in about a quarter second, down slower.
      const target = working ? 1 : 0;
      const level = scene.wake[i];
      const rate = target > level ? 1 / WAKE_UP : 1 / WAKE_DOWN;
      scene.wake[i] =
        target > level
          ? Math.min(target, level + dt * rate)
          : Math.max(target, level - dt * rate);
      material.uniforms.uLit.value = scene.wake[i];
      material.uniforms.uSpin.value = spin.current;
      // Baked machine animation follows the machine's state.
      const animation = scene.animations[i];
      const player = scene.players[i];
      if (animation && player) {
        const next = stepPlayer(
          player,
          working,
          animation.clips,
          running ? dt : 0,
        );
        scene.players[i] = next;
        const pose = poseOf(next, animation.clips);
        material.uniforms.uFrameA.value = pose.a;
        material.uniforms.uFrameB.value = pose.b;
        material.uniforms.uFrameMix.value = pose.mix;
        const layer = scene.layers[i];
        const name = animation.layer;
        if (layer && name) {
          const stepped = stepLayer(
            layer,
            working,
            animation.clips[name],
            running ? dt : 0,
          );
          scene.layers[i] = stepped;
          const over = layerPose(stepped, name, animation.clips);
          material.uniforms.uLayerA.value = over.a;
          material.uniforms.uLayerB.value = over.b;
          material.uniforms.uLayerMix.value = over.mix;
        }
      }
    });

    // A glowing opening stays filled while the line has power; the light it
    // casts flashes with each upload all the same.
    const powered = line.powered ? 1 : 0;
    // Still frames draw only on demand, so there it settles at once.
    if (!running) scene.power = powered;
    else if (powered > scene.power)
      scene.power = Math.min(1, scene.power + dt / WAKE_UP);
    else scene.power = Math.max(0, scene.power - dt / WAKE_DOWN);
    shared.uPower.value = scene.power;

    // Lights glow while their building works, flash with each upload, or
    // stay on with the power.
    scene.lights.forEach((light, l) => {
      shared.uLightC.value[l].z =
        built[light.building] *
        light.strength *
        (light.on === "upload"
          ? flashLevel(line)
          : light.on === "power"
            ? scene.power
            : scene.wake[light.building]);
    });
    // The body each building's light comes from glows as it says.
    scene.buildingMaterials.forEach((material, i) => {
      const on = BUILDINGS[layout.buildings[i].kind].emitterOn ?? "work";
      material.uniforms.uEmitter.value =
        on === "power"
          ? scene.power
          : on === "upload"
            ? flashLevel(line)
            : scene.wake[i];
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
        // Game items face +x: turn that along the belt, then tip it up slopes.
        quaternion.setFromEuler(
          euler.set(0, itemYaw(point.yaw), point.pitch, "YZX"),
        );
        matrix.compose(position, quaternion, unit);
        mesh.setMatrixAt(mesh.count, matrix);
        const [from, to] = scene.beltPorts[i];
        (mesh.geometry.getAttribute("_ports") as THREE.BufferAttribute).setXY(
          mesh.count,
          from,
          to,
        );
        mesh.count += 1;
      }
    });
    for (const mesh of scene.items.values()) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.geometry.getAttribute("_ports").needsUpdate = true;
    }

    // Smoke rises while each smelter produces (the game's Rate 1), and what
    // is already up lives out when it stops.
    const puffAt = scene.puffs.geometry.getAttribute(
      "aPuff",
    ) as THREE.InstancedBufferAttribute;
    const puffAlpha = scene.puffs.geometry.getAttribute(
      "aAlpha",
    ) as THREE.InstancedBufferAttribute;
    let drawn = 0;
    for (const { building, source, press } of scene.chimneys) {
      if (running) {
        stepSmoke(
          source,
          built[building] >= 1 && puffing(building, press) ? 1 : 0,
          dt,
        );
      }
      for (const puff of source.puffs) {
        const { size, alpha } = puffLook(puff);
        puffAt.setXYZW(drawn, ...puff.position, size * look.smokeSize);
        puffAlpha.setX(drawn, alpha);
        drawn += 1;
      }
    }
    scene.puffs.count = drawn;

    // Weld sparks fly while each constructor's arms weld, in its loop's
    // weld windows.
    const streaks = scene.sparks.geometry as THREE.InstancedBufferGeometry;
    const heads = streaks.getAttribute(
      "aHead",
    ) as THREE.InstancedBufferAttribute;
    const tails = streaks.getAttribute(
      "aTail",
    ) as THREE.InstancedBufferAttribute;
    const heats = streaks.getAttribute(
      "aHeat",
    ) as THREE.InstancedBufferAttribute;
    let flying = 0;
    for (const { building, welder } of scene.welders) {
      if (running) {
        const player = scene.players[building];
        const animation = scene.animations[building];
        const length = animation?.clips.producing?.length ?? 0;
        const loop =
          built[building] >= 1 &&
          line.nodes[building]?.crafting &&
          player?.clip === "producing" &&
          length > 0
            ? ((player.time % length) + length) % length
            : null;
        const b = layout.buildings[building];
        stepWelder(welder, loop, dt, (local) => toWorld(b, local));
      }
      for (const s of welder.sparks) {
        if (flying >= heads.count) break;
        const { heat, stretch } = sparkLook(s);
        const [vx, vy, vz] = s.velocity;
        const speed = Math.hypot(vx, vy, vz) || 1;
        const tail = 0.005 * stretch;
        heads.setXYZ(flying, ...s.position);
        tails.setXYZ(
          flying,
          s.position[0] - (vx / speed) * tail,
          s.position[1] - (vy / speed) * tail,
          s.position[2] - (vz / speed) * tail,
        );
        heats.setX(flying, heat);
        flying += 1;
      }
    }
    streaks.instanceCount = flying;
    heads.needsUpdate = true;
    tails.needsUpdate = true;
    heats.needsUpdate = true;
    puffAt.needsUpdate = true;
    puffAlpha.needsUpdate = true;

    const { gl: renderer } = state;
    renderer.getDrawingBufferSize(buffer);
    // Supersample, but stay inside what the GPU can hold and a pixel budget:
    // a high-DPI screen already has fine pixels, so it needs less.
    const limit = renderer.capabilities.maxTextureSize;
    // The view moving draws at the same quality as it standing still, so
    // nothing shifts when it settles; the governor steps it down, once and
    // for good, only if frames can't keep up. As the deck hands off to and
    // from its slot, it supersamples as the slot did.
    const handing =
      deck?.open &&
      deck.factor &&
      (phase.current === "opening" ||
        phase.current === "closing" ||
        phase.current === "closed");
    let factor = Math.max(
      1,
      Math.min(
        look.supersample,
        q.cap,
        handing ? (deck.factor ?? look.supersample) : look.supersample,
        Math.floor(limit / Math.max(buffer.x, buffer.y)),
        Math.floor(Math.sqrt(PIXEL_BUDGET / (buffer.x * buffer.y))),
      ),
    );
    if (prof?.profile.factor) factor = prof.profile.factor;
    if (prof?.profile.lights === false) shared.uLightCount.value = 0;
    const w = buffer.x * factor;
    const h = buffer.y * factor;
    if (target.width !== w || target.height !== h) {
      target.setSize(w, h);
      ink.setSize(w, h);
    }
    if (smokeTarget.width !== buffer.x || smokeTarget.height !== buffer.y) {
      smokeTarget.setSize(buffer.x, buffer.y);
    }
    // Halftone dots: sized in CSS pixels, anchored where the world's origin
    // falls on the supersampled target, so they pan with the scene.
    const scale = factor * renderer.getPixelRatio();
    origin.set(0, 0, 0).project(camera);
    shared.uHalftoneOrigin.value.set(
      ((origin.x + 1) / 2) * w,
      ((origin.y + 1) / 2) * h,
    );
    shared.uHalftoneCell.value = HALFTONE_CELL * scale;
    // Sparks: about a CSS pixel and a half wide.
    shared.uResolution.value.set(w / 2, h / 2);
    shared.uSparkWidth.value = 0.75 * scale;
    shared.uLightCover.value = look.lightCover;
    shared.uLightGain.value = look.lightGain;
    shared.uGlyphLevel.value = look.glyphLevel;
    shared.uHalftoneCover.value = look.halftoneCover;

    prof?.mark("cpu");
    // Shadows first, from every light that is on. The view never turns and
    // the buildings stay put, so most are drawn once, without the items;
    // those items pass through follow them every other frame. Clear to the
    // far end of each light's reach.
    shadowFrame.current += 1;
    const due = shadows.filter(
      (shadow) =>
        shared.uLightC.value[shadow.light].z > 0 &&
        (!shadow.drawn || (shadow.moving && shadowFrame.current % 2 === 0)),
    );
    if (due.length > 0) {
      const autoClear = renderer.autoClear;
      renderer.autoClear = true;
      renderer.setClearColor(0xffffff, 1);
      shared.uShadowPass.value = 1;
      // A cube can't be read while it is drawn into: unbind them all.
      const cubes = shared.uShadows.value;
      shared.uShadows.value = NO_SHADOWS;
      for (const shadow of due) {
        for (const mesh of scene.items.values()) mesh.visible = shadow.moving;
        const { x, y, z } = shadow.camera.position;
        shared.uShadowFrom.value.set(x, y, z, shadow.reach);
        shadow.camera.update(renderer, scene.root);
        shadow.drawn = true;
      }
      for (const mesh of scene.items.values()) mesh.visible = true;
      shared.uShadows.value = cubes;
      shared.uShadowPass.value = 0;
      renderer.autoClear = autoClear;
    }

    prof?.mark("shadows");
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);
    // Depth first, cheaply, so the shaded pass shades each pixel once
    // instead of every surface drawn over another.
    const { color, depth } = renderer.state.buffers;
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    shared.uDepthPass.value = 1;
    scene.sparks.visible = false;
    color.setMask(false);
    color.setLocked(true);
    renderer.render(scene.root, state.camera);
    color.setLocked(false);
    color.setMask(true);
    prof?.mark("prepass");
    scene.sparks.visible = true;
    shared.uDepthPass.value = 0;
    depth.setMask(false);
    depth.setLocked(true);
    renderer.render(scene.root, state.camera);
    depth.setLocked(false);
    depth.setMask(true);
    renderer.autoClear = autoClear;
    if (prof && (prof.profile as { perMesh?: boolean }).perMesh) {
      timeMeshes(
        renderer.getContext() as WebGL2RenderingContext,
        prof.profile,
        (object) => renderer.render(object, state.camera),
        scene.root,
      );
    }
    if (prof) {
      const { calls, triangles } = renderer.info.render;
      prof.profile.info = {
        calls,
        triangles,
        programs: renderer.info.programs?.length ?? 0,
        lights: shared.uLightCount.value,
        views: shared.uViewCount.value,
        units: renderer.capabilities.maxTextures,
      };
    }
    prof?.mark("scene");

    // Smoke's density, thinning where it meets the scene, at the canvas's
    // size: it prints as dots several pixels apart, so finer is wasted, and
    // a full-size target cleared every frame costs a tile GPU dearly.
    const smoking = scene.puffs.count > 0;
    if (smoking) {
      const puffMaterial = scene.puffs.material as THREE.ShaderMaterial;
      puffMaterial.uniforms.tDepth.value = target.depthTexture;
      puffMaterial.uniforms.uDepthRange.value = camera.far - camera.near;
      puffMaterial.uniforms.uFactor.value = factor;
      renderer.setRenderTarget(smokeTarget);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, false, false);
      renderer.render(scene.smoke, state.camera);
    }
    prof?.mark("smoke");
    compositeUniforms.tSmoke.value = smokeTarget.texture;
    compositeUniforms.uSmokeOn.value = smoking ? 1 : 0;
    compositeUniforms.uFactor.value = factor;
    compositeUniforms.uHalftoneOrigin.value.copy(shared.uHalftoneOrigin.value);
    compositeUniforms.uHalftoneCell.value = shared.uHalftoneCell.value;
    compositeUniforms.uSmokeCover.value = look.smokeCover;

    // Ink at the supersampled size, then average down onto the canvas.
    const strengths = lookStrengths(look, camera.zoom);
    compositeUniforms.tColor.value = target.textures[0];
    compositeUniforms.tData.value = target.textures[1];
    compositeUniforms.tDepth.value = target.depthTexture;
    // Ink width is in supersampled pixels: drawn lighter, it narrows with the
    // supersampling so lines keep their weight on screen.
    compositeUniforms.uRadius.value =
      (look.lineWidth * factor) / look.supersample;
    shared.uPortDark.value = look.portDark;
    shared.uPortEdge.value = look.portEdge;
    shared.uPortSoft.value = look.portSoft;
    shared.uPortRadius.value = look.portRadius;
    shared.uPortTone.value = look.portTone;
    compositeUniforms.uCrease.value = strengths.crease;
    compositeUniforms.uDetail.value = strengths.detail;
    renderer.setRenderTarget(ink);
    renderer.clear(true, true, true);
    renderer.render(composite.scene, composite.camera);
    prof?.mark("ink");

    composite.downsample.uniforms.tInk.value = ink.texture;
    composite.downsample.uniforms.uFactor.value = factor;
    renderer.setRenderTarget(null);
    renderer.clear(true, true, true);
    renderer.render(composite.downScene, composite.camera);
    if (prof) {
      prof.mark("down", true);
      prof.profile.frames = (prof.profile.frames ?? 0) + 1;
      prof.profile.drawnFactor = factor;
      prof.profile.size = [w, h];
    }
    drawnRef.current?.({
      canvas: renderer.domElement,
      width: buffer.x,
      height: buffer.y,
      factor,
      deck: phase.current,
    });
  }, 1);

  return null;
}

/** Loads the packed models, then draws; nothing shows until they are in. */
function Loaded(props: FactorySceneProps) {
  const [models, setModels] = useState<Map<ModelName, Model> | null>(null);
  const { onError } = props;
  useEffect(() => {
    const controller = new AbortController();
    loadModels(controller.signal)
      .then(setModels)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        onError?.(error instanceof Error ? error.message : "models");
      });
    return () => controller.abort();
  }, [onError]);
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
      onCreated={({ gl }) => {
        const canvas = gl.domElement;
        canvas.addEventListener("webglcontextlost", (event) => {
          // Let the browser restore the context instead of giving up on it.
          event.preventDefault();
          props.onContext?.("lost");
        });
        canvas.addEventListener("webglcontextrestored", () =>
          props.onContext?.("restored"),
        );
      }}
    >
      <Loaded {...props} />
    </Canvas>
  );
}
