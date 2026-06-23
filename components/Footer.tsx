"use client";

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
          <a
            href="https://chanhdai.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline text-foreground font-medium"
          >
            Chánh Đại
          </a>
          <span>&</span>
          <a
            href="https://ruru.build/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline text-foreground font-medium"
          >
            ruru.build
          </a>
          <span className="text-subtle-2 select-none">•</span>
          <span>Deployed on</span>
          <a
            href="https://vercel.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline text-foreground font-medium"
          >
            Vercel
          </a>
        </div>
        <div className="flex items-center justify-center gap-2 text-[10px] text-subtle font-mono">
          <a
            href="https://github.com/zAcherttp/portfolio"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            GitHub Source
          </a>
          <span className="text-subtle-2 select-none">|</span>
          <a
            href="https://github.com/zAcherttp/portfolio/blob/master/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            MIT License
          </a>
        </div>
      </div>
    </footer>
  );
}
