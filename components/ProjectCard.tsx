"use client";

import { useState } from "react";
import type { Project } from "../data/projects";
import { ExternalLink } from "./ExternalLink";
import RotatingArrow from "./ui/RotatingArrow";
import {
  CPlusPlus,
  CSharp,
  CssOld,
  Html5,
  Javascript,
  Powershell,
  Typescript,
} from "./ui/svgs";

interface ProjectCardProps {
  project: Project;
  index: number;
}

export default function ProjectCard({ project, index }: ProjectCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const renderLanguageIcon = (lang: string) => {
    const props = { className: "w-2.5 h-2.5 shrink-0" };
    switch (lang) {
      case "TypeScript":
        return <Typescript {...props} />;
      case "JavaScript":
        return <Javascript {...props} />;
      case "C++":
        return <CPlusPlus {...props} />;
      case "C#":
        return <CSharp {...props} />;
      case "HTML":
        return <Html5 {...props} />;
      case "CSS":
        return <CssOld {...props} />;
      case "PowerShell":
        return <Powershell {...props} />;
      default:
        return null;
    }
  };

  return (
    <ExternalLink
      attributionContext="project"
      href={project.url}
      target="_blank"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group/p flex cursor-pointer flex-col gap-1.5 rounded-xl border border-border px-3 py-4 transition-colors hover:bg-surface-hover"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-subtle">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3 className="font-medium text-sm text-foreground">
            {project.title}
          </h3>
        </div>
        <div className="inline-flex items-center text-xs text-subtle group-hover/p:text-foreground/80 transition-colors">
          <span>{project.urlLabel}</span>
          <RotatingArrow isHovered={isHovered} />
        </div>
      </div>
      <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
        {project.description}
      </p>
      <div className="flex flex-wrap gap-1.5 mt-1">
        {/* Languages */}
        {project.languages.map((lang) => (
          <span
            key={lang}
            className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground dark:bg-zinc-900/70"
          >
            {renderLanguageIcon(lang)}
            {lang}
          </span>
        ))}
        {/* Tags */}
        {project.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground"
          >
            {tag}
          </span>
        ))}
      </div>
    </ExternalLink>
  );
}
