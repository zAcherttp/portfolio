"use client";

import Image from "next/image";
import { useState } from "react";

interface FaviconProps {
  domain: string;
  title: string;
}

export default function Favicon({ domain, title }: FaviconProps) {
  const [error, setError] = useState(false);

  if (error) {
    // Fallback placeholder showing the first letter of the bookmark title
    return (
      <div className="w-4 h-4 rounded-sm bg-zinc-100 border border-zinc-200/50 flex items-center justify-center text-[9px] font-bold text-zinc-400 uppercase select-none">
        {title[0]}
      </div>
    );
  }

  return (
    <Image
      src={`/api/favicon?domain=${domain}`}
      alt={`${title} favicon`}
      width={16}
      height={16}
      unoptimized
      className="w-4 h-4 rounded-xs object-contain"
      onError={() => setError(true)}
    />
  );
}
