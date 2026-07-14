import { profile } from "@/data/profile";

export type StaticSeoKey = keyof typeof staticSeo;

export const staticSeo = {
  home: {
    path: "/",
    eyebrow: "Profile",
    title: undefined,
    description: profile.description,
  },
  bookmarks: {
    path: "/bookmarks",
    eyebrow: "Library",
    title: "Bookmarks",
    description:
      "A curated collection of tools, articles, design inspiration, and useful references I keep coming back to.",
  },
  projects: {
    path: "/projects",
    eyebrow: "Selected work",
    title: "Projects",
    description: `Libraries, developer tools, desktop applications, and web services built by ${profile.name}.`,
  },
  playground: {
    path: "/playground",
    eyebrow: "WebGL experiment",
    title: "Shader Playground",
    description:
      "An interactive playground for exploring dithered fire, noise, color, and motion in real time.",
  },
  components: {
    path: "/components",
    eyebrow: "Interface registry",
    title: "Components",
    description: `A growing registry of interface details, interactions, and visual experiments by ${profile.name}.`,
  },
} as const;
