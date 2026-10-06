/**
 * External navigation guard (static source scan).
 *
 * Every `target="_blank"` anchor in shipped source must carry a `rel`
 * attribute (`noopener`/`noreferrer`) so a newly opened page can never
 * reach back via `window.opener` (reverse tabnabbing).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = resolve(import.meta.dirname, "..");
const EXCLUDED_DIRS = new Set(["test", "node_modules", "dist"]);
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

function listSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry)) continue;
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...listSourceFiles(full));
    } else if (EXTENSIONS.has(extname(full))) {
      files.push(full);
    }
  }
  return files;
}

function blankTargetsWithoutRel(source: string): string[] {
  const offenders: string[] = [];
  const tagRe = /<[a-zA-Z][^<>]*>/g;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(source)) !== null) {
    const tag = match[0];
    if (/target\s*=\s*"_blank"/.test(tag) && !/rel\s*=/.test(tag)) {
      offenders.push(tag.slice(0, 80));
    }
  }
  return offenders;
}

describe("external navigation hardening", () => {
  it("every target=_blank anchor carries a rel attribute", () => {
    const offenders: string[] = [];
    for (const file of listSourceFiles(SRC)) {
      const bad = blankTargetsWithoutRel(readFileSync(file, "utf8"));
      for (const tag of bad) offenders.push(`${file} :: ${tag}`);
    }
    expect(offenders).toEqual([]);
  });

  it("at least one external anchor exists so the scan is meaningful", () => {
    let count = 0;
    for (const file of listSourceFiles(SRC)) {
      const source = readFileSync(file, "utf8");
      const matches = source.match(/target\s*=\s*"_blank"/g);
      if (matches) count += matches.length;
    }
    expect(count).toBeGreaterThan(0);
  });
});
