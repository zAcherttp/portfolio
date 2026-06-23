"use client";

import { useState } from "react";
import type { Project } from "../data/projects";
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
    <a
      href={project.url}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="flex flex-col gap-1.5 p-4 rounded-xl border border-zinc-100/70 hover:bg-zinc-50/40 hover:border-zinc-200/50 transition-all duration-300 group/p cursor-pointer"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-zinc-400">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3 className="font-medium text-sm text-zinc-900">{project.title}</h3>
        </div>
        <div className="inline-flex items-center gap-0.5 text-xs text-zinc-400 group-hover/p:text-zinc-950 transition-colors">
          <span>{project.urlLabel}</span>
          <RotatingArrow isHovered={isHovered} />
        </div>
      </div>
      <p className="text-sm text-zinc-500 max-w-xl leading-relaxed">
        {project.description}
      </p>
      <div className="flex flex-wrap gap-1.5 mt-1">
        {/* Languages */}
        {project.languages.map((lang) => (
          <span
            key={lang}
            className="inline-flex items-center gap-1.5 text-[10px] font-mono py-0.5 px-2 bg-zinc-100 text-zinc-600 rounded-md"
          >
            {renderLanguageIcon(lang)}
            {lang}
          </span>
        ))}
        {/* Tags */}
        {project.tags.map((tag) => (
          <span
            key={tag}
            className="text-[10px] font-mono py-0.5 px-2 bg-zinc-100 text-zinc-600 rounded-md"
          >
            {tag}
          </span>
        ))}
      </div>
    </a>
  );
}
