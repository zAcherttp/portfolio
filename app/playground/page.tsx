"use client";

import dynamic from "next/dynamic";

const PlaygroundClient = dynamic(() => import("./PlaygroundClient"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-400 font-mono text-sm">
      Loading Playground...
    </div>
  ),
});

export default function PlaygroundPage() {
  return <PlaygroundClient />;
}
