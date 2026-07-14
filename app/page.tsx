"use client";

import { Mail, MapPin, Phone, User } from "lucide-react";
import { motion, type Variants } from "motion/react";
import { profile } from "@/data/profile";
import BookmarkRow from "../components/BookmarkRow";
import ComponentRegistryList from "../components/ComponentRegistryList";
import Footer from "../components/Footer";
import ProjectCard from "../components/ProjectCard";
import GitHubContributions from "../components/profile/GitHubContributions";
import SectionDivider from "../components/SectionDivider";
import SeeAllButton from "../components/SeeAllButton";
import SeeAllProjectsButton from "../components/SeeAllProjectsButton";
import StackIcon from "../components/StackIcon";
import { GitHub, LinkedIn } from "../components/ui/icons";
import { getSortedBookmarks } from "../data/bookmarks";
import { projectsData } from "../data/projects";
import { useFavicons } from "../hooks/useFavicons";
import { getDomainName } from "../utils/url";

const MotionMapPin = motion.create(MapPin);
const MotionPhone = motion.create(Phone);
const MotionMail = motion.create(Mail);
const MotionUser = motion.create(User);

function Tech({
  children,
  color,
  url,
}: {
  children: string;
  color: string;
  url: string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-xs text-foreground py-1 px-2.5 rounded-md hover:bg-surface-hover transition-colors"
    >
      <StackIcon color={color} name={children} />
      {children}
    </a>
  );
}

const stackGroups = [
  {
    label: "Core Languages",
    items: [
      {
        name: "TypeScript",
        color: "#3178c6",
        url: "https://www.typescriptlang.org/",
      },
      {
        name: "JavaScript",
        color: "#f7df1e",
        url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
      },
      { name: "Go", color: "#00add8", url: "https://go.dev/" },
    ],
  },
  {
    label: "Interface",
    items: [
      { name: "React", color: "#61dafb", url: "https://react.dev/" },
      { name: "Next.js", color: "#111827", url: "https://nextjs.org/" },
      {
        name: "Tailwind CSS",
        color: "#38bdf8",
        url: "https://tailwindcss.com/",
      },
      { name: "Motion", color: "#7c3aed", url: "https://motion.dev/" },
      { name: "TanStack", color: "#ff4154", url: "https://tanstack.com/" },
      { name: "shadcn/ui", color: "#111827", url: "https://ui.shadcn.com/" },
      { name: "Base UI", color: "#6366f1", url: "https://base-ui.com/" },
    ],
  },
  {
    label: "Server & APIs",
    items: [
      { name: "Hono", color: "#eab308", url: "https://hono.dev/" },
      { name: "Node.js", color: "#5fa04e", url: "https://nodejs.org/" },
      { name: "Bun", color: "#fbf0df", url: "https://bun.sh/" },
      {
        name: "Better Auth",
        color: "#111827",
        url: "https://www.better-auth.com/",
      },
    ],
  },
  {
    label: "Data Layer",
    items: [
      {
        name: "PostgreSQL",
        color: "#4169e1",
        url: "https://www.postgresql.org/",
      },
      { name: "Redis", color: "#dc382d", url: "https://redis.io/" },
      { name: "SQLite", color: "#044a64", url: "https://www.sqlite.org/" },
      { name: "Convex", color: "#ee342f", url: "https://www.convex.dev/" },
      {
        name: "Drizzle ORM",
        color: "#c5f74f",
        url: "https://orm.drizzle.team/",
      },
    ],
  },
  {
    label: "Workflow & AI",
    items: [
      { name: "Git", color: "#f05032", url: "https://git-scm.com/" },
      { name: "GitHub", color: "#111827", url: "https://github.com/" },
      { name: "Vercel", color: "#111827", url: "https://vercel.com/" },
      { name: "Docker", color: "#2496ed", url: "https://www.docker.com/" },
      { name: "Postman", color: "#ff6c37", url: "https://www.postman.com/" },
      { name: "Vitest", color: "#6e9f18", url: "https://vitest.dev/" },
      { name: "Linear", color: "#5e6ad2", url: "https://linear.app/" },
      { name: "Claude", color: "#cc5a37", url: "https://claude.ai/" },
      {
        name: "Antigravity",
        color: "#8b5cf6",
        url: "https://github.com/google-deepmind/antigravity",
      },
      { name: "Gemini", color: "#4f46e5", url: "https://gemini.google.com/" },
      { name: "ChatGPT", color: "#10a37f", url: "https://chatgpt.com/" },
      {
        name: "Codex",
        color: "#10a37f",
        url: "https://openai.com/blog/openai-codex/",
      },
    ],
  },
  {
    label: "Design",
    items: [
      { name: "tldraw", color: "#ff4747", url: "https://www.tldraw.com/" },
      { name: "Excalidraw", color: "#6965db", url: "https://excalidraw.com/" },
      { name: "Paper", color: "#050505", url: "https://paper.design/" },
    ],
  },
] as const;

