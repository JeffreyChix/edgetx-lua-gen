import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";

import { generateScriptStubs } from "./scriptsgen";
import { generateLvglStubs } from "../lvgl/gen";
import { versionGte } from "../helpers";

const TYPE_MAP: Record<string, string> = {
  nil: "nil",
  boolean: "boolean",
  number: "number",
  integer: "integer",
  string: "string",
  table: "table",
  function: "fun(...):...",
  mixed: "any",
  unknown: "any",
};

const RESERVED_NAMES = [
  "and",
  "break",
  "do",
  "else",
  "elseif",
  "end",
  "false",
  "for",
  "function",
  "goto",
  "if",
  "in",
  "local",
  "nil",
  "not",
  "or",
  "repeat",
  "return",
  "then",
  "true",
  "until",
  "while",
];

export function toLuaType(t: string): string {
  if (!t || t === "unknown") return "any";
  return t
    .split("|")
    .map((part) => TYPE_MAP[part.trim().toLowerCase()] ?? part.trim())
    .join("|");
}

export function normalizeString(str: string) {
  if (RESERVED_NAMES.includes(str)) return "_" + str;
  return str;
}

export function sanitizeDesc(desc: string): string {
  return desc.replace(/\r/g, "").replace(/--/g, "- -").trim();
}

function emitDescLines(desc: string): string[] {
  const lines: string[] = [];
  for (const line of desc.split("\n")) {
    // if (line.startsWith("```") || line.startsWith("| ")) break;
    lines.push(`--- ${line}`);
  }
  return lines;
}

/**
 * Builds a unique LuaLS class name for a table-typed return value.
 * e.g. `General_getDateTime_Return`, `Model_getMix_Return2`
 */
function makeClassName(fn: LuaFunction, returnIndex: number): string {
  const mod = fn.module.charAt(0).toUpperCase() + fn.module.slice(1);
  const suffix = fn.returns.length > 1 ? `Return${returnIndex + 1}` : "Return";
  return `${mod}_${fn.name}_${suffix}`;
}

/** Emit `---@class` blocks for any table return with known fields. */
function emitReturnClassDefs(fn: LuaFunction): string[] {
  const lines: string[] = [];

  for (let i = 0; i < fn.returns.length; i++) {
    const ret = fn.returns[i]!;
    if (ret.type !== "table" || !ret.fields?.length) continue;

    const className = makeClassName(fn, i);
    lines.push(`---@class (exact) ${className}`);

    for (const field of ret.fields) {
      const fieldType = toLuaType(field.type);
      const fieldDesc = sanitizeDesc(field.description);
      lines.push(
        fieldDesc
          ? `---@field ${field.name} ${fieldType} #${fieldDesc}`
          : `---@field ${field.name} ${fieldType}`,
      );
    }

    lines.push("");
  }

  return lines;
}

function returnTypeStr(fn: LuaFunction, ret: LuaReturn, idx: number): string {
  if (ret.type === "table" && ret.fields?.length) return makeClassName(fn, idx);
  return toLuaType(ret.type);
}

