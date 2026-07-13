"use client";

/* eslint-disable react/no-unknown-property */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, wrapEffect } from "@react-three/postprocessing";
import { Effect } from "postprocessing";
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const waveVertexShader = `
precision highp float;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 modelPosition = modelMatrix * vec4(position, 1.0);
  vec4 viewPosition = viewMatrix * modelPosition;
  gl_Position = projectionMatrix * viewPosition;
}
`;

const waveFragmentShader = `
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform float fireSpeed;
uniform vec2 noiseScale;
uniform float flameHeight;
uniform float noiseStrength;
uniform float burnProgress;
uniform vec2 fireRange;
// Flat color used when flameMode == 0 (dark mode monochrome)
uniform vec3 waveColor;
// Flame gradient stops (flameMode == 1)
uniform int flameMode;    // 0 = flat waveColor, 1 = gradient
uniform vec3 flameColorA; // cool outer edge  (#00a4db)
uniform vec3 flameColorB; // mid heat         (#d6fdff)
uniform vec3 flameBgColor; // background / fade-out color (#fefefe)
uniform float flameBodyHeat;
uniform float flameHeatPower;
uniform float flamePositionBias;

vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec2 fade(vec2 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

float cnoise(vec2 P) {
  vec4 Pi = floor(P.xyxy) + vec4(0.0,0.0,1.0,1.0);
  vec4 Pf = fract(P.xyxy) - vec4(0.0,0.0,1.0,1.0);
  Pi = mod289(Pi);
  vec4 ix = Pi.xzxz;
  vec4 iy = Pi.yyww;
  vec4 fx = Pf.xzxz;
  vec4 fy = Pf.yyww;
  vec4 i = permute(permute(ix) + iy);
  vec4 gx = fract(i * (1.0/41.0)) * 2.0 - 1.0;
  vec4 gy = abs(gx) - 0.5;
  vec4 tx = floor(gx + 0.5);
  gx = gx - tx;
  vec2 g00 = vec2(gx.x, gy.x);
  vec2 g10 = vec2(gx.y, gy.y);
  vec2 g01 = vec2(gx.z, gy.z);
  vec2 g11 = vec2(gx.w, gy.w);
  vec4 norm = taylorInvSqrt(vec4(dot(g00,g00), dot(g01,g01), dot(g10,g10), dot(g11,g11)));
  g00 *= norm.x; g01 *= norm.y; g10 *= norm.z; g11 *= norm.w;
  float n00 = dot(g00, vec2(fx.x, fy.x));
  float n10 = dot(g10, vec2(fx.y, fy.y));
  float n01 = dot(g01, vec2(fx.z, fy.z));
  float n11 = dot(g11, vec2(fx.w, fy.w));
  vec2 fade_xy = fade(Pf.xy);
  vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
  return 2.3 * mix(n_x.x, n_x.y, fade_xy.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amp = 0.5;
  vec2 shift = vec2(100.0);
  for (int i = 0; i < 4; i++) {
    value += amp * abs(cnoise(p));
    p = p * 2.0 + shift;
    amp *= 0.5;
  }
  return value;
}

void main() {
  vec2 screenUv = gl_FragCoord.xy / resolution.xy;
  
  // Aspect-ratio-independent noise coordinate mapping
  vec2 noiseUv = screenUv;
  noiseUv.x *= resolution.x / resolution.y;
  
  vec2 p = noiseUv * noiseScale;
  p.y -= time * fireSpeed;
  
  float n = fbm(p);
  
  // Base fireplace shape bounds (fade out on left/right/top edges)
  float horizontalFade = smoothstep(0.0, 0.15, screenUv.x) * smoothstep(1.0, 0.85, screenUv.x);
  float verticalFade = smoothstep(flameHeight, 0.0, screenUv.y);
  
  float fire = (verticalFade * 0.7 + n * noiseStrength) * horizontalFade;
  
  // Apply burnProgress height limit
  float currentHeightLimit = burnProgress;
  float heightMask = smoothstep(currentHeightLimit, currentHeightLimit - 0.25, screenUv.y);
  fire *= heightMask;
  
  if (fire < fireRange.x || fire > fireRange.y) {
    fire = 0.0;
  }

  // --- Color output ---
  vec3 outColor;
  if (flameMode == 1) {
    // Physics-based flame gradient:
    //   heat 0.0 -> flameColorA  sparse outer strands
    //   heat flameBodyHeat -> flameColorB  saturated flame body
    //   heat 1.0 -> flameBgColor hot inner core
    //
    // Position bias: canvas bottom (y=0) is hotter → pushes toward core color.
    // Canvas top (y=1) has no bias → stays in deep-blue strand territory.
    float positionBias = 1.0 - screenUv.y; // 1 at bottom (hot), 0 at top (cool)
    float heat = clamp(fire * (1.0 - flamePositionBias) + positionBias * flamePositionBias, 0.0, 1.0);
    heat = pow(heat, flameHeatPower);

    if (heat < flameBodyHeat) {
      outColor = mix(flameColorA, flameColorB, heat / flameBodyHeat);
    } else {
      outColor = mix(flameColorB, flameBgColor, (heat - flameBodyHeat) / (1.0 - flameBodyHeat));
    }
  } else {
    // Flat monochrome mode (dark mode)
    outColor = waveColor;
  }
  
  gl_FragColor = vec4(outColor, fire);
}
`;

