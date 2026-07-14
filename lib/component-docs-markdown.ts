import { readFile } from "node:fs/promises";
import path from "node:path";
import { componentDocs } from "@/lib/component-docs-source";
import { generateTypeTable } from "@/lib/type-table";

const AUTO_TYPE_TABLE_PATTERN =
  /<AutoTypeTable\s+path="([^"]+)"\s+name="([^"]+)"\s*\/>/g;

function escapeTableCell(value: string) {
  return value.replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderType(value: string) {
  return `<code>${escapeTableCell(escapeHtml(value))}</code>`;
}

async function renderTypeTable(sourcePath: string, name: string) {
  const docs = await generateTypeTable({ path: sourcePath, name });

  return docs
    .map((doc) => {
      const rows = doc.entries.map((entry) => {
        const prop = escapeTableCell(
          `${entry.name}${entry.required ? "" : "?"}`,
        );
        const description = escapeTableCell(entry.description || "—");

        return `| ${prop} | ${renderType(entry.type)} | ${description} |`;
      });

      return [
        `#### ${doc.name}`,
        "",
        "| Prop | Type | Description |",
        "| --- | --- | --- |",
        ...rows,
      ].join("\n");
    })
    .join("\n\n");
}

async function expandTypeTables(markdown: string) {
  const matches = Array.from(markdown.matchAll(AUTO_TYPE_TABLE_PATTERN));
  if (matches.length === 0) return markdown;

  let output = "";
  let cursor = 0;

  for (const match of matches) {
    const index = match.index ?? cursor;
    output += markdown.slice(cursor, index);
    output += await renderTypeTable(match[1], match[2]);
    cursor = index + match[0].length;
  }

  return output + markdown.slice(cursor);
}

export async function getComponentDocsMarkdown(slug: string) {
  const page = componentDocs.getPage([slug]);
  if (!page) return null;

  const source = await readFile(
    path.join(process.cwd(), "content", "components", `${slug}.mdx`),
    "utf8",
  );
  const content = await expandTypeTables(source);

  return [
    `# ${page.data.title}`,
    "",
    `> ${page.data.description}`,
    "",
    content.trim(),
    "",
  ].join("\n");
}
