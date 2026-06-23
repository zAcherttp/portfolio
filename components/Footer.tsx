"use client";

export default function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="relative pt-12 pb-20 border-t border-zinc-100 mt-12 z-10">
      <div className="flex flex-col items-center gap-3.5 text-center text-xs text-zinc-500 py-2">
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <span>Crafted by</span>
          <button
            type="button"
            onClick={scrollToTop}
            className="underline decoration-zinc-300 hover:decoration-zinc-800 font-medium text-zinc-900 cursor-pointer"
          >
            Tuấn Phát
          </button>
          <span className="text-zinc-300 select-none">•</span>
          <span>Inspired by</span>
          <a
            href="https://chanhdai.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline text-zinc-900 font-medium"
          >
            Chánh Đại
          </a>
          <span>&</span>
          <a
            href="https://ruru.build/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline text-zinc-900 font-medium"
          >
            ruru.build
          </a>
          <span className="text-zinc-300 select-none">•</span>
          <span>Deployed on</span>
          <a
            href="https://vercel.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline text-zinc-900 font-medium"
          >
            Vercel
          </a>
        </div>
        <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-400 font-mono">
          <a
            href="https://github.com/zAcherttp/portfolio"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-800 transition-colors"
          >
            GitHub Source
          </a>
          <span className="text-zinc-200 select-none">|</span>
          <a
            href="https://github.com/zAcherttp/portfolio/blob/master/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-800 transition-colors"
          >
            MIT License
          </a>
        </div>
      </div>
    </footer>
  );
}
