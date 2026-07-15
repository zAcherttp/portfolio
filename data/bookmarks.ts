export interface Bookmark {
  title: string;
  description: string;
  url: string;
  category: "Design" | "Dev Tools" | "Inspiration" | "Resources";
  tags: string[];
  date: string;
}

export const bookmarksData: Bookmark[] = [
  {
    title: "Animations.dev",
    description: "High-performance web animation course.",
    url: "https://animations.dev/",
    category: "Resources",
    tags: ["Animation", "Interactive", "Course"],
    date: "2025-04-12",
  },
  {
    title: "Linear",
    description: "Issue tracker built for speed.",
    url: "https://linear.app",
    category: "Design",
    tags: ["Productivity", "UI/UX", "App"],
    date: "2025-04-13",
  },
  {
    title: "Excalidraw",
    description: "Collaborative virtual whiteboard.",
    url: "https://excalidraw.com/",
    category: "Dev Tools",
    tags: ["Whiteboard", "Collaboration", "Tool"],
    date: "2025-09-06",
  },
  {
    title: "Vercel",
    description: "Frontend deployment platform.",
    url: "https://vercel.com",
    category: "Dev Tools",
    tags: ["Hosting", "Cloud", "DX"],
    date: "2025-04-13",
  },
  {
    title: "UI.live",
    description: "Interactive UI motion gallery.",
    url: "https://ui.live/",
    category: "Inspiration",
    tags: ["UI", "Gallery", "Motion"],
    date: "2025-05-20",
  },
  {
    title: "Easing Graphs",
    description: "Custom animation curve tool.",
    url: "https://www.easing.dev/",
    category: "Design",
    tags: ["Easing", "Animation", "Tools"],
    date: "2025-06-27",
  },
  {
    title: "Paper",
    description: "Minimal product document editor.",
    url: "https://paper.design/",
    category: "Design",
    tags: ["Productivity", "UI/UX", "Product"],
    date: "2025-07-01",
  },
  {
    title: "Design Systems Database",
    description: "Gallery of curated design systems.",
    url: "https://designsystems.surf/",
    category: "Design",
    tags: ["Design Systems", "Gallery", "UI"],
    date: "2025-07-30",
  },
  {
    title: "Fonts in Use",
    description: "Typography archive in use cases.",
    url: "https://fontsinuse.com",
    category: "Inspiration",
    tags: ["Typography", "Archive", "Design"],
    date: "2025-04-13",
  },
  {
    title: "Patterns.dev",
    description: "JavaScript design patterns guide.",
    url: "https://www.patterns.dev/#patterns",
    category: "Dev Tools",
    tags: ["JavaScript", "Architecture", "Patterns"],
    date: "2025-09-06",
  },
  {
    title: "oklch.fyi",
    description: "Modern OKLCH color picker.",
    url: "https://oklch.fyi/",
    category: "Design",
    tags: ["Colors", "OKLCH", "CSS"],
    date: "2026-01-05",
  },
  {
    title: "/rams",
    description: "Claude Code & Cursor design engineer.",
    url: "https://www.rams.ai/",
    category: "Inspiration",
    tags: ["Portfolio", "Design Engineer", "AI"],
    date: "2026-01-19",
  },
  {
    title: "OpenStatus",
    description: "Uptime monitoring and status pages.",
    url: "https://www.openstatus.dev/",
    category: "Dev Tools",
    tags: ["Monitoring", "Analytics", "Open Source"],
    date: "2026-02-18",
  },
  {
    title: "Torph",
    description: "Dependency-free text morphing library.",
    url: "https://torph.lochie.me/",
    category: "Resources",
    tags: ["Typography", "Text Morphing", "Library"],
    date: "2026-02-19",
  },
  {
    title: "React Flow",
    description: "Node-based React UI library.",
    url: "https://reactflow.dev/",
    category: "Dev Tools",
    tags: ["React", "Node-Based", "Library"],
    date: "2026-02-26",
  },
  {
    title: "Svgl",
    description: "Curated SVG logo library.",
    url: "https://svgl.app/",
    category: "Design",
    tags: ["SVG", "Logos", "Library"],
    date: "2026-03-09",
  },
  {
    title: "Interface Craft",
    description: "Interactive high-fidelity UI library.",
    url: "https://www.interfacecraft.dev/",
    category: "Design",
    tags: ["UI Craft", "Design Systems", "Details"],
    date: "2026-04-19",
  },
  {
    title: "Refactoring.Guru",
    description: "Visual design patterns manual.",
    url: "https://refactoring.guru/",
    category: "Resources",
    tags: ["Refactoring", "Design Patterns", "Learning"],
    date: "2026-04-20",
  },
  {
    title: "Siri RE Shaders",
    description: "WebGL Siri wave shader simulation.",
    url: "https://aaaa-zhen.github.io/siri-glsl/siri-wave.html",
    category: "Inspiration",
    tags: ["GLSL", "Shaders", "Motion"],
    date: "2026-06-13",
  },
  {
    title: "Jeremiah",
    description: "Motion & interactive design portfolio.",
    url: "https://aaaa-zhen.github.io/MAFUZHEN/",
    category: "Inspiration",
    tags: ["Portfolio", "Motion Design", "WebGL"],
    date: "2026-06-13",
  },
  {
    title: "Daniel Petho",
    description: "Creative design engineer portfolio.",
    url: "https://www.danielpetho.com/",
    category: "Inspiration",
    tags: ["Portfolio", "Design Engineer", "UI"],
    date: "2026-06-17",
  },
  {
    title: "Recent Design",
    description: "Recent design trends and inspiration.",
    url: "https://recent.design/",
    category: "Inspiration",
    tags: ["UI", "Design Systems", "Details"],
    date: "2026-06-23",
  },
  {
    title: "Vercel Design Engineer",
    description: "Guidelines and resources for design engineering at Vercel.",
    url: "https://vercel.com/design/engineer",
    category: "Design",
    tags: ["Design Systems", "Engineering", "Vercel"],
    date: "2026-06-23",
  },
  {
    title: "Interfaces",
    description: "A curated list of beautiful interactive user interfaces.",
    url: "https://interfaces.dev/",
    category: "Inspiration",
    tags: ["UI", "Gallery", "Interactive"],
    date: "2026-06-23",
  },
  {
    title: "Making Software",
    description: "Articles on software development, architecture, and design.",
    url: "https://www.makingsoftware.com/",
    category: "Resources",
    tags: ["Engineering", "Software", "Learning"],
    date: "2026-06-23",
  },
  {
    title: "Ethan Niser",
    description:
      "Personal site and tech blog of software engineer Ethan Niser.",
    url: "https://ethanniser.dev/",
    category: "Inspiration",
    tags: ["Portfolio", "Blog", "Web Dev"],
    date: "2026-06-23",
  },
  {
    title: "Emil Kowalski",
    description:
      "Design engineer portfolio showcasing animations and UI recipes.",
    url: "https://emilkowal.ski/",
    category: "Inspiration",
    tags: ["Animations", "Design Engineer", "Portfolio"],
    date: "2026-06-23",
  },
  {
    title: "Devouring Details",
    description:
      "Interactive design details, UX motion, and animation explorations.",
    url: "https://devouringdetails.com/",
    category: "Design",
    tags: ["UI", "Details", "Motion"],
    date: "2026-06-23",
  },
  {
    title: "Evil Charts",
    description: "Documentation for the Evil Charts Scala charting library.",
    url: "https://evilcharts.com/docs",
    category: "Dev Tools",
    tags: ["Charts", "Scala", "Docs"],
    date: "2026-06-23",
  },
  {
    title: "Skiper UI",
    description: "React component library built with Tailwind CSS.",
    url: "https://skiper-ui.com/",
    category: "Resources",
    tags: ["React", "Tailwind", "Library"],
    date: "2026-06-23",
  },
  {
    title: "Alex Harri",
    description: "Interactive essays on software, graphics, and web APIs.",
    url: "https://alexharri.com/",
    category: "Inspiration",
    tags: ["Blog", "Engineering", "Interactive"],
    date: "2026-07-15",
  },
];

export const getSortedBookmarks = (): Bookmark[] => {
  return [...bookmarksData]
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const dateCompare = b.item.date.localeCompare(a.item.date);
      if (dateCompare !== 0) return dateCompare;
      return a.index - b.index;
    })
    .map((x) => x.item);
};