const gradientFragmentShader = `
precision highp float;
uniform vec2 resolution;
uniform vec3 waveColor;

void main() {
  vec2 screenUv = gl_FragCoord.xy / resolution.xy;
  float grad = 1.0 - screenUv.y;
  gl_FragColor = vec4(waveColor, grad);
}
`;

const ditherFragmentShader = `
precision highp float;
uniform float colorNum;
uniform float pixelSize;
uniform float ditherAlphaMin;
uniform float ditherAlphaMax;
// waveColor retained for uniform binding compatibility but not used for color output
uniform vec3 waveColor;

const float bayerMatrix8x8[64] = float[64](
  0.0/64.0, 48.0/64.0, 12.0/64.0, 60.0/64.0,  3.0/64.0, 51.0/64.0, 15.0/64.0, 63.0/64.0,
  32.0/64.0,16.0/64.0, 44.0/64.0, 28.0/64.0, 35.0/64.0,19.0/64.0, 47.0/64.0, 31.0/64.0,
  8.0/64.0, 56.0/64.0,  4.0/64.0, 52.0/64.0, 11.0/64.0,59.0/64.0,  7.0/64.0, 55.0/64.0,
  40.0/64.0,24.0/64.0, 36.0/64.0, 20.0/64.0, 43.0/64.0,27.0/64.0, 39.0/64.0, 23.0/64.0,
  2.0/64.0, 50.0/64.0, 14.0/64.0, 62.0/64.0,  1.0/64.0,49.0/64.0, 13.0/64.0, 61.0/64.0,
  34.0/64.0,18.0/64.0, 46.0/64.0, 30.0/64.0, 33.0/64.0,17.0/64.0, 45.0/64.0, 29.0/64.0,
  10.0/64.0,58.0/64.0,  6.0/64.0, 54.0/64.0,  9.0/64.0,57.0/64.0,  5.0/64.0, 53.0/64.0,
  42.0/64.0,26.0/64.0, 38.0/64.0, 22.0/64.0, 41.0/64.0,25.0/64.0, 37.0/64.0, 21.0/64.0
);

// Bayer-dither a scalar value [0,1]
float ditherAlpha(vec2 uv, float value) {
  vec2 scaledCoord = floor(uv * resolution / pixelSize);
  int x = int(mod(scaledCoord.x, 8.0));
  int y = int(mod(scaledCoord.y, 8.0));
  float threshold = bayerMatrix8x8[y * 8 + x];
  return step(threshold, value);
}

void mainImage(in vec4 inputColor, in vec2 uv, out vec4 outputColor) {
  vec2 normalizedPixelSize = pixelSize / resolution;
  vec2 uvPixel = normalizedPixelSize * floor(uv / normalizedPixelSize);
  vec4 color = texture2D(inputBuffer, uvPixel);

  // Early exit: no fire at all — discard to avoid Bayer (0,0) dot-grid artifact
  if (color.a < 0.01) {
    outputColor = vec4(0.0, 0.0, 0.0, 0.0);
    return;
  }
  
  // Use the alpha channel as fire intensity for the dither mask.
  // The rgb carries the gradient color computed in the wave shader.
  float mask = ditherAlpha(uv, color.a);
  
  if (mask > 0.5) {
    float dotAlpha = mix(ditherAlphaMin, ditherAlphaMax, smoothstep(0.2, 0.95, color.a));
    outputColor = vec4(color.rgb, dotAlpha);
  } else {
    outputColor = vec4(0.0, 0.0, 0.0, 0.0);
  }
}
`;

