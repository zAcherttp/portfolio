"use client";

import dynamic from "next/dynamic";

const Dither = dynamic(() => import("@/components/ui/shaders/dither"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-muted/20" />,
});

const flameColors: [
  [number, number, number],
  [number, number, number],
  [number, number, number],
] = [
  [0.2, 0.2, 0.2],
  [0.55, 0.55, 0.55],
  [0.95, 0.95, 0.95],
];

function ShaderStage({
  disableAnimation = false,
}: {
  disableAnimation?: boolean;
}) {
  return (
    <div className="h-80 w-full overflow-hidden bg-background">
      <Dither
        burnProgress={0.72}
        colorNum={3}
        disableAnimation={disableAnimation}
        fireRange={[0.2, 1]}
        fireSpeed={0.05}
        flameColors={flameColors}
        flameHeight={0.12}
        mode="combined"
        noiseScale={[4, 2]}
        noiseStrength={0.4}
        pixelSize={3}
        waveColor={[0.5, 0.5, 0.5]}
      />
    </div>
  );
}

export function DitherAnimatedFixture() {
  return <ShaderStage />;
}

export function DitherStaticFixture() {
  return <ShaderStage disableAnimation />;
}
