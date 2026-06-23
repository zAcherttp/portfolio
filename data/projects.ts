export interface Project {
  id: string;
  title: string;
  url: string;
  urlLabel: string;
  description: string;
  tags: string[];
}

export const projectsData: Project[] = [
  {
    id: "1",
    title: "Aetherius CLI",
    url: "https://github.com/zAcherttp/aetherius",
    urlLabel: "github.com",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip.",
    tags: ["Rust", "Git API", "CLI"],
  },
  {
    id: "2",
    title: "oklch.fyi",
    url: "https://oklch.fyi",
    urlLabel: "oklch.fyi",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident.",
    tags: ["TypeScript", "OKLCH", "Design System"],
  },
  {
    id: "3",
    title: "Paper Notes",
    url: "https://paper.design",
    urlLabel: "paper.design",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Mollis pretium lorem primis cubilia habitasse. Mauris integer inceptos class potenti elementum. Fringilla diam feugiat dictumst scelerisque id dictum.",
    tags: ["Next.js", "Lexical", "Tailwind"],
  },
];
