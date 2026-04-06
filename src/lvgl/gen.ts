import * as fs from "fs";
import * as path from "path";

import { buildFile, emitFunction, sanitizeDesc, toLuaType } from "../stub-gen";

const LVGL_OBJECT = "lv_obj";

function emitLvglClasses() {
  return `---@class (exact) Lv_obj\nlocal ${LVGL_OBJECT} = {}\n\n---@class (exact) Lvgl\nlvgl = {}\n\n`;
}

function emitConstants(constants: LuaConstant[]): string {
  const lines: string[] = ["--- Lvgl Constants", ""];

  for (const constant of constants) {
    const descLines = sanitizeDesc(constant.description).split("\n");
    for (const l of descLines) lines.push(`--- ${l}`);
    lines.push(`---@type ${constant.type}`);
    lines.push(
      `${constant.module}.${constant.name} = ${constant.type === "number" ? 0 : (descLines[0] ?? "")}`,
    );
    lines.push("");
  }

  return lines.join("\n");
}

function emitClasses(classes: LuaClass[]): string {
  const lines: string[] = [];

  for (const cls of classes) {
    lines.push(`--- Lvgl ${cls.name}`);
    lines.push(`---@class (exact) ${cls.name}`);

    for (const field of cls.fields) {
      let fieldType = toLuaType(field.type);
      const optionalMark = field.optional ? "?" : "";

      if (field.type === "function" && field.returns.length) {
        const hasUnknown = field.returns.some((r) => r.type === "unknown");
        fieldType = `fun(...): ${hasUnknown ? "..." : field.returns.map((r) => toLuaType(r.type)).join(",")}`;
      }

      const [firstLine, ...restLines] = sanitizeDesc(field.description).split(
        "\n",
      );
      lines.push(
        firstLine
          ? `---@field ${field.name}${optionalMark} ${fieldType} #${firstLine}`
          : `---@field ${field.name}${optionalMark} ${fieldType}`,
      );
      for (const l of restLines) lines.push(`--- ${l}`);

      if (field.flagHints.length) {
        lines.push(`--- > **Flag hints:** ${field.flagHints.join(", ")}`);
      }

      if (field.sinceVersion) {
        lines.push(`--- **Since:** ${sanitizeDesc(field.sinceVersion)}`);
      }

      for (const notice of field.notices) {
        const [first, ...rest] = sanitizeDesc(notice).split("\n");
        lines.push(`--- > **Notice:** ${first}`);
        for (const l of rest) lines.push(`--- > ${l}`);
      }
    }

    lines.push("", "");
  }

  return lines.join("\n");
}

export function generateLvglStubs(lvgl: ApiDoc["lvgl"], outDir: string) {
  let body = emitLvglClasses();

  body += emitConstants(lvgl.constants);

  body += emitClasses(lvgl.classes);

  for (const fn of lvgl.functions) {
    body += emitFunction(fn, `${fn.module}.`);
    body += emitFunction(fn, `${LVGL_OBJECT}:`, true);
  }

  const fileName = "edgetx.lvgl.d.lua";
  const content = buildFile("All Lvgl apis", body);

  const outPath = path.join(outDir, fileName);
  fs.writeFileSync(outPath, content, "utf8");

  return { fileName, content };
}