const iconBounceVariants: Variants = {
  normal: { y: 0 },
  animate: {
    y: [0, -2, 0.25, 0],
    transition: {
      duration: 0.45,
      ease: "easeOut",
    },
  },
};

export default function Home() {
  // Show only first 3 bookmarks / projects in the peek window
  const sortedBookmarks = getSortedBookmarks();
  const featuredBookmarks = sortedBookmarks.slice(0, 3);
  const featuredProjects = projectsData.slice(0, 3);

  const { data: faviconMap } = useFavicons();

  return (
    <div className="min-h-screen text-foreground font-sans antialiased relative z-10">
      <div className="max-w-3xl mx-auto px-6 py-8 sm:py-12">
        {/* Intro Header */}
        <header className="mb-12">
          {/* Profile Card Header */}
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {profile.name}
              </h1>
              <p className="text-xs text-subtle font-mono mt-1.5 uppercase tracking-wider">
                {profile.role}
              </p>
            </div>
          </div>

          {/* Grid Metadata columns (gridless) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-1 gap-y-1 text-sm text-muted-foreground mb-4 -mx-2 sm:w-2/3">
            <div className="space-y-1">
              <motion.div
                initial="normal"
                whileHover="animate"
                className="flex items-center gap-2.5 group cursor-default py-1.5 px-2 rounded-md hover:bg-surface-hover transition-colors"
              >
                <MotionMapPin
                  variants={iconBounceVariants}
                  className="w-4 h-4 text-subtle group-hover:text-foreground transition-colors"
                />
                <span className="group-hover:text-foreground transition-colors">
                  Ho Chi Minh City, Viet Nam
                </span>
              </motion.div>
              <motion.div
                initial="normal"
                whileHover="animate"
                className="flex items-center gap-2.5 group cursor-pointer py-1.5 px-2 rounded-md hover:bg-surface-hover transition-colors"
              >
                <MotionPhone
                  variants={iconBounceVariants}
                  className="w-4 h-4 text-subtle group-hover:text-foreground transition-colors"
                />
                <a
                  href="tel:+84326149613"
                  className="font-mono text-sm group-hover:text-foreground transition-colors"
                >
                  +84 326 149 613
                </a>
              </motion.div>
            </div>

            <div className="space-y-1">
              <motion.div
                initial="normal"
                whileHover="animate"
                className="flex items-center gap-2.5 group cursor-pointer py-1.5 px-2 rounded-md hover:bg-surface-hover transition-colors"
              >
                <MotionMail
                  variants={iconBounceVariants}
                  className="w-4 h-4 text-subtle group-hover:text-foreground transition-colors"
                />
                <a
                  href="mailto:zchr.work@gmail.com"
                  className="group-hover:text-foreground transition-colors"
                >
                  zchr.work@gmail.com
                </a>
              </motion.div>
              <motion.div
                initial="normal"
                whileHover="animate"
                className="flex items-center gap-2.5 group cursor-default py-1.5 px-2 rounded-md hover:bg-surface-hover transition-colors"
              >
                <MotionUser
                  variants={iconBounceVariants}
                  className="w-4 h-4 text-subtle group-hover:text-foreground transition-colors"
                />
                <span className="group-hover:text-foreground transition-colors">
                  he / him
                </span>
              </motion.div>
            </div>
          </div>

          {/* Social Buttons Row */}
          <div className="flex items-center gap-2 mt-4">
            <a
              href="https://github.com/zAcherttp"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-7 h-7 rounded-md border border-border hover:bg-muted hover:border-border hover:text-foreground text-subtle transition-all"
              aria-label="GitHub"
            >
              <GitHub className="w-3.5 h-3.5" />
            </a>
            <a
              href="https://www.linkedin.com/in/ttuanphat91605/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-7 h-7 rounded-md border border-border hover:bg-muted hover:border-border hover:text-foreground text-subtle transition-all"
              aria-label="LinkedIn"
            >
              <LinkedIn className="w-3.5 h-3.5" />
            </a>
          </div>
        </header>

        {/* About Section */}
        <SectionDivider className="mb-6" />
        <section className="mb-12 border-b border-border pb-6">
          <h2 className="mb-3 text-sm font-normal text-muted-foreground">
            About
          </h2>
          <div className="max-w-2xl space-y-4 text-pretty text-sm leading-6 text-muted-foreground">
            <p>
              I like building full-stack products with{" "}
              <span className="font-medium text-foreground">React</span>,{" "}
              <span className="font-medium text-foreground">Next.js</span>,{" "}
              <span className="font-medium text-foreground">TypeScript</span>,
              and backend systems with{" "}
              <span className="font-medium text-foreground">Hono</span>,{" "}
              <span className="font-medium text-foreground">Docker</span>, and a
              bit of <span className="font-medium text-foreground">Go</span>{" "}
              when I want to try something lower-level.
            </p>
            <p>
              I&apos;m drawn to design engineering: polished UI, small
              interaction details, frontend architecture, and the feeling of a
              product.
            </p>
            <p>
              I enjoy turning rough product ideas into clear data models, auth
              flows, API contracts, system boundaries, and maintainable code.
            </p>
            <p>
              Recently, I explored agent workflows and local LLMs. I&apos;m
              always looking out for new things to learn and build.
            </p>
          </div>
        </section>

        {/* Stack Section */}
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-normal text-muted-foreground">
            Stack
          </h2>
          <p className="mb-4 max-w-2xl text-pretty text-sm leading-6 text-muted-foreground">
            Things I&apos;ve worked with enough to comfortably read, debug, and
            build small features in. Some are daily drivers, others are tools I
            keep coming back to.
          </p>

          <div className="border-y border-border">
            {stackGroups.map((group, index) => (
              <div
                key={group.label}
                className="grid gap-2 border-b border-border py-2 last:border-b-0 sm:grid-cols-[11rem_1fr] sm:gap-5"
              >
                <div className="flex items-baseline gap-2 text-sm text-muted-foreground">
                  <span className="font-mono text-xs text-subtle-2">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>{group.label}</span>
                </div>

                <div className="flex flex-wrap gap-x-1 gap-y-1 text-sm leading-6 text-muted-foreground">
                  {group.items.map((item) => (
                    <Tech key={item.name} color={item.color} url={item.url}>
                      {item.name}
                    </Tech>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Components Section */}
        <section className="mb-12">
          <h2 className="mb-3 text-sm font-normal text-muted-foreground">
            Components
          </h2>
          <p className="mb-4 max-w-2xl text-pretty text-sm leading-6 text-muted-foreground">
            Interface details, interactions, and visual experiments I have
            pulled apart into reusable pieces.
          </p>
          <ComponentRegistryList />
        </section>

        {/* Contribution Graph Section */}
        <section className="mb-12">
          <GitHubContributions />
        </section>

        {/* Projects Section */}
        <SectionDivider className="mb-6" />
        <section className="mb-12 border-b border-border pb-8">
          <h2 className="mb-3 text-sm font-normal text-muted-foreground">
            Projects
          </h2>
          <div className="space-y-3 flex flex-col">
            {featuredProjects.map((project, index) => (
              <ProjectCard key={project.id} project={project} index={index} />
            ))}

            <SeeAllProjectsButton remaining={projectsData.slice(3)} />
          </div>
        </section>

        {/* Bookmarks Peek Widget */}
        <section className="mb-12">
          <div className="flex justify-between items-baseline mb-3">
            <h2 className="text-sm font-normal text-muted-foreground">
              Bookmarks
            </h2>
          </div>

          <div className="flex flex-col -mx-3 pb-4">
            {featuredBookmarks.map((bookmark) => (
              <BookmarkRow
                key={bookmark.url}
                bookmark={bookmark}
                faviconSrc={faviconMap?.[getDomainName(bookmark.url)] ?? null}
              />
            ))}

            <SeeAllButton
              remaining={sortedBookmarks.slice(3)}
              faviconMap={faviconMap ?? {}}
            />
          </div>
        </section>

        {/* Footer/Framing Placeholder */}
        <Footer />
      </div>
    </div>
  );
}
