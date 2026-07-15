import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const testRoot = resolve(process.cwd(), "tests");
const thisFile = resolve(testRoot, "unit/test-contract.test.ts");

function collectTestFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectTestFiles(path);
    if (!/\.(?:test|spec)\.[jt]sx?$/.test(entry.name) || path === thisFile) {
      return [];
    }
    return [path];
  });
}

const forbiddenPatterns = [
  {
    name: "fixed browser sleep",
    pattern: /\.waitForTimeout\s*\(/g,
  },
  {
    name: "broad truthiness matcher",
    pattern: /\.toBe(?:Truthy|Falsy)\s*\(/g,
  },
  {
    name: "unscoped snapshot assertion",
    pattern: /\.toMatch(?:Inline)?Snapshot\s*\(/g,
  },
] as const;

describe("test authoring contract", () => {
  it("rejects fixed sleeps, broad truthiness, and unscoped snapshots", () => {
    const violations = collectTestFiles(testRoot).flatMap((path) => {
      const source = readFileSync(path, "utf8");
      return forbiddenPatterns.flatMap(({ name, pattern }) => {
        pattern.lastIndex = 0;
        return Array.from(source.matchAll(pattern), (match) => {
          const line = source.slice(0, match.index).split("\n").length;
          return `${relative(process.cwd(), path)}:${line} ${name}`;
        });
      });
    });

    expect(violations, violations.join("\n")).toEqual([]);
  });
});
