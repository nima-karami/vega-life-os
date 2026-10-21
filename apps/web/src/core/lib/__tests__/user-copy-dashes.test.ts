import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const WEB_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const SCANNED_ROOTS = [path.join(WEB_ROOT, "src"), path.join(WEB_ROOT, "..", "server", "src")];

const DASH = /[–—]/;
const DASH_ENTITY = /&(mdash|ndash|#8211|#8212|#x201[34]);/i;

const COPY_KINDS = new Set([
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle,
  ts.SyntaxKind.TemplateTail,
  ts.SyntaxKind.JsxText,
]);

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory())
      return entry.name === "__tests__" || entry.name === "node_modules"
        ? []
        : listSourceFiles(fullPath);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [fullPath] : [];
  });
}

function hasDash(node: ts.LiteralLikeNode, sourceFile: ts.SourceFile): boolean {
  const raw = node.getText(sourceFile);
  return DASH.test(node.text) || DASH.test(raw) || DASH_ENTITY.test(raw);
}

// Comments are trivia, not nodes, so walking the AST sees only copy that can reach a screen.
function findDashedCopy(filePath: string): string[] {
  const source = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);
  const offenders: string[] = [];
  const visit = (node: ts.Node) => {
    if (COPY_KINDS.has(node.kind) && hasDash(node as ts.LiteralLikeNode, sourceFile)) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      offenders.push(
        `${path.relative(WEB_ROOT, filePath)}:${line + 1}  ${node.getText(sourceFile).trim()}`,
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return offenders;
}

describe("user-facing copy", () => {
  it("carries no em or en dashes in strings, templates or JSX text", () => {
    const offenders = SCANNED_ROOTS.flatMap(listSourceFiles).flatMap(findDashedCopy);
    expect(offenders).toEqual([]);
  });
});
