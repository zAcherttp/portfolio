"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import Footer from "../../components/Footer";
import ProjectCard from "../../components/ProjectCard";
import { projectsData } from "../../data/projects";

export default function ProjectsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const categories = [
    "All",
    ...Array.from(new Set(projectsData.flatMap((p) => p.languages))).sort(),
  ];

  const filteredProjects = projectsData.filter(
    (project) =>
      selectedCategory === "All" ||
      project.languages.includes(selectedCategory),
  );

  return (
    <div className="min-h-screen text-zinc-900 font-sans antialiased relative z-10">
      <div className="max-w-3xl mx-auto px-6 py-12 sm:py-20">
        {/* Navigation */}
        <nav className="mb-12">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
        </nav>

        {/* Header */}
        <header className="mb-8">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 mb-2">
            Projects
          </h1>
          <p className="text-sm text-zinc-500 max-w-2xl leading-relaxed">
            A curated list of libraries, developer tools, desktop applications,
            and web services I have built.
          </p>
        </header>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-zinc-100">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
                selectedCategory === category
                  ? "bg-zinc-900 text-white shadow-xs"
                  : "bg-zinc-100/80 text-zinc-600 hover:bg-zinc-200/80"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Projects List */}
        {filteredProjects.length > 0 ? (
          <div className="space-y-3">
            {filteredProjects.map((project, index) => (
              <ProjectCard key={project.id} project={project} index={index} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-zinc-50/50 rounded-xl border border-dashed border-zinc-200">
            <p className="text-zinc-500 font-medium">
              No projects found matching your criteria.
            </p>
          </div>
        )}

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
}