class RetroEffectImpl extends Effect {
  // biome-ignore lint/suspicious/noExplicitAny: base class Effect requires Map<string, Uniform<any>>
  public uniforms: Map<string, THREE.Uniform<any>>;

  constructor() {
    // biome-ignore lint/suspicious/noExplicitAny: base class Effect requires Map<string, Uniform<any>>
    const uniforms = new Map<string, THREE.Uniform<any>>([
      ["colorNum", new THREE.Uniform(4.0)],
      ["pixelSize", new THREE.Uniform(2.0)],
      ["ditherAlphaMin", new THREE.Uniform(1.0)],
      ["ditherAlphaMax", new THREE.Uniform(1.0)],
      ["waveColor", new THREE.Uniform(new THREE.Color(0, 0, 0))],
    ]);
    super("RetroEffect", ditherFragmentShader, { uniforms });
    this.uniforms = uniforms;
  }

  private getUniform(name: string) {
    const uniform = this.uniforms.get(name);
    if (!uniform) {
      throw new Error(`Missing RetroEffect uniform: ${name}`);
    }
    return uniform;
  }

  set colorNum(value: number) {
    this.getUniform("colorNum").value = value;
  }

  get colorNum(): number {
    return this.getUniform("colorNum").value;
  }

  set pixelSize(value: number) {
    this.getUniform("pixelSize").value = value;
  }

  get pixelSize(): number {
    return this.getUniform("pixelSize").value;
  }

  set ditherAlphaMin(value: number) {
    this.getUniform("ditherAlphaMin").value = value;
  }

  get ditherAlphaMin(): number {
    return this.getUniform("ditherAlphaMin").value;
  }

  set ditherAlphaMax(value: number) {
    this.getUniform("ditherAlphaMax").value = value;
  }

  get ditherAlphaMax(): number {
    return this.getUniform("ditherAlphaMax").value;
  }

  set waveColor(value: THREE.Color | [number, number, number]) {
    const u = this.getUniform("waveColor");
    if (Array.isArray(value)) {
      u.value.setRGB(value[0], value[1], value[2], THREE.SRGBColorSpace);
    } else {
      u.value.copy(value);
    }
  }

  get waveColor(): THREE.Color {
    return this.getUniform("waveColor").value;
  }
}

const RetroEffect = forwardRef<
  RetroEffectImpl,
  {
    colorNum: number;
    pixelSize: number;
    ditherOpacity: [number, number];
    waveColor: [number, number, number];
  }
>((props, ref) => {
  const { colorNum, pixelSize, ditherOpacity, waveColor } = props;
  const WrappedRetroEffect = wrapEffect(RetroEffectImpl);
  return (
    <WrappedRetroEffect
      ref={ref}
      colorNum={colorNum}
      pixelSize={pixelSize}
      ditherAlphaMin={ditherOpacity[0]}
      ditherAlphaMax={ditherOpacity[1]}
      waveColor={waveColor}
    />
  );
});

RetroEffect.displayName = "RetroEffect";

function isRendererContextReady(gl: THREE.WebGLRenderer) {
  const context = gl.getContext();
  const attributes = gl.getContextAttributes() as
    | WebGLContextAttributes
    | null
    | undefined;

  return Boolean(
    gl.domElement?.isConnected && attributes && !context.isContextLost(),
  );
}

function GuardedEffectComposer({
  colorNum,
  pixelSize,
  ditherOpacity,
  waveColor,
}: {
  colorNum: number;
  pixelSize: number;
  ditherOpacity: [number, number];
  waveColor: [number, number, number];
}) {
  const { gl } = useThree();
  const [canCompose, setCanCompose] = useState(false);

  useEffect(() => {
    const canvas = gl.domElement;
    let frameId = 0;

    const updateComposerState = () => {
      setCanCompose(isRendererContextReady(gl));
    };
    const handleContextLost = () => {
      setCanCompose(false);
    };

    updateComposerState();
    frameId = window.requestAnimationFrame(updateComposerState);
    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", updateComposerState);

    return () => {
      window.cancelAnimationFrame(frameId);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", updateComposerState);
    };
  }, [gl]);

  if (!canCompose) {
    return null;
  }

  return (
    <EffectComposer>
      <RetroEffect
        colorNum={colorNum}
        pixelSize={pixelSize}
        ditherOpacity={ditherOpacity}
        waveColor={waveColor}
      />
    </EffectComposer>
  );
}