function emitParams(
  params: LuaFunction["parameters"],
  isLvglOOP = false,
): string[] {
  const lines: string[] = [];

  for (const param of params) {
    if (/[:(]/.test(param.name)) continue; // skip parser artefacts

    const paramName = normalizeString(param.name.replace(/ +/g, "_"));
    if (isLvglOOP && paramName === "parent") continue; // no parent param on lvgl OOP style
    const pType = toLuaType(param.type);
    const optMark = param.optional ? "?" : "";
    const desc = sanitizeDesc(param.description);

    const [firstLine, ...restLines] = desc.split("\n");
    lines.push(
      firstLine
        ? `---@param ${paramName}${optMark} ${pType} #${firstLine}`
        : `---@param ${paramName}${optMark} ${pType}`,
    );
    for (const l of restLines) lines.push(`--- ${l}`);

    if (param.flagHints.length > 0) {
      lines.push(`--- <br>**Flag hints:** ${param.flagHints.join(", ")}<br>`);
    }
  }

  return lines;
}

function emitReturns(fn: LuaFunction): string[] {
  if (fn.returns.length === 0) return [];
  const lines: string[] = [];

  for (let i = 0; i < fn.returns.length; i++) {
    const ret = fn.returns[i]!;
    const rType = returnTypeStr(fn, ret, i);

    const rName = normalizeString(
      ret.name?.replace(/[^a-zA-Z0-9_]/g, "_") ?? "",
    );
    const desc = sanitizeDesc(ret.description);
    const [firstLine, ...restLines] = desc.split("\n");

    const namePart = rName ? ` ${rName}` : "";
    const descPart = firstLine ? ` #${firstLine}` : "";
    lines.push(`---@return ${rType}${namePart}${descPart}`);
    for (const l of restLines) lines.push(`--- ${l}`);
  }

  return lines;
}

function emitOverloads(fn: LuaFunction): string[] {
  if (!fn.overloadParameters?.length) return [];
  const lines: string[] = [];

  const returnPart =
    fn.returns.length > 0
      ? `: ${fn.returns.map((r, i) => returnTypeStr(fn, r, i)).join(", ")}`
      : "";

  for (const param of fn.overloadParameters) {
    const paramName = normalizeString(param.name.replace(/ +/g, "_"));
    const pType = toLuaType(param.type);
    const optMark = param.optional ? "?" : "";
    const desc = sanitizeDesc(param.description);

    const [firstLine, ...restLines] = desc.split("\n");
    lines.push(
      `---@overload fun(${paramName}${optMark}: ${pType})${returnPart} ${firstLine ? `#${firstLine}` : ""}`,
    );
    for (const l of restLines) lines.push(`--- ${l}`);
    if (param.flagHints?.length) {
      lines.push(`--- **Flag hints:** ${param.flagHints.join(", ")}`);
    }
  }

  return lines;
}

export function emitFunction(
  fn: LuaFunction,
  nsPrefix: string,
  isLvglOOP = false,
): string {
  const lines: string[] = [];

  lines.push(...emitReturnClassDefs(fn));

  const desc = sanitizeDesc(fn.description);
  if (desc) {
    lines.push(...emitDescLines(desc));
    lines.push("---");
  }

  if (fn.sinceVersion) {
    lines.push(`--- **Since:** ${sanitizeDesc(fn.sinceVersion)}`);
  }

  for (const notice of fn.notices ?? []) {
    const [first, ...rest] = sanitizeDesc(notice).split("\n");
    lines.push(`--- > **Notice:** ${first}`);
    for (const l of rest) lines.push(`--- > ${l}`);
  }

  if (fn.deprecated) lines.push("---@deprecated");

  lines.push(...emitParams(fn.parameters, isLvglOOP));
  lines.push(...emitOverloads(fn));
  lines.push(...emitReturns(fn));

  const validParams = fn.parameters
    .filter((p) => !/[:(]/.test(p.name) && !(isLvglOOP && p.name === "parent"))
    .map((p) => normalizeString(p.name.replace(/ +/g, "_")))
    .join(", ");

  lines.push(`function ${nsPrefix}${fn.name}(${validParams}) end`);
  lines.push("");

  return lines.join("\n");
}

export function buildFile(header: string, body: string): string {
  return [
    "---@meta edgetx",
    "",
    "--- AUTO-GENERATED BY edgetx-lua-gen (https://github.com/JeffreyChix/edgetx-lua-gen) — DO NOT EDIT MANUALLY.",
    `--- EdgeTX Lua API stubs for lua-language-server (LuaLS)`,
    `--- ${header}`,
    "",
    body,
  ].join("\n");
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Write a namespaced module file (lcd, model, Bitmap, …). */
function writeModuleFile(
  fns: LuaFunction[],
  mod: string,
  nsName: string,
  outDir: string,
  headerDesc: string,
): { fileName: string; content: string } {
  // (exact) prevents LuaLS from allowing arbitrary field injection
  let body = `---@class (exact) ${nsName}Lib\n${nsName} = {}\n\n`;
  for (const fn of fns) body += emitFunction(fn, `${nsName}.`);

  const fileName = `edgetx.${mod}.d.lua`;

  const content = buildFile(headerDesc, body);
  const outPath = path.join(outDir, fileName);
  fs.writeFileSync(outPath, content, "utf8");
  return { fileName, content };
}

export function generateStubs(api: ApiDoc, outDir: string, version: string) {
  fs.mkdirSync(outDir, { recursive: true });
  console.log(
    `Generating stubs: ${api.functions.length} functions, ${api.constants.length} constants...`,
  );

  const generatedFiles: string[] = [];
  const hash = createHash("sha256");

  const byModule = new Map<string, LuaFunction[]>();
  for (const fn of api.functions) {
    const mod = fn.module.toLowerCase();
    const bucket = byModule.get(mod) ?? [];
    bucket.push(fn);
    byModule.set(mod, bucket);
  }

  // ── 1. Global functions ──────────────────────────────────────────────────
  {
    const fns = byModule.get("general") ?? [];
    let body = "";
    for (const fn of fns) body += emitFunction(fn, "");

    const fileName = "edgetx.globals.d.lua";
    const content = buildFile(
      "Global functions available in all EdgeTX Lua scripts",
      body,
    );

    const outPath = path.join(outDir, fileName);
    fs.writeFileSync(outPath, content, "utf8");
    hash.update(content);
    generatedFiles.push(fileName);
  }

  // ── 2–4. Known namespaced modules ────────────────────────────────────────
  const KNOWN_MODULES: Record<string, { nsName: string; desc: string }> = {
    lcd: { nsName: "lcd", desc: "lcd.* LCD drawing functions" },
    model: { nsName: "model", desc: "model.* model configuration functions" },
    bitmap: {
      nsName: "Bitmap",
      desc: "Bitmap.* bitmap manipulation functions",
    },
  };

  for (const [mod, { nsName, desc }] of Object.entries(KNOWN_MODULES)) {
    const { fileName, content } = writeModuleFile(
      byModule.get(mod) ?? [],
      mod,
      nsName,
      outDir,
      desc,
    );
    hash.update(content);
    generatedFiles.push(fileName);
  }

  // ── 5. Any unknown future modules ────────────────────────────────────────
  const handledModules = new Set(["general", ...Object.keys(KNOWN_MODULES)]);
  for (const [mod, fns] of byModule) {
    if (handledModules.has(mod)) continue;
    const nsName = titleCase(mod);
    const { fileName, content } = writeModuleFile(
      fns,
      mod,
      nsName,
      outDir,
      `${nsName}.* functions`,
    );
    hash.update(content);
    generatedFiles.push(fileName);
  }

  // ── 6. Constants ─────────────────────────────────────────────────────────
  {
    const groups = new Map<string, LuaConstant[]>();
    for (const c of api.constants) {
      const bucket = groups.get(c.module) ?? [];
      bucket.push(c);
      groups.set(c.module, bucket);
    }

    let body = "";
    for (const [groupName, consts] of groups) {
      const rule = "─".repeat(Math.max(0, 50 - groupName.length));
      body += `-- ── ${groupName} constants ${rule}\n\n`;
      for (const c of consts) {
        if (c.description) body += `--- ${sanitizeDesc(c.description)}\n`;
        // EdgeTX constants are always integers at runtime
        body += `---@type integer\n`;
        body += `${c.name} = 0\n\n`;
      }
    }

    const fileName = "edgetx.constants.d.lua";
    const content = buildFile(
      `All EdgeTX constants (${api.constants.length} total)`,
      body,
    );

    const outPath = path.join(outDir, fileName);
    fs.writeFileSync(outPath, content, "utf8");
    hash.update(content);
    generatedFiles.push(fileName);
  }

  // ── 7. Script types ─────────────────────────────────────────────────────────
  {
    const { fileName, content } = generateScriptStubs(version, outDir);
    generatedFiles.push(fileName);
    hash.update(content);
  }

  // ── 8. LVGL ─────────────────────────────────────────────────────────
  if (version !== "main" && versionGte(version, "2.11")) {
    const { fileName, content } = generateLvglStubs(api.lvgl, outDir);
    generatedFiles.push(fileName);
    hash.update(content);
  }

  return { files: generatedFiles, hash };
}

function main() {
  const args = process.argv.slice(2);
  const getArg = (flag: string, def: string): string => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1]! : def;
  };

  const inputFile = getArg("--input", "stubs/main/edgetx-lua-api.json");
  const outDir = getArg("--outDir", "stubs/main");

  if (!fs.existsSync(inputFile)) {
    console.error(`Input file not found: ${inputFile}`);
    console.error(
      `Run: npx tsx src/index.ts --out stubs/main/edgetx-lua-api.json`,
    );
    process.exit(1);
  }

  const api: ApiDoc = JSON.parse(fs.readFileSync(inputFile, "utf8"));
  generateStubs(api, outDir, "main");
}

if (require.main === module) {
  main();
}
