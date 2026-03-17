import fs from "fs";
import tinycolor from "tinycolor2";

import { CURLY_PATTERN, LCD_FUNCTION_DEF_PATTERN, LROT_PATTERN } from "./regex";
import { Manifest, ScreenTypeSegment, StubManifest } from "./types";

export function fetcher(url: string) {
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
}
export function getVersionNumber(status: string): string {
  return status.match(/\d+(?:\.\d+)+/)?.[0] ?? "";
}

export function findWord(
  str: string,
  target: string,
): Array<{ found: string; position: number; others: string }> {
  const regex = new RegExp(`\\b${target}\\b`, "g");
  return [...str.matchAll(regex)].map((match) => ({
    found: target,
    position: match.index,
    others: (str.slice(0, match.index) + str.slice(match.index + target.length))
      .trim()
      .replace(/\s+/g, " "),
  }));
}

export function cleanString(str: string) {
  return str.replace(/[^a-zA-Z0-9_ ,]/g, "");
}

export function deduceNameAndDescriptionFromString(str: string) {
  const firstSpace = str.search(/\s/);
  let name: string;
  let desc: string;

  if (firstSpace === -1) {
    name = cleanString(str.trim());
    desc = "";
  } else {
    name = cleanString(str.slice(0, firstSpace).trim());
    desc = str.slice(firstSpace).trim();
  }

  return { name, desc };
}

export function parseVersion(v: string): [number, number] {
  if (v === "main") return [Infinity, Infinity];
  const [major, minor] = v.split(".").map(Number);
  return [major, minor];
}

export function versionGte(v: string, min: string): boolean {
  const [maj, min_] = parseVersion(v);
  const [minMaj, minMin] = parseVersion(min);
  if (maj !== minMaj) return maj > minMaj;
  return min_ >= minMin;
}

export function versionLte(v: string, min: string): boolean {
  const [maj, min_] = parseVersion(v);
  const [minMaj, minMin] = parseVersion(min);
  if (maj !== minMaj) return maj < minMaj;
  return min_ <= minMin;
}

export function matchConstant(line: string): string | null {
  return LROT_PATTERN.exec(line)?.[1] ?? CURLY_PATTERN.exec(line)?.[1] ?? null;
}

export function matchLcdFunction(line: string): string | null {
  return LCD_FUNCTION_DEF_PATTERN.exec(line)?.[1] ?? null;
}

/**
 * Parse MD content and flatten HTML tables into single lines
 */
export function parseMarkdown(markdown: string) {
  return (
    markdown
      // Remove table, thead, tbody tags (keep content)
      .replace(/<table>|<\/table>|<thead>|<\/thead>|<tbody>|<\/tbody>/g, "")
      // Convert each <tr>...</tr> into a single pipe-separated line
      .replace(/<tr>(.*?)<\/tr>/gs, (_, row) => {
        const cells = [...row.matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/gs)]
          .map((m) => m[1].trim())
          .join(" | ");
        return cells + "\n";
      })
      // Strip only actual HTML tags (not math/comparison operators like < x or > b)
      .replace(/<[a-zA-Z\/][^>]*>/g, "")
      .trim()
  );
}

export function getColorInfo(name: string) {
  const color = tinycolor(name.toLowerCase());
  return {
    isColor: color.isValid(),
    desc: `${name} | RGB: ${color.toRgbString()} | Is Light: ${color.isLight()} | Is Dark: ${color.isDark()}`,
  };
}

export function splitIntoScreenTypeSegments(
  source: string,
  regexMatcher: (line: string) => string | null,
  defaultCategory: ScreenTypeSegment["category"] = "GENERAL",
): ScreenTypeSegment[] {
  const lines = source.split("\n");
  const firstMatchIndex = lines.findIndex(
    (line) => regexMatcher(line) !== null,
  );
  if (firstMatchIndex === -1) return [];

  const segments: ScreenTypeSegment[] = [];
  let current: ScreenTypeSegment | null = null;
  let inElse = false;

  const flush = () => {
    const hasContent =
      current &&
      (current.body.length > 0 || (current.elseBody?.length ?? 0) > 0);
    if (hasContent) segments.push(current!);
    current = null;
    inElse = false;
  };

  // Start one line before the first match to catch any leading `#if` directive
  for (let i = firstMatchIndex - 1; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith("#if defined(COLORLCD)")) {
      flush();
      current = { category: "COLOR_LCD", body: [] };
      inElse = false;
    } else if (line.includes("!defined(COLORLCD)")) {
      flush();
      current = { category: "NON_COLOR_LCD", body: [] };
      inElse = false;
    } else if (line === "#else") {
      if (current) {
        current.elseBody = [];
        inElse = true;
      }
    } else if (line === "#endif") {
      flush();
    } else {
      const value = regexMatcher(line);
      if (!value) continue;

      if (!current) current = { category: defaultCategory, body: [] };
      (inElse ? current.elseBody! : current.body).push(value);
    }
  }

  flush();
  return segments;
}

export function readAndParseManifest() {
  try {
    const data = fs.readFileSync("manifest.json", "utf-8");
    return JSON.parse(data) as Manifest;
  } catch (err) {
    console.error("  Error reading and parsing manifest", err);
    return null;
  }
}

export function writeManifest(stubManifest: StubManifest) {
  const versions = Object.fromEntries(
    Object.entries(stubManifest).map(([version, entry]) => [
      version,
      {
        generatedAt: new Date().toISOString(),
        stubHash: entry.stubHash,
        files: entry.files,
        sources: Object.fromEntries(
          entry.sources.map((source) => [source.path, source.sha]),
        ),
      },
    ]),
  );

  const manifest: Manifest = {
    manifestVersion: 1,
    updatedAt: new Date().toISOString(),
    versions,
  };

  fs.writeFileSync("manifest.json", JSON.stringify(manifest, null, 2), "utf-8");
}
