import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { rename, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";
import { type Project, projectsData } from "../data/projects";

const languagesSchema = z.record(
  z.string().trim().min(1),
  z.number().int().nonnegative(),
);

// Portfolio copy, ordering, IDs, URLs, and tags remain editorial content.
// GitHub owns only the language statistics refreshed by this command.
export async function refreshProjects(
  projects: readonly Project[],
  fetcher: typeof fetch = fetch,
  token?: string,
): Promise<Project[]> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "portfolio-updater",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const updated: Project[] = [];
  for (const project of projects) {
    const url = new URL(project.url);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "github.com" ||
      !/^\/zAcherttp\/[^/]+\/?$/i.test(url.pathname)
    ) {
      throw new Error(`Invalid GitHub repository URL for ${project.title}`);
    }

    const repository = url.pathname.replace(/\/$/, "");
    const response = await fetcher(
      `https://api.github.com/repos${repository}/languages`,
      { headers, signal: AbortSignal.timeout(15_000) },
    );
    if (!response.ok) {
      throw new Error(`${project.title}: GitHub HTTP ${response.status}`);
    }

    const statistics = languagesSchema.parse(await response.json());
    const languages = Object.entries(statistics)
      .filter(([, bytes]) => bytes > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([language]) => language);

    // Empty repositories have no statistics; retain the last known values.
    updated.push(
      languages.length
        ? { ...project, languages, primaryLanguage: languages[0] }
        : { ...project },
    );
  }
  return updated;
}

async function main() {
  const envPath = fileURLToPath(new URL("../.env", import.meta.url));
  if (existsSync(envPath)) process.loadEnvFile(envPath);

  // Fetch and validate every repository before replacing the content file.
  const updated = await refreshProjects(
    projectsData,
    fetch,
    process.env.GITHUB_TOKEN,
  );
  const source = `export interface Project {
  id: string;
  title: string;
  url: string;
  urlLabel: string;
  description: string;
  tags: string[];
  languages: string[];
  primaryLanguage: string;
}

export const projectsData: Project[] = ${JSON.stringify(updated, null, 2)};
`;
  const root = fileURLToPath(new URL("..", import.meta.url));
  const formatted = spawnSync(
    "pnpm",
    ["exec", "biome", "format", "--stdin-file-path=data/projects.ts"],
    { cwd: root, input: source, encoding: "utf8" },
  );
  if (formatted.error || formatted.status !== 0) {
    throw new Error(
      formatted.error?.message || formatted.stderr || "Formatting failed",
    );
  }

  const output = fileURLToPath(new URL("../data/projects.ts", import.meta.url));
  const temporary = `${output}.tmp`;
  await writeFile(temporary, formatted.stdout, "utf8");
  await rename(temporary, output);
  console.log(
    `Refreshed languages for ${updated.length} projects. Review the diff before publishing.`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
