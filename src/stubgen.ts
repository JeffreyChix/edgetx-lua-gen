/**
 * stubgen.ts
 *
 * Reads the EdgeTX Lua API JSON (produced by index.ts) and emits a set of
 * lua-language-server (sumneko) annotation files (.lua) that give VS Code
 * full intellisense: hover docs, parameter hints, return types, and
 * constant completion.
 *
 * Output layout (all under --outDir, default ./stubs/):
 *
 *   edgetx.globals.lua    – global functions (module == "general")
 *   edgetx.lcd.lua        – lcd.* namespace
 *   edgetx.model.lua      – model.* namespace
 *   edgetx.Bitmap.lua     – Bitmap.* namespace
 *   edgetx.constants.lua  – all constants as typed globals
 *
 * Usage:
 *   npx tsx src/stubgen.ts [--input edgetx-lua-api.json] [--outDir ./stubs]
 */

import * as fs from "fs";
import * as path from "path";

// ─── Types (matches types.ts output) ─────────────────────────────────────────

interface TableField {
  name: string;
  type: string;
  description: string;
}

interface LuaParam {
  name: string;
  type: string;
  description: string;
  optional: boolean;
  validFlags: string[];
}

interface LuaReturn {
  name: string;
  type: string;
  description: string;
  fields?: TableField[];
}

interface LuaFunction {
  entityType: "function";
  module: string;
  name: string;
  signature: string;
  description: string;
  parameters: LuaParam[];
  returns: LuaReturn[];
  notices: string[];
  status: string;
  deprecated: boolean;
  sourceFile: string;
}

interface LuaConstant {
  entityType: "constant";
  module: string;
  name: string;
  description: string;
  group: string;
  sourceFile: string;
}

interface ApiDoc {
  version: string;
  generated: string;
  functions: LuaFunction[];
  constants: LuaConstant[];
}

// ─── LuaLS type mapping ───────────────────────────────────────────────────────
// Converts our internal type strings to valid LuaLS annotation types.
// Union types like "string|number" pass through unchanged — LuaLS supports them.

function toLuaType(t: string): string {
  if (!t || t === "unknown") return "any";
  // Map individual parts of a union
  return t
    .split("|")
    .map((part) => {
      const p = part.trim().toLowerCase();
      if (p === "nil") return "nil";
      if (p === "boolean") return "boolean";
      if (p === "number") return "number";
      if (p === "string") return "string";
      if (p === "table") return "table";
      if (p === "function") return "fun()";
      if (p === "mixed") return "any";
      if (p === "unknown") return "any";
      return part.trim(); // preserve as-is (e.g. user-defined class names)
    })
    .join("|");
}

// ─── Text helpers ─────────────────────────────────────────────────────────────

/** Wrap text to at most maxWidth characters per line, indent subsequent lines. */
function wrapText(text: string, indent: string, maxWidth = 100): string {
  // Preserve existing line breaks
  const lines = text.split("\n");
  const result: string[] = [];
  for (const line of lines) {
    if (line.length + indent.length <= maxWidth) {
      result.push(indent + line);
      continue;
    }
    // Hard-wrap long lines at word boundaries
    const words = line.split(" ");
    let current = indent;
    for (const word of words) {
      if (current.length + word.length + 1 > maxWidth && current.trim() !== "") {
        result.push(current.trimEnd());
        current = indent + word + " ";
      } else {
        current += word + " ";
      }
    }
    if (current.trim()) result.push(current.trimEnd());
  }
  return result.join("\n");
}

/** Escape special characters in description text for use in Lua comments. */
function sanitizeDesc(desc: string): string {
  return desc
    .replace(/\r/g, "")
    .replace(/--/g, "- -") // avoid Lua comment terminators
    .trim();
}

// ─── Class name generator for table return types ──────────────────────────────

/**
 * When a function returns a table with known fields, we emit a ---@class
 * definition so LuaLS shows field completion on the return value.
 *
 * Class name:  ModuleName_FunctionName_Return[N]
 * e.g.  general_getDateTime_Return, model_getMix_Return
 */
