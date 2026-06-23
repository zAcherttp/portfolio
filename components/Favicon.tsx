import { Globe } from "lucide-react";

interface FaviconProps {
  src: string | null | undefined;
  title: string;
}

// Pure component — receives a pre-fetched data URL from the server.
// Falls back to a Globe icon if the server couldn't fetch the favicon.
export default function Favicon({ src, title }: FaviconProps) {
  if (!src) {
    return <Globe className="w-4 h-4 text-zinc-400" />;
  }

  return (
    // biome-ignore lint/performance/noImgElement: renders pre-fetched data URLs, no network request made
    <img
      src={src}
      alt={`${title} favicon`}
      className="w-4 h-4 rounded-xs object-contain"
    />
  );
}
