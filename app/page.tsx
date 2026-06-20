import BookmarkRow from "../components/BookmarkRow";
import SeeAllButton from "../components/SeeAllButton";
import { bookmarksData } from "../data/bookmarks";

export default function Home() {
  // Show only first 3 bookmarks in the peek window
  const featuredBookmarks = bookmarksData.slice(0, 3);

  return (
    <div className="min-h-screen bg-[#fefefe] text-zinc-900 font-sans antialiased">
      <div className="max-w-3xl mx-auto px-6 py-20 sm:py-32">
        {/* Intro Header */}
        <header className="mb-20">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl mb-4">
            Hello, welcome to my space.
          </h1>
          <p className="text-lg text-zinc-500 max-w-2xl leading-relaxed">
            I am a developer and designer. This is the beginning of my portfolio
            framing. Feel free to explore the layout and customize it to fit
            your work.
          </p>
        </header>

        {/* Bookmarks Peek Widget */}
        <section className="mb-20">
          <div className="flex justify-between items-baseline mb-3.5">
            <h2 className="text-sm font-normal text-zinc-600">Bookmarks</h2>
          </div>

          <div className="flex flex-col -mx-3 border-b border-zinc-100 pb-6">
            {featuredBookmarks.map((bookmark) => (
              <BookmarkRow key={bookmark.id} bookmark={bookmark} />
            ))}

            <SeeAllButton remaining={bookmarksData.slice(3)} />
          </div>
        </section>

        {/* Footer/Framing Placeholder */}
        <footer className="pt-8 text-xs text-zinc-400">
          <p>
            © {new Date().getFullYear()} — Built with Next.js and Tailwind CSS
          </p>
        </footer>
      </div>
    </div>
  );
}
