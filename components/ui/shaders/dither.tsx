"use client";

/* eslint-disable react/no-unknown-property */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, wrapEffect } from "@react-three/postprocessing";
import { Effect } from "postprocessing";
import { forwardRef, useEffect, useRef } from "react";
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
uniform vec2 mouseNDC;
uniform vec2 mouseVelocity;
uniform float windStrength;
uniform vec2 blowNDC;
uniform float blowProgress;
uniform float blowRadius;
uniform float blowForce;

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
  
  // Cursor wind gust calculation
  float mouseDist = length(screenUv - mouseNDC);
  float mouseInfluence = smoothstep(0.4, 0.0, mouseDist);
  vec2 windPush = mouseVelocity * mouseInfluence * windStrength;
  
  // Click blow splat calculation
  float blowDist = length(screenUv - blowNDC);
  float waveFront = blowProgress * blowRadius;
  float waveInfluence = smoothstep(0.12, 0.0, abs(blowDist - waveFront)) * (1.0 - blowProgress);
  vec2 blowPush = vec2(0.0);
  if (blowDist > 0.001) {
    blowPush = normalize(screenUv - blowNDC) * waveInfluence * blowForce;
  }
  
  // Apply physics coordinate displacements to noise
  noiseUv.x -= windPush.x + blowPush.x;
  noiseUv.y -= windPush.y + blowPush.y;
  
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
  
  // Epicenter click-blow suppression
  float centerSuppression = (1.0 - smoothstep(0.0, waveFront, blowDist)) * (1.0 - blowProgress) * 0.9;
  fire = clamp(fire - centerSuppression, 0.0, 1.0);
  
  gl_FragColor = vec4(1.0, 1.0, 1.0, fire);
}
`;

const ditherFragmentShader = `
precision highp float;
uniform float colorNum;
uniform float pixelSize;
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

vec3 dither(vec2 uv, vec3 color) {
  vec2 scaledCoord = floor(uv * resolution / pixelSize);
  int x = int(mod(scaledCoord.x, 8.0));
  int y = int(mod(scaledCoord.y, 8.0));
  float threshold = bayerMatrix8x8[y * 8 + x] - 0.25;
  float step = 1.0 / (colorNum - 1.0);
  color += threshold * step;
  float bias = 0.2;
  color = clamp(color - bias, 0.0, 1.0);
  return floor(color * (colorNum - 1.0) + 0.5) / (colorNum - 1.0);
}

