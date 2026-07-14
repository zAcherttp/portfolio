"use client";

import { useState } from "react";
import ProjectCard from "@/components/ProjectCard";
import { projectsData } from "@/data/projects";

const categories = [
  "All",
  ...Array.from(
    new Set(projectsData.flatMap((project) => project.languages)),
  ).sort(),
];

export function ProjectsList() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const filteredProjects = projectsData.filter(
    (project) =>
      selectedCategory === "All" ||
      project.languages.includes(selectedCategory),
  );

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-2 border-b border-border pb-4">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setSelectedCategory(category)}
            className={`cursor-pointer rounded-full px-4 py-1.5 font-medium text-sm transition-colors ${
              selectedCategory === category
                ? "bg-foreground text-background shadow-xs"
                : "bg-muted text-muted-foreground hover:bg-surface-hover"
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {filteredProjects.length > 0 ? (
        <div className="space-y-3">
          {filteredProjects.map((project, index) => (
            <ProjectCard key={project.id} project={project} index={index} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border border-dashed bg-muted/50 py-20 text-center">
          <p className="font-medium text-muted-foreground">
            No projects found matching your criteria.
          </p>
        </div>
      )}
    </>
  );
}
