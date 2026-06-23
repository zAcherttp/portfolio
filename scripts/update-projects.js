const fs = require("node:fs");
const path = require("node:path");

// Load environment variables from .env if present
const envPath = path.join(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }
      process.env[key] = value.trim();
    }
  }
}

const projectsBase = [
  {
    id: "1",
    title: "miniclaw",
    url: "https://github.com/zAcherttp/miniclaw",
    urlLabel: "github.com",
    tags: [],
    primaryLanguage: "Go",
  },
  {
    id: "2",
    title: "next-wms",
    url: "https://github.com/zAcherttp/next-wms",
    urlLabel: "github.com",
    tags: [],
    primaryLanguage: "TypeScript",
  },
  {
    id: "3",
    title: "start-themes",
    url: "https://github.com/zAcherttp/start-themes",
    urlLabel: "github.com",
    tags: [],
    primaryLanguage: "TypeScript",
  },
  {
    id: "4",
    title: "se363-chat-agent-demo",
    url: "https://github.com/zAcherttp/se363-chat-agent-demo",
    urlLabel: "github.com",
    tags: [],
    primaryLanguage: "TypeScript",
  },
  {
    id: "5",
    title: "se104-auto-repair-shop",
    url: "https://github.com/zAcherttp/se104-auto-repair-shop",
    urlLabel: "github.com",
    tags: [],
    primaryLanguage: "C#",
  },
  {
    id: "6",
    title: "facebook-conversation-folder-viewer",
    url: "https://github.com/zAcherttp/facebook-conversation-folder-viewer",
    urlLabel: "github.com",
    tags: [],
    primaryLanguage: "JavaScript",
  },
  {
    id: "7",
    title: "SE102-SuperMarioBros3",
    url: "https://github.com/zAcherttp/SE102-SuperMarioBros3",
    urlLabel: "github.com",
    tags: [],
    primaryLanguage: "C++",
  },
  {
    id: "8",
    title: "FoodAppAPI",
    url: "https://github.com/zAcherttp/FoodAppAPI",
    urlLabel: "github.com",
    tags: [],
    primaryLanguage: "C#",
  },
  {
    id: "9",
    title: "IT008-MVVMPaintApp",
    url: "https://github.com/zAcherttp/IT008-MVVMPaintApp",
    urlLabel: "github.com",
    tags: [],
    primaryLanguage: "C#",
  },
];

async function updateProjects() {
  console.log("Fetching repository metadata and languages from GitHub...");
  const updatedProjects = [];

  const headers = {
    "User-Agent": "portfolio-updater",
  };
  if (process.env.GITHUB_TOKEN) {
    console.log("Using GITHUB_TOKEN for authentication.");
    headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
  } else {
    console.log("No GITHUB_TOKEN found. Using unauthenticated requests.");
  }

  for (const project of projectsBase) {
    try {
      const repoUrl = `https://api.github.com/repos/zAcherttp/${project.title}`;
      const repoRes = await fetch(repoUrl, { headers });

      if (!repoRes.ok) {
        throw new Error(`Repo HTTP ${repoRes.status}`);
      }

      const repoData = await repoRes.json();

      const langsUrl = `https://api.github.com/repos/zAcherttp/${project.title}/languages`;
      const langsRes = await fetch(langsUrl, { headers });

      let languages = [];
      if (langsRes.ok) {
        const langsData = await langsRes.json();
        languages = Object.entries(langsData)
          .sort((a, b) => b[1] - a[1])
          .map((entry) => entry[0]);
      }

      const primaryLanguage =
        languages[0] || repoData.language || project.primaryLanguage;

      console.log(
        `✓ Fetched ${project.title}: primaryLanguage=${primaryLanguage}, languages=[${languages.join(", ")}]`,
      );

      updatedProjects.push({
        ...project,
        description: repoData.description || `${project.title}.description`,
        primaryLanguage,
        languages,
      });
    } catch (err) {
      console.warn(
        `⚠ Failed to fetch ${project.title}: ${err.message}. Using default values.`,
      );
      updatedProjects.push({
        ...project,
        description: `${project.title}.description`,
        primaryLanguage: project.primaryLanguage,
        languages: [project.primaryLanguage],
      });
    }
  }

  const fileContent = `export interface Project {
  id: string;
  title: string;
  url: string;
  urlLabel: string;
  description: string;
  tags: string[];
  languages: string[];
  primaryLanguage: string;
}

export const projectsData: Project[] = ${JSON.stringify(updatedProjects, null, 2)};
`;

  const outputPath = path.join(__dirname, "../data/projects.ts");
  fs.writeFileSync(outputPath, fileContent, "utf8");
  console.log(`\nSuccessfully updated ${outputPath}`);
}

updateProjects();
