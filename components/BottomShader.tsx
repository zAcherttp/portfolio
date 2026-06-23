"use client";

import dynamic from "next/dynamic";

const Dither = dynamic(() => import("./ui/shaders/dither"), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-transparent" />,
});

export default function BottomShader() {
  return (
    <div className="absolute left-0 right-0 bottom-0 h-[120px] overflow-hidden pointer-events-none z-0 opacity-60">
      <Dither
        waveSpeed={0.15}
        waveFrequency={2.5}
        waveAmplitude={0.25}
        waveColor={[0.92, 0.88, 0.98]} // Soft pastel lavender
        colorNum={4}
        pixelSize={3}
      />
    </div>
  );
}