interface DitheredWavesProps {
  fireSpeed: number;
  noiseScale: [number, number];
  flameHeight: number;
  noiseStrength: number;
  burnProgress: number;
  fireRange: [number, number];
  colorNum: number;
  pixelSize: number;
  ditherOpacity: [number, number];
  waveColor: [number, number, number];
  disableAnimation: boolean;
  mode: "dither" | "fire" | "combined";
  /** When set, enables gradient flame mode with the given [colorA, colorB, bgColor] stops */
  flameColors?: [
    [number, number, number], // colorA - outer strands
    [number, number, number], // colorB - saturated body
    [number, number, number], // bgColor - hot core
  ];
  flameBodyHeat: number;
  flameHeatPower: number;
  flamePositionBias: number;
}

function DitheredWaves({
  fireSpeed,
  noiseScale,
  flameHeight,
  noiseStrength,
  burnProgress,
  fireRange,
  colorNum,
  pixelSize,
  ditherOpacity,
  waveColor,
  disableAnimation,
  mode,
  flameColors,
  flameBodyHeat,
  flameHeatPower,
  flamePositionBias,
}: DitheredWavesProps) {
  const flameMode = flameColors ? 1 : 0;
  const mesh = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { viewport, size, gl } = useThree();

  // Stable initial uniforms object for three.js material compilation
  // biome-ignore lint/correctness/useExhaustiveDependencies: uniforms must be initialized only once to prevent shader recompilation
  const initialUniforms = useMemo(
    () => ({
      time: { value: 0 },
      resolution: { value: new THREE.Vector2(0, 0) },
      fireSpeed: { value: fireSpeed },
      noiseScale: { value: new THREE.Vector2(...noiseScale) },
      flameHeight: { value: flameHeight },
      noiseStrength: { value: noiseStrength },
      burnProgress: { value: burnProgress },
      fireRange: { value: new THREE.Vector2(...fireRange) },
      waveColor: {
        value: new THREE.Color().setRGB(
          waveColor[0],
          waveColor[1],
          waveColor[2],
          THREE.SRGBColorSpace,
        ),
      },
      flameMode: { value: flameMode },
      // Use THREE.Vector3 (not THREE.Color) to pass raw sRGB [0-1] values
      // without color-space linearisation — preserves full vibrancy after
      // the composer's sRGB gamma-encode output step.
      flameColorA: {
        value: new THREE.Vector3(
          flameColors?.[0][0] ?? 0,
          flameColors?.[0][1] ?? 0,
          flameColors?.[0][2] ?? 0,
        ),
      },
      flameColorB: {
        value: new THREE.Vector3(
          flameColors?.[1][0] ?? 0,
          flameColors?.[1][1] ?? 0,
          flameColors?.[1][2] ?? 0,
        ),
      },
      flameBgColor: {
        value: new THREE.Vector3(
          flameColors?.[2][0] ?? 1,
          flameColors?.[2][1] ?? 1,
          flameColors?.[2][2] ?? 1,
        ),
      },
      flameBodyHeat: { value: flameBodyHeat },
      flameHeatPower: { value: flameHeatPower },
      flamePositionBias: { value: flamePositionBias },
    }),
    [],
  );

  useEffect(() => {
    const dpr = gl.getPixelRatio();
    const newWidth = Math.floor(size.width * dpr);
    const newHeight = Math.floor(size.height * dpr);
    const mat = materialRef.current;
    if (mat) {
      mat.uniforms.resolution.value.set(newWidth, newHeight);
    }
  }, [size, gl]);

  useFrame(({ clock }) => {
    const mat = materialRef.current;
    if (!mat) return;

    if (!disableAnimation) {
      mat.uniforms.time.value = clock.getElapsedTime();
    }

    // Dynamic props updates
    if (mat.uniforms.fireSpeed.value !== fireSpeed) {
      mat.uniforms.fireSpeed.value = fireSpeed;
    }
    if (
      mat.uniforms.noiseScale.value.x !== noiseScale[0] ||
      mat.uniforms.noiseScale.value.y !== noiseScale[1]
    ) {
      mat.uniforms.noiseScale.value.set(...noiseScale);
    }
    if (mat.uniforms.flameHeight.value !== flameHeight) {
      mat.uniforms.flameHeight.value = flameHeight;
    }
    if (mat.uniforms.noiseStrength.value !== noiseStrength) {
      mat.uniforms.noiseStrength.value = noiseStrength;
    }
    if (mat.uniforms.burnProgress.value !== burnProgress) {
      mat.uniforms.burnProgress.value = burnProgress;
    }
    if (
      mat.uniforms.fireRange.value.x !== fireRange[0] ||
      mat.uniforms.fireRange.value.y !== fireRange[1]
    ) {
      mat.uniforms.fireRange.value.set(...fireRange);
    }
    if (mat.uniforms.waveColor) {
      mat.uniforms.waveColor.value.setRGB(
        waveColor[0],
        waveColor[1],
        waveColor[2],
        THREE.SRGBColorSpace,
      );
    }
    // Gradient flame uniforms — use .set() on Vector3 for direct sRGB passthrough
    if (mat.uniforms.flameMode) {
      mat.uniforms.flameMode.value = flameMode;
    }
    if (flameColors && mat.uniforms.flameColorA) {
      mat.uniforms.flameColorA.value.set(
        flameColors[0][0],
        flameColors[0][1],
        flameColors[0][2],
      );
      mat.uniforms.flameColorB.value.set(
        flameColors[1][0],
        flameColors[1][1],
        flameColors[1][2],
      );
      mat.uniforms.flameBgColor.value.set(
        flameColors[2][0],
        flameColors[2][1],
        flameColors[2][2],
      );
    }
    if (mat.uniforms.flameBodyHeat.value !== flameBodyHeat) {
      mat.uniforms.flameBodyHeat.value = flameBodyHeat;
    }
    if (mat.uniforms.flameHeatPower.value !== flameHeatPower) {
      mat.uniforms.flameHeatPower.value = flameHeatPower;
    }
    if (mat.uniforms.flamePositionBias.value !== flamePositionBias) {
      mat.uniforms.flamePositionBias.value = flamePositionBias;
    }
  });

  const activeFragmentShader = useMemo(() => {
    if (mode === "dither") {
      return gradientFragmentShader;
    }
    return waveFragmentShader;
  }, [mode]);

  return (
    <>
      <mesh ref={mesh} scale={[viewport.width, viewport.height, 1]}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          key={mode}
          ref={materialRef}
          vertexShader={waveVertexShader}
          fragmentShader={activeFragmentShader}
          uniforms={initialUniforms}
          transparent={true}
        />
      </mesh>

      {mode !== "fire" && (
        <GuardedEffectComposer
          colorNum={colorNum}
          pixelSize={pixelSize}
          ditherOpacity={ditherOpacity}
          waveColor={waveColor}
        />
      )}
    </>
  );
}

