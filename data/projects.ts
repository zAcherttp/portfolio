export interface Project {
  id: string;
  title: string;
  url: string;
  urlLabel: string;
  description: string;
  tags: string[];
  languages: string[];
  primaryLanguage: string;
}

export const projectsData: Project[] = [
  {
    id: "1",
    title: "miniclaw",
    url: "https://github.com/zAcherttp/miniclaw",
    urlLabel: "github.com",
    tags: [],
    primaryLanguage: "TypeScript",
    description:
      "A local-first personal AI virtual assistant daemon running as a Telegram bot and CLI app. Built with LangGraph and TypeScript to manage schedules, tasks, and files.",
    languages: ["TypeScript", "HTML"],
  },
  {
    id: "2",
    title: "next-wms",
    url: "https://github.com/zAcherttp/next-wms",
    urlLabel: "github.com",
    tags: [],
    primaryLanguage: "TypeScript",
    description:
      "A warehouse management system built as a Turborepo monorepo with Next.js, tRPC, Drizzle ORM, and Better Auth.",
    languages: ["TypeScript", "PowerShell", "CSS", "JavaScript"],
  },
  {
    id: "3",
    title: "start-themes",
    url: "https://github.com/zAcherttp/start-themes",
    urlLabel: "github.com",
    tags: [],
    primaryLanguage: "TypeScript",
    description:
      "A personal showcase illustrating a hydration-safe, cross-tab synced theme hook built for TanStack Start with Fumadocs theme presets.",
    languages: ["TypeScript", "MDX", "CSS", "HTML"],
  },
  {
    id: "4",
    title: "se363-chat-agent-demo",
    url: "https://github.com/zAcherttp/se363-chat-agent-demo",
    urlLabel: "github.com",
    tags: [],
    primaryLanguage: "TypeScript",
    description:
      "An AI chatbot built with Next.js, Vercel AI SDK, and LightRAG for document retrieval and Neo4j knowledge graph queries.",
    languages: ["TypeScript", "JavaScript", "CSS"],
  },
  {
    id: "5",
    title: "se104-auto-repair-shop",
    url: "https://github.com/zAcherttp/se104-auto-repair-shop",
    urlLabel: "github.com",
    tags: [],
    primaryLanguage: "TypeScript",
    description:
      "Automobile repair shop manager built using Next.js, Typescript, Shadcn, Tailwind, Supabase",
    languages: ["TypeScript", "JavaScript", "CSS"],
  },
  {
    id: "6",
    title: "facebook-conversation-folder-viewer",
    url: "https://github.com/zAcherttp/facebook-conversation-folder-viewer",
    urlLabel: "github.com",
    tags: [],
    primaryLanguage: "TypeScript",
    description:
      "Client-side Facebook Messenger archive viewer — browse, search (virtualized, private, no uploads).",
    languages: ["TypeScript", "CSS"],
  },
  {
    id: "7",
    title: "SE102-SuperMarioBros3",
    url: "https://github.com/zAcherttp/SE102-SuperMarioBros3",
    urlLabel: "github.com",
    tags: [],
    primaryLanguage: "C++",
    description:
      "A Super Mario Bros 3 clone recreating levels 1-1 and 1-4. Built with C++ and DirectX 11, featuring AABB collision detection and a custom sprite animation system.",
    languages: ["C++", "PLSQL", "C#", "C"],
  },
  {
    id: "8",
    title: "FoodAppAPI",
    url: "https://github.com/zAcherttp/FoodAppAPI",
    urlLabel: "github.com",
    tags: [],
    primaryLanguage: "TypeScript",
    description:
      "An Express recipe API built with Node.js and TypeScript. Features Supabase (PostgreSQL), JWT auth, Gemini AI recipe suggestions, and real-time updates via Socket.IO.",
    languages: ["TypeScript", "HTML", "JavaScript"],
  },
  {
    id: "9",
    title: "IT008-MVVMPaintApp",
    url: "https://github.com/zAcherttp/IT008-MVVMPaintApp",
    urlLabel: "github.com",
    tags: [],
    primaryLanguage: "C#",
    description:
      "A WPF paint app built with C# (.NET 9) using the MVVM pattern. Features layers, history (Undo/Redo), custom palettes, zoom/pan, and pixel editing via WriteableBitmapEx.",
    languages: ["C#", "C++"],
  },
];
