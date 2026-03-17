// EdgeTX Lua API Extractor
// Fetches EdgeTX C++ source files, parses /*luadoc */ blocks and C++ registration
// tables, and writes a single structured JSON file for use in IDE tooling.
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import util from "util";
import {
  fetchAllSources,
  fetchAllEdgeTxVersions,
  fetchConstantMarkdownSources,
} from "./fetcher";
import { parseConstantMarkdownSources, parseSourceFile } from "./parser";
import {
  ApiDoc,
  LuaFunction,
  LuaConstant,
  Availability,
  ScreenTypeSegment,
  GitHubContentItems,
  StubManifest,
} from "./types";
import {
  matchLcdFunction,
  splitIntoScreenTypeSegments,
  versionLte,
  writeManifest,
} from "./helpers";
import { generateStubs } from "./stubgen";

async function parseArgs() {
  const args = process.argv.slice(2);
  let outDir = "output";
  let versions: string[] = [];
  let withStubs = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--outDir" && args[i + 1]) {
      outDir = args[++i];
    } else if (args[i] === "--version" && args[i + 1]) {
      versions.push(args[++i]);
    } else if (args[i].toLowerCase() === "--withstubs") {
      withStubs = true;
    }
  }

  if (versions.length === 0) {
    versions.push("main"); // main is the latest branch on egdetx
  }

  const containsAllKeyword = versions.some((v) => v.toLowerCase() === "all");
  if (containsAllKeyword) {
    versions = await fetchAllEdgeTxVersions();
  }

  return { outDir, versions, withStubs };
}

function deduplicateFunctions(
  functions: LuaFunction[],
  version: string,
  v2_3LcdFunctionsSegments: ScreenTypeSegment[],
): LuaFunction[] {
  const seen = new Set<string>();
  const lcdColorNames = new Set<string>();
  const lcdNonColorNames = new Set<string>();

  if (versionLte(version, "2.3")) {
    for (const seg of v2_3LcdFunctionsSegments) {
      if (seg.category === "GENERAL") {
        for (const f of seg.body) {
          lcdColorNames.add(f);
          lcdNonColorNames.add(f);
        }
      } else if (seg.category === "COLOR_LCD") {
        for (const f of seg.body) lcdColorNames.add(f);
        for (const f of seg.elseBody ?? []) lcdNonColorNames.add(f);
      }
    }
  } else {
    // >= 2.4: colorlcd vs non-colorlcd is determined by sourceFile
    for (const f of functions) {
      if (f.module !== "lcd") continue;

      if (f.sourceFile.includes("colorlcd")) {
        lcdColorNames.add(f.name);
      } else {
        lcdNonColorNames.add(f.name);
      }
    }
  }

  const deduplicated: LuaFunction[] = [];

  for (const f of functions) {
    const key = `${f.module}::${f.name}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const availableOn = resolveAvailability(f, lcdColorNames, lcdNonColorNames);

    deduplicated.push({ ...f, ...(availableOn && { availableOn }) });
  }

  return deduplicated;
}

function resolveAvailability(
  f: LuaFunction,
  lcdColorNames: Set<string>,
  lcdNonColorNames: Set<string>,
): Availability | undefined {
  if (f.module !== "lcd") return undefined;

  const inColor = lcdColorNames.has(f.name);
  const inNonColor = lcdNonColorNames.has(f.name);

  if (inColor && inNonColor) return "GENERAL";
  if (inColor) return "COLOR_LCD";
  return "NON_COLOR_LCD";
}

function deduplicateConstants(constants: LuaConstant[]): LuaConstant[] {
  const seen = new Set<string>();
  return constants.filter((c) => {
    if (seen.has(c.name)) return false;
    seen.add(c.name);
    return true;
  });
}

async function main() {
  const { outDir: outputDirectory, versions, withStubs } = await parseArgs();

  const stubManifest: StubManifest = {};

  for (const version of versions) {
    const allFunctions: LuaFunction[] = [];
    const allConstants: LuaConstant[] = [];

    let v2_3LcdFunctionsSegments: ScreenTypeSegment[] = [];

    console.log("Fetching C++ source files from GitHub...");
    const sources = await fetchAllSources(version);

    if (sources.size === 0) {
      console.error("No source files were loaded. Exiting.");
      process.exit(1);
    }

    // --- Parse each source file ---
    for (const [sourceFile, { content, ...source }] of sources) {
      console.log(`\nParsing: ${sourceFile}`);
      const { functions, constants } = parseSourceFile(
        content,
        sourceFile,
        version,
      );

      if (versionLte(version, "2.3") && sourceFile === "api_lcd.cpp") {
        v2_3LcdFunctionsSegments = splitIntoScreenTypeSegments(
          content,
          matchLcdFunction,
        );
      }
      allFunctions.push(...functions);
      allConstants.push(...constants);

      if (!stubManifest[version]) {
        stubManifest[version] = { sources: [], stubHash: "", files: [] };
      }

      stubManifest[version].sources.push(source);
    }

    const functions = deduplicateFunctions(
      allFunctions,
      version,
      v2_3LcdFunctionsSegments,
    );
    const constants = deduplicateConstants(allConstants);

    // get constants' descriptions from lua-reference-guide/lua-api-reference/constants md files
    const constantSources = await fetchConstantMarkdownSources(version);
    const fromMdConstants = await parseConstantMarkdownSources(constantSources);

    const constantsWithDescriptions = constants.map((c) => ({
      ...c,
      description: fromMdConstants[c.name] ?? "",
    }));

    const apiDoc: ApiDoc = {
      version,
      generated: new Date().toISOString(),
      functions,
      constants: constantsWithDescriptions,
    };

    const outDir = path.join(outputDirectory, version);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    const outFile = path.join(outDir, "edgetx-lua-api.json");

    fs.writeFileSync(outFile, JSON.stringify(apiDoc, null, 2), "utf-8");

    console.log("\n✅ Done");
    console.log(`   Functions : ${functions.length}`);
    console.log(`   Constants : ${constants.length}`);
    console.log(`   Output    : ${path.resolve(outFile)}`);

    if (withStubs) {
      const { files, stubHash } = generateStubs(
        apiDoc,
        path.join(outDir, "stubs"),
      );

      stubManifest[version].stubHash = stubHash;
      stubManifest[version].files = [...files, "edgetx-lua-api.json"];
    }
  }

  writeManifest(stubManifest);

  console.log(util.inspect(stubManifest, true));

  console.log("\n✅ Done");
  console.log(`   Versions generated : ${versions.length}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