export interface DitherProps {
  fireSpeed?: number;
  noiseScale?: [number, number];
  flameHeight?: number;
  noiseStrength?: number;
  burnProgress?: number;
  fireRange?: [number, number];
  colorNum?: number;
  pixelSize?: number;
  ditherOpacity?: [number, number];
  waveColor?: [number, number, number];
  disableAnimation?: boolean;
  mode?: "dither" | "fire" | "combined";
  /** Enables physics-based gradient flame. Tuple of [colorA, colorB, bgColor] as linear sRGB [0–1] arrays. */
  flameColors?: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ];
  flameBodyHeat?: number;
  flameHeatPower?: number;
  flamePositionBias?: number;
}

export default function Dither({
  fireSpeed = 0.8,
  noiseScale = [4.0, 2.0],
  flameHeight = 0.85,
  noiseStrength = 0.42,
  burnProgress = 0.0,
  fireRange = [0.0, 1.0],
  colorNum = 3,
  pixelSize = 3,
  ditherOpacity = [1.0, 1.0],
  waveColor = [0.0, 0.0, 0.0],
  disableAnimation = false,
  mode = "combined",
  flameColors,
  flameBodyHeat = 0.5,
  flameHeatPower = 1.0,
  flamePositionBias = 0.15,
}: DitherProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <Canvas
      className="w-full h-full relative"
      camera={{ position: [0, 0, 6] }}
      dpr={1}
      frameloop="always"
      gl={{ antialias: false, preserveDrawingBuffer: true, alpha: true }}
    >
      <DitheredWaves
        fireSpeed={fireSpeed}
        noiseScale={noiseScale}
        flameHeight={flameHeight}
        noiseStrength={noiseStrength}
        burnProgress={burnProgress}
        fireRange={fireRange}
        colorNum={colorNum}
        pixelSize={pixelSize}
        ditherOpacity={ditherOpacity}
        waveColor={waveColor}
        disableAnimation={disableAnimation}
        mode={mode}
        flameColors={flameColors}
        flameBodyHeat={flameBodyHeat}
        flameHeatPower={flameHeatPower}
        flamePositionBias={flamePositionBias}
      />
    </Canvas>
  );
}
