import { readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import type { RegistryEntry } from "@/data/components";

export type CapturedComponentUsage = {
  code: string;
  language: string;
  title: string;
};

function getUsageTitle(selector: string) {
  return `${selector.replaceAll(/([a-z\d])([A-Z])/g, "$1-$2").toLowerCase()}.tsx`;
}

function getJsxTagName(node: ts.JsxTagNameExpression) {
  return ts.isIdentifier(node) ? node.text : node.getText();
}

function getBaseIndent(source: string, pos: number): string {
  let lineStart = pos;
  while (
    lineStart > 0 &&
    source[lineStart - 1] !== "\n" &&
    source[lineStart - 1] !== "\r"
  ) {
    lineStart--;
  }
  const leadingText = source.slice(lineStart, pos);
  const match = leadingText.match(/^\s*/);
  return match ? match[0] : "";
}

function dedentText(text: string, baseIndent: string): string {
  if (!baseIndent) return text;
  const lines = text.split(/\r?\n/);
  const dedentedLines = lines.map((line, index) => {
    if (index === 0) return line;
    if (line.startsWith(baseIndent)) {
      return line.slice(baseIndent.length);
    }
    if (line.trim() === "") return "";
    return line;
  });
  return dedentedLines.join("\n");
}

function extractJsxUsage(source: string, selector: string, fileName: string) {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let usageNode: ts.JsxElement | ts.JsxSelfClosingElement | undefined;

  const findUsage = (node: ts.Node) => {
    if (usageNode) return;
    if (
      (ts.isJsxElement(node) &&
        getJsxTagName(node.openingElement.tagName) === selector) ||
      (ts.isJsxSelfClosingElement(node) &&
        getJsxTagName(node.tagName) === selector)
    ) {
      usageNode = node;
      return;
    }
    ts.forEachChild(node, findUsage);
  };
  findUsage(sourceFile);

  if (!usageNode) {
    throw new Error(
      `Unable to capture component usage: <${selector}> is not in ${fileName}`,
    );
  }

  const referencedNames = new Set<string>();
  const collectReferences = (node: ts.Node) => {
    if (ts.isIdentifier(node)) referencedNames.add(node.text);
    ts.forEachChild(node, collectReferences);
  };
  collectReferences(usageNode);

  const imports = sourceFile.statements.filter(
    (statement): statement is ts.ImportDeclaration => {
      if (!ts.isImportDeclaration(statement)) return false;
      return (
        statement.importClause
          ?.getChildren(sourceFile)
          .some(
            (node) => ts.isIdentifier(node) && referencedNames.has(node.text),
          ) ?? false
      );
    },
  );

  const usageNodeStart = usageNode.getStart(sourceFile);
  const baseIndent = getBaseIndent(source, usageNodeStart);
  const usageNodeText = dedentText(usageNode.getText(sourceFile), baseIndent);

  const parts = [
    ...imports.map((statement) => statement.getText(sourceFile)),
    usageNodeText,
  ];

  return parts.join("\n\n");
}

export async function captureComponentUsage(
  usage: RegistryEntry["usage"],
): Promise<CapturedComponentUsage> {
  "use cache";

  const relativePath = usage.source.replace(/^components[\\/]/, "");
  if (relativePath === usage.source || relativePath.startsWith("..")) {
    throw new Error(`Usage source must be inside components/: ${usage.source}`);
  }
  const absolutePath = path.join(process.cwd(), "components", relativePath);
  const source = await readFile(absolutePath, "utf8");

  return {
    code: extractJsxUsage(source, usage.selector, usage.source),
    language: path.extname(usage.source).slice(1),
    title: getUsageTitle(usage.selector),
  };
}
