import { BackButton } from "@/components/BackButton";
import Footer from "@/components/Footer";
import { BookmarksList } from "./bookmarks-list.client";

export default function BookmarksPage() {
  return (
    <main className="min-h-screen text-foreground font-sans antialiased relative z-10">
      <div className="max-w-3xl mx-auto px-6 py-12 sm:py-20">
        <nav className="mb-12">
          <BackButton />
        </nav>

        <header className="mb-8">
          <h1 className="text-xl font-bold tracking-tight text-foreground mb-2">
            Bookmarks
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
            A small list of tools, articles, design inspiration, and other cool
            things I keep coming back to.
          </p>
        </header>

        <BookmarksList />

        <Footer />
      </div>
    </main>
  );
}