function makeClassName(fn: LuaFunction, returnIndex: number): string {
  const mod = fn.module.charAt(0).toUpperCase() + fn.module.slice(1);
  const suffix = fn.returns.length > 1 ? `Return${returnIndex + 1}` : "Return";
  return `${mod}_${fn.name}_${suffix}`;
}

// ─── Code-gen helpers ─────────────────────────────────────────────────────────

/** Emit ---@class blocks for all table returns with known fields. */
function emitClassDefs(fn: LuaFunction): string {
  const out: string[] = [];
  for (let i = 0; i < fn.returns.length; i++) {
    const ret = fn.returns[i]!;
    if (ret.type !== "table" || !ret.fields || ret.fields.length === 0) continue;

    const className = makeClassName(fn, i);
    out.push(`---@class ${className}`);
    for (const field of ret.fields) {
      const fieldType = toLuaType(field.type);
      const fieldDesc = sanitizeDesc(field.description);
      if (fieldDesc) {
        out.push(`---@field ${field.name} ${fieldType} ${fieldDesc}`);
      } else {
        out.push(`---@field ${field.name} ${fieldType}`);
      }
    }
    out.push("");
  }
  return out.join("\n");
}

/** Determine the LuaLS return type string for a single LuaReturn entry. */
function returnTypeStr(fn: LuaFunction, ret: LuaReturn, retIdx: number): string {
  if (ret.type === "table" && ret.fields && ret.fields.length > 0) {
    return makeClassName(fn, retIdx);
  }
  return toLuaType(ret.type);
}

