import { describe, expect, it, vi } from "vitest";
import { type Project, projectsData } from "@/data/projects";
import { refreshProjects } from "../../scripts/update-projects.mjs";

const project: Project = {
  ...projectsData[0],
  title: "Curated display title",
  description: "Handwritten portfolio description",
  tags: ["Keep this tag"],
};

describe("project language refresh", () => {
  it("uses the repository URL and preserves all curated fields and ordering", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(
        async () =>
          new Response(JSON.stringify({ CSS: 20, TypeScript: 100, HTML: 0 })),
      );
    const input = [project, { ...project, id: "second" }];
    const result = await refreshProjects(input, fetcher, "test-token");

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.github.com/repos/zAcherttp/electron-boilerplate/languages",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      }),
    );
    expect(result).toEqual(
      input.map((entry) => ({
        ...entry,
        languages: ["TypeScript", "CSS"],
        primaryLanguage: "TypeScript",
      })),
    );
    expect(input[0].languages).toEqual(projectsData[0].languages);
  });

  it("retains last known languages when GitHub has no statistics", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}"));
    expect(await refreshProjects([project], fetcher)).toEqual([project]);
  });

  it("rejects a partial refresh instead of returning placeholder content", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{"TypeScript":100}'))
      .mockResolvedValueOnce(new Response("", { status: 403 }));
    await expect(refreshProjects([project, project], fetcher)).rejects.toThrow(
      "GitHub HTTP 403",
    );
    expect(project.description).toBe("Handwritten portfolio description");
  });

  it("rejects malformed language statistics", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{"CSS":"invalid"}'));
    await expect(refreshProjects([project], fetcher)).rejects.toThrow();
  });

  it("rejects unrelated URLs before sending a request", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      refreshProjects(
        [{ ...project, url: "https://example.com/repo" }],
        fetcher,
      ),
    ).rejects.toThrow("Invalid GitHub repository URL");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
