"use client";

import { ExternalLink } from "./ExternalLink";

export default function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="relative pt-12 border-t border-border mt-12 z-10">
      <div className="flex flex-col items-center gap-3.5 text-center text-xs text-muted-foreground py-2">
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <span>Crafted by</span>
          <button
            type="button"
            onClick={scrollToTop}
            className="underline decoration-subtle-2 hover:decoration-foreground font-medium text-foreground cursor-pointer"
          >
            Tuấn Phát
          </button>
          <span className="text-subtle-2 select-none">•</span>
          <span>Inspired by</span>
          <ExternalLink
            attributionContext="footer-credit"
            href="https://chanhdai.com/"
            target="_blank"
            className="hover:underline text-foreground font-medium"
          >
            Chánh Đại
          </ExternalLink>
          <span>&</span>
          <ExternalLink
            attributionContext="footer-credit"
            href="https://ruru.build/"
            target="_blank"
            className="hover:underline text-foreground font-medium"
          >
            ruru.build
          </ExternalLink>
          <span className="text-subtle-2 select-none">•</span>
          <span>Deployed on</span>
          <ExternalLink
            attributionContext="footer-credit"
            href="https://vercel.com"
            target="_blank"
            className="hover:underline text-foreground font-medium"
          >
            Vercel
          </ExternalLink>
        </div>
        <div className="flex items-center justify-center gap-2 text-[10px] text-subtle font-mono">
          <ExternalLink
            attributionContext="footer-resource"
            href="https://github.com/zAcherttp/portfolio"
            target="_blank"
            className="hover:text-foreground transition-colors"
          >
            GitHub Source
          </ExternalLink>
          <span className="text-subtle-2 select-none">|</span>
          <ExternalLink
            attributionContext="footer-resource"
            href="https://github.com/zAcherttp/portfolio/blob/master/LICENSE"
            target="_blank"
            className="hover:text-foreground transition-colors"
          >
            MIT License
          </ExternalLink>
        </div>
      </div>
    </footer>
  );
}
