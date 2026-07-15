import { BackButton } from "@/components/BackButton";
import Footer from "@/components/Footer";
import { ProjectsList } from "./projects-list.client";

export default function ProjectsPage() {
  return (
    <main className="min-h-screen text-foreground font-sans antialiased relative z-10">
      <div className="max-w-3xl mx-auto px-6 py-12 sm:py-20">
        <nav className="mb-12">
          <BackButton />
        </nav>

        <header className="mb-8">
          <h1 className="text-xl font-bold tracking-tight text-foreground mb-2">
            Projects
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
            A curated list of libraries, developer tools, desktop applications,
            and web services I have built.
          </p>
        </header>

        <ProjectsList />

        <Footer />
      </div>
    </main>
  );
}