void mainImage(in vec4 inputColor, in vec2 uv, out vec4 outputColor) {
  vec2 normalizedPixelSize = pixelSize / resolution;
  vec2 uvPixel = normalizedPixelSize * floor(uv / normalizedPixelSize);
  vec4 color = texture2D(inputBuffer, uvPixel);
  
  // Dither the alpha channel (fire intensity)
  float ditheredA = dither(uv, vec3(color.a)).r;
  
  if (ditheredA > 0.15) {
    outputColor = vec4(waveColor, 1.0);
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

  set waveColor(value: THREE.Color | [number, number, number]) {
    const u = this.getUniform("waveColor");
    if (Array.isArray(value)) {
      u.value.setRGB(value[0], value[1], value[2]);
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
  { colorNum: number; pixelSize: number; waveColor: [number, number, number] }
>((props, ref) => {
  const { colorNum, pixelSize, waveColor } = props;
  const WrappedRetroEffect = wrapEffect(RetroEffectImpl);
  return (
    <WrappedRetroEffect
      ref={ref}
      colorNum={colorNum}
      pixelSize={pixelSize}
      waveColor={waveColor}
    />
  );
});

RetroEffect.displayName = "RetroEffect";

import { useMemo } from "react";

interface DitheredWavesProps {
  fireSpeed: number;
  noiseScale: [number, number];
  flameHeight: number;
  noiseStrength: number;
  burnProgress: number;
  windStrength: number;
  blowRadius: number;
  blowForce: number;
  colorNum: number;
  pixelSize: number;
  waveColor: [number, number, number];
  disableAnimation: boolean;
}

function DitheredWaves({
  fireSpeed,
  noiseScale,
  flameHeight,
  noiseStrength,
  burnProgress,
  windStrength,
  blowRadius,
  blowForce,
  colorNum,
  pixelSize,
  waveColor,
  disableAnimation,
}: DitheredWavesProps) {
  const mesh = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { viewport, size, gl } = useThree();

  const mouseNDCRef = useRef(new THREE.Vector2(0.5, -1.0)); // Default below viewport
  const lastMouseRef = useRef(new THREE.Vector2(0.5, -1.0));
  const velocityRef = useRef(new THREE.Vector2(0, 0));
  const lastTimeRef = useRef(performance.now());

  const blowNDCRef = useRef(new THREE.Vector2(0.5, -1.0));
  const blowProgressRef = useRef(1.0); // 1.0 means inactive

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
      mouseNDC: { value: new THREE.Vector2(0.5, -1.0) },
      mouseVelocity: { value: new THREE.Vector2(0, 0) },
      windStrength: { value: windStrength },
      blowNDC: { value: new THREE.Vector2(0.5, -1.0) },
      blowProgress: { value: 1.0 },
      blowRadius: { value: blowRadius },
      blowForce: { value: blowForce },
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

  // Window-level cursor tracking to bypass pointer-events restrictions
  useEffect(() => {
    const canvas = gl.domElement;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1.0 - (e.clientY - rect.top) / rect.height;

      mouseNDCRef.current.set(x, y);

      const now = performance.now();
      const dt = Math.max(1, now - lastTimeRef.current);
      lastTimeRef.current = now;

      const dx = x - lastMouseRef.current.x;
      const dy = y - lastMouseRef.current.y;
      lastMouseRef.current.set(x, y);

      // Track velocity and scale for responsiveness
      velocityRef.current.x += (dx / dt) * 12.0;
      velocityRef.current.y += (dy / dt) * 12.0;
      velocityRef.current.clampLength(0.0, 1.2);
    };

    const handlePointerDown = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        const x = (e.clientX - rect.left) / rect.width;
        const y = 1.0 - (e.clientY - rect.top) / rect.height;

        blowNDCRef.current.set(x, y);
        blowProgressRef.current = 0.0; // Start click blow animation
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [gl]);

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
    if (mat.uniforms.windStrength.value !== windStrength) {
      mat.uniforms.windStrength.value = windStrength;
    }
    if (mat.uniforms.blowRadius.value !== blowRadius) {
      mat.uniforms.blowRadius.value = blowRadius;
    }
    if (mat.uniforms.blowForce.value !== blowForce) {
      mat.uniforms.blowForce.value = blowForce;
    }

    // Decay pointer velocity exponentially
    velocityRef.current.multiplyScalar(0.93);
    mat.uniforms.mouseVelocity.value.copy(velocityRef.current);
    mat.uniforms.mouseNDC.value.copy(mouseNDCRef.current);

    // Animate click blow
    if (blowProgressRef.current < 1.0) {
      blowProgressRef.current += 0.045; // complete in ~22 frames
      if (blowProgressRef.current > 1.0) {
        blowProgressRef.current = 1.0;
      }
    }
    mat.uniforms.blowProgress.value = blowProgressRef.current;
    mat.uniforms.blowNDC.value.copy(blowNDCRef.current);
  });

  return (
    <>
      <mesh ref={mesh} scale={[viewport.width, viewport.height, 1]}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={waveVertexShader}
          fragmentShader={waveFragmentShader}
          uniforms={initialUniforms}
          transparent={true}
        />
      </mesh>

      <EffectComposer>
        <RetroEffect
          colorNum={colorNum}
          pixelSize={pixelSize}
          waveColor={waveColor}
        />
      </EffectComposer>
    </>
  );
}

interface DitherProps {
  fireSpeed?: number;
  noiseScale?: [number, number];
  flameHeight?: number;
  noiseStrength?: number;
  burnProgress?: number;
  windStrength?: number;
  blowRadius?: number;
  blowForce?: number;
  colorNum?: number;
  pixelSize?: number;
  waveColor?: [number, number, number];
  disableAnimation?: boolean;
}

export default function Dither({
  fireSpeed = 0.55,
  noiseScale = [3.5, 2.8],
  flameHeight = 0.85,
  noiseStrength = 0.42,
  burnProgress = 0.0,
  windStrength = 0.55,
  blowRadius = 0.5,
  blowForce = 0.65,
  colorNum = 4,
  pixelSize = 3,
  waveColor = [0.0, 0.0, 0.0],
  disableAnimation = false,
}: DitherProps) {
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
        windStrength={windStrength}
        blowRadius={blowRadius}
        blowForce={blowForce}
        colorNum={colorNum}
        pixelSize={pixelSize}
        waveColor={waveColor}
        disableAnimation={disableAnimation}
      />
    </Canvas>
  );
}