/** Emit the full annotation block + stub for a single function. */
function emitFunction(fn: LuaFunction, nsPrefix: string): string {
  const lines: string[] = [];

  // ── class definitions for table return types ──
  const classDefs = emitClassDefs(fn);
  if (classDefs) lines.push(classDefs);

  // ── doc comment ──────────────────────────────
  // Description
  const desc = sanitizeDesc(fn.description);
  if (desc) {
    const descLines = desc.split("\n");
    // First line(s) — trim markdown code fences for brevity
    for (const dl of descLines) {
      if (dl.startsWith("```")) break; // stop before code blocks
      if (dl.startsWith("| ")) break;  // stop before markdown tables
      lines.push(`--- ${dl}`);
    }
    lines.push("---");
  }

  // Status / version
  if (fn.status) {
    const cleanStatus = sanitizeDesc(fn.status)
      .split("\n")[0]! // first line only
      .replace(/^current\s*/i, "")
      .trim();
    if (cleanStatus) lines.push(`--- **Status:** ${cleanStatus}`);
  }

  // Notices
  for (const notice of fn.notices) {
    const n = sanitizeDesc(notice).split("\n")[0]!;
    lines.push(`--- **Notice:** ${n}`);
  }

  // Deprecated
  if (fn.deprecated) {
    lines.push("---@deprecated");
  }

  // Parameters
  for (const param of fn.parameters) {
    // Skip malformed param names that contain ':' or '(' (parser artefacts)
    if (/[:(]/.test(param.name)) continue;

    const pType = toLuaType(param.type);
    const pDesc = sanitizeDesc(param.description).split("\n")[0]!;
    const optMark = param.optional ? "?" : "";

    // validFlags hint
    const flagHint =
      param.validFlags.length > 0
        ? ` (flags: ${param.validFlags.join(", ")})`
        : "";

    if (pDesc || flagHint) {
      lines.push(`---@param ${param.name}${optMark} ${pType} ${pDesc}${flagHint}`);
    } else {
      lines.push(`---@param ${param.name}${optMark} ${pType}`);
    }
  }

  // Return values
  if (fn.returns.length === 0) {
    // no explicit return — omit @return (void is implied)
  } else if (fn.returns.length === 1) {
    const ret = fn.returns[0]!;
    const rType = returnTypeStr(fn, ret, 0);
    const rDesc = sanitizeDesc(ret.description).split("\n")[0]!;
    if (rDesc) {
      lines.push(`---@return ${rType} # ${rDesc}`);
    } else {
      lines.push(`---@return ${rType}`);
    }
  } else {
    // Multiple return values: emit one @return per value
    for (let i = 0; i < fn.returns.length; i++) {
      const ret = fn.returns[i]!;
      const rType = returnTypeStr(fn, ret, i);
      const rName = ret.name.replace(/[^a-zA-Z0-9_]/g, "_"); // sanitize for LuaLS
      const rDesc = sanitizeDesc(ret.description).split("\n")[0]!;
      if (rDesc) {
        lines.push(`---@return ${rType} ${rName} ${rDesc}`);
      } else {
        lines.push(`---@return ${rType} ${rName}`);
      }
    }
  }

  // ── function stub ────────────────────────────
  // Build the param list from the LuaParam array (skip malformed names)
  const validParams = fn.parameters.filter((p) => !/[:(]/.test(p.name));
  const paramList = validParams.map((p) => p.name).join(", ");

  lines.push(`function ${nsPrefix}${fn.name}(${paramList}) end`);
  lines.push("");

  return lines.join("\n");
}

// ─── File writer ──────────────────────────────────────────────────────────────

interface FileSpec {
  filename: string;
  header: string;
  body: string;
}

function buildFile(spec: FileSpec): string {
  return [
    "-- This file is AUTO-GENERATED by stubgen.ts — do not edit manually.",
    `-- EdgeTX Lua API stubs for lua-language-server (sumneko)`,
    `-- ${spec.header}`,
    "",
    spec.body,
  ].join("\n");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  // Parse CLI args
  const args = process.argv.slice(2);
  const getArg = (flag: string, def: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1]! : def;
  };

  const inputFile = getArg("--input", "output/edgetx-lua-api.json");
  const outDir = getArg("--outDir", "stubs");

  if (!fs.existsSync(inputFile)) {
    console.error(`Input file not found: ${inputFile}`);
    console.error(
      `Run the extractor first: npx tsx src/index.ts --out output/edgetx-lua-api.json`
    );
    process.exit(1);
  }

  const api: ApiDoc = JSON.parse(fs.readFileSync(inputFile, "utf8"));
  fs.mkdirSync(outDir, { recursive: true });

  console.log(
    `Generating stubs from ${api.functions.length} functions and ${api.constants.length} constants...`
  );

  // ── Group functions by module ─────────────────────────────────────────────
  const byModule = new Map<string, LuaFunction[]>();
  for (const fn of api.functions) {
    const mod = fn.module.toLowerCase();
    if (!byModule.has(mod)) byModule.set(mod, []);
    byModule.get(mod)!.push(fn);
  }

  // ── 1. Global functions (module == "general") ─────────────────────────────
  {
    const fns = byModule.get("general") ?? [];
    let body = "";
    for (const fn of fns) {
      body += emitFunction(fn, ""); // no namespace prefix
    }
    const content = buildFile({
      filename: "edgetx.globals.lua",
      header: "Global functions available in all EdgeTX Lua scripts",
      body,
    });
    const outPath = path.join(outDir, "edgetx.globals.lua");
    fs.writeFileSync(outPath, content, "utf8");
    console.log(`  Wrote ${outPath}  (${fns.length} functions)`);
  }

  // ── 2. lcd.* namespace ────────────────────────────────────────────────────
  {
    const fns = byModule.get("lcd") ?? [];
    let body = "---@class lcdLib\nlcd = {}\n\n";
    for (const fn of fns) {
      body += emitFunction(fn, "lcd.");
    }
    const content = buildFile({
      filename: "edgetx.lcd.lua",
      header: "lcd.* LCD drawing functions",
      body,
    });
    const outPath = path.join(outDir, "edgetx.lcd.lua");
    fs.writeFileSync(outPath, content, "utf8");
    console.log(`  Wrote ${outPath}  (${fns.length} functions)`);
  }

  // ── 3. model.* namespace ──────────────────────────────────────────────────
  {
    const fns = byModule.get("model") ?? [];
    let body = "---@class modelLib\nmodel = {}\n\n";
    for (const fn of fns) {
      body += emitFunction(fn, "model.");
    }
    const content = buildFile({
      filename: "edgetx.model.lua",
      header: "model.* model configuration functions",
      body,
    });
    const outPath = path.join(outDir, "edgetx.model.lua");
    fs.writeFileSync(outPath, content, "utf8");
    console.log(`  Wrote ${outPath}  (${fns.length} functions)`);
  }

  // ── 4. Bitmap.* namespace ─────────────────────────────────────────────────
  {
    const fns = byModule.get("bitmap") ?? [];
    let body = "---@class BitmapLib\nBitmap = {}\n\n";
    for (const fn of fns) {
      body += emitFunction(fn, "Bitmap.");
    }
    const content = buildFile({
      filename: "edgetx.Bitmap.lua",
      header: "Bitmap.* bitmap manipulation functions",
      body,
    });
    const outPath = path.join(outDir, "edgetx.Bitmap.lua");
    fs.writeFileSync(outPath, content, "utf8");
    console.log(`  Wrote ${outPath}  (${fns.length} functions)`);
  }

  // ── 5. Any other modules (future-proofing) ────────────────────────────────
  const knownModules = new Set(["general", "lcd", "model", "bitmap"]);
  for (const [mod, fns] of byModule) {
    if (knownModules.has(mod)) continue;
    const ns = mod.charAt(0).toUpperCase() + mod.slice(1);
    let body = `---@class ${ns}Lib\n${ns} = {}\n\n`;
    for (const fn of fns) {
      body += emitFunction(fn, `${ns}.`);
    }
    const content = buildFile({
      filename: `edgetx.${mod}.lua`,
      header: `${ns}.* functions`,
      body,
    });
    const outPath = path.join(outDir, `edgetx.${mod}.lua`);
    fs.writeFileSync(outPath, content, "utf8");
    console.log(`  Wrote ${outPath}  (${fns.length} functions)`);
  }

  // ── 6. Constants ──────────────────────────────────────────────────────────
  {
    // Group by source module for a clean header comment
    const groups = new Map<string, LuaConstant[]>();
    for (const c of api.constants) {
      const g = c.module;
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(c);
    }

    let body = "";
    for (const [groupName, consts] of groups) {
      body += `-- ── ${groupName} constants ${"─".repeat(Math.max(0, 50 - groupName.length))}\n\n`;
      for (const c of consts) {
        if (c.description) {
          body += `--- ${sanitizeDesc(c.description)}\n`;
        }
        // All EdgeTX constants are integers at runtime
        body += `---@type number\n`;
        body += `${c.name} = 0\n\n`;
      }
    }

    const content = buildFile({
      filename: "edgetx.constants.lua",
      header: `All EdgeTX constants (${api.constants.length} total)`,
      body,
    });
    const outPath = path.join(outDir, "edgetx.constants.lua");
    fs.writeFileSync(outPath, content, "utf8");
    console.log(`  Wrote ${outPath}  (${api.constants.length} constants)`);
  }

  // ── 7. .luarc.json helper ─────────────────────────────────────────────────
  {
    const luarc = {
      $schema:
        "https://raw.githubusercontent.com/LuaLS/lua-language-server/master/meta/schemas/luarc.schema.json",
      workspace: {
        library: [outDir],
        checkThirdParty: false,
      },
      runtime: {
        version: "Lua 5.2",
      },
      diagnostics: {
        globals: ["lcd", "model", "Bitmap"],
      },
    };
    const outPath = path.join(outDir, ".luarc.json");
    fs.writeFileSync(outPath, JSON.stringify(luarc, null, 2), "utf8");
    console.log(`  Wrote ${outPath}`);
  }

  console.log(`\nDone! Add this to your project's .luarc.json workspace.library:\n`);
  console.log(`  "${path.resolve(outDir)}"\n`);
}

main();