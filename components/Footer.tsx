"use client";

import { useEffect, useState } from "react";

export default function Footer() {
  const [year, setYear] = useState(2026);

  useEffect(() => {
    setYear(new Date().getFullYear());
  }, []);

  return (
    <footer className="pt-6 text-xs text-zinc-400">
      <p>© {year} — Built with Next.js and Tailwind CSS</p>
    </footer>
  );
}
