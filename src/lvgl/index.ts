import { parse, HTMLElement } from "node-html-parser";
import {
  cleanString,
  deduceNameAndDescriptionFromString,
  getVersionNumber,
  parseMarkdown,
  splitIntoSegmentsByPounds,
} from "../helpers";
import { parseModuleAndName, parseSignatureParams } from "../parser";
import { extractTypeFromDescription, inferParamType } from "../typeInferrer";
import { LVGL_CONSTANT_TYPE_PATTERN } from "../regex";

const LVGL_OBJECT = "Lv_obj";

const COMMON_VALUES: Record<string, string> = {
  x: "number",
  y: "number",
  w: "number",
  h: "number",
  width: "number",
  height: "number",
};

const EMPTY_RETURN_WORDS = [
  "n/a",
  "na",
  "none",
  "empty",
  "nothing",
  "no return",
];

const COMMON_SETTINGS_WORDS = ["api", "common", "settings"];
const NOT_USED_WORDS = ["not", "used"];

function cellText(td: HTMLElement): string {
  return td.innerHTML
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function parseHtmlTable(html: string): TableRow[] {
  const root = parse(html);

  const headers = root.querySelectorAll("th").map((th) => th.innerText.trim());

  return root
    .querySelectorAll("tbody tr")
    .map((tr) => {
      const cells = tr.querySelectorAll("td").map((td) => cellText(td));
      return Object.fromEntries(
        headers.map((header, i) => [header, cells[i] ?? ""]),
      ) as TableRow;
    })
    .filter((row) => Object.values(row).some((v) => v.trim()));
}

function extractTablesAndParagraphs(content: string): {
  tables: string[];
  paragraphs: string[];
} {
  const parts = content.split(/(<table[\s\S]*?<\/table>)/g).filter(Boolean);
  const result = { tables: [] as string[], paragraphs: [] as string[] };

  for (const part of parts) {
    if (part.startsWith("<table")) {
      result.tables.push(part);
    } else if (part.trim()) {
      result.paragraphs.push(part.trim());
    }
  }

  return result;
}

function extractCommonValues(str: string): string[] {
  const values = Object.keys(COMMON_VALUES).join("|");
  const regex = new RegExp(
    `'([^']+)'|(?<![a-zA-Z_])(${values})(?![a-zA-Z_])`,
    "g",
  );
  return [...str.toLowerCase().matchAll(regex)].map((m) =>
    (m[1] ?? m[2]).replace(",", "").trim(),
  );
}

function checkUnallowedSettings(paragraphs: string[]): {
  withCommonSettings: boolean;
  notAllowed: string[];
} {
  let withCommonSettings = false;
  const notAllowed: string[] = [];

  for (const paragraph of paragraphs) {
    for (const line of paragraph.split("\n")) {
      const lineLower = line.toLowerCase();

      const referencesCommonSettings = COMMON_SETTINGS_WORDS.every((w) =>
        lineLower.includes(w),
      );
      const statesNotUsed = NOT_USED_WORDS.every((w) => lineLower.includes(w));

      if (referencesCommonSettings && !statesNotUsed) {
        withCommonSettings = true;
      }

      for (const sentence of line.split(".")) {
        const sentenceLower = sentence.toLowerCase();
        if (!NOT_USED_WORDS.every((w) => sentenceLower.includes(w))) continue;
        notAllowed.push(...extractCommonValues(sentence));
      }
    }
  }

  return { withCommonSettings, notAllowed };
}

function getFnDescription(content: string) {
  const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  const fnDescription =
    frontMatterMatch?.[1]
      ?.match(/description:\s*>?-?\n?([\s\S]*?)(?=\n\w|$)/)?.[1]
      ?.replace(/\n\s+/g, " ")
      .trim() ?? "";

  return fnDescription;
}

function getParamType(paramName: string, settingsName: string): string {
  if (paramName.includes("parent")) return LVGL_OBJECT;
  if (paramName.includes("setting")) {
    const isArray = paramName.startsWith("{{");
    return `${settingsName}${isArray ? "[]" : ""}`;
  }
  return "unknown";
}

function getParamDescription(paramName: string): string {
  if (paramName.includes("parent"))
    return "Parent LGVL object. If set then whatever LVGL objects are created by the function are set as children of 'parent'. If not set then objects are created in the top level script window.";
  if (paramName.includes("setting"))
    return "Contains all of the settings required to create the LVGL object.";
  return "";
}

function getReturns(content: string): LuaReturn[] {
  const lower = content.toLowerCase();

  if (lower.includes("lvgl")) {
    return [
      { name: "LVGL Object", type: LVGL_OBJECT, description: "LVGL object" },
    ];
  }

  const commonValues = extractCommonValues(content);
  if (commonValues.length > 0) {
    return commonValues.map((v) => ({
      name: v,
      type: COMMON_VALUES[v] ?? "unknown",
      description: "",
    }));
  }

  const { name, desc } = deduceNameAndDescriptionFromString(lower);
  const { type, description } = inferParamType(name, desc);
  return [{ name, type, description }];
}

// ─── Class Builder ────────────────────────────────────────────────────────────

function buildFieldDescription(
  restOfType: string[],
  rowDescription: string,
): string {
  const parts = [restOfType.join("\n"), rowDescription].filter(Boolean);
  return parts.join("\n");
}

function buildClassTypeAndFlagHints(
  str: string[],
  constants: LuaConstant[],
): { type: string; flagHints: string[] } {
  const matches = str.join("\n").match(LVGL_CONSTANT_TYPE_PATTERN);

  if (!matches) {
    const types = str[0]
      .toLowerCase()
      .split(/\s+or\s+/i)
      .map((t) => extractTypeFromDescription(t).type);

    const hasKnownType = types.some((t) => t !== "unknown");

    return {
      type: (hasKnownType ? types.filter((t) => t !== "unknown") : types).join(
        "|",
      ),
      flagHints: [],
    };
  }

  const wildcardMatch = matches.find((m) => m.endsWith("xx"));

  const stringTypeConstants = constants
    .filter((c) => c.type === "string")
    .map((c) => `${c.module}.${c.name}`);

  if (wildcardMatch) {
    const prefix = wildcardMatch.match(/^(.*?)xx$/)?.[1];
    const { name: constantName } = parseModuleAndName(prefix!);
    const flagHints = constants
      .filter((c) => c.name.startsWith(constantName))
      .map((c) => `${c.module}.${c.name}`);

    const type = flagHints.every((f) => stringTypeConstants.includes(f))
      ? "string"
      : "number";

    return {
      type,
      flagHints,
    };
  }

  const type = matches.every((m) => stringTypeConstants.includes(m))
    ? "string"
    : "number";

  return { type, flagHints: matches };
}

function isClassFieldOptional(str: string) {
  return !/(required|mandatory)/i.test(str);
}

function getLvglClass(
  tableHtml: string,
  className: string,
  constants: LuaConstant[],
): LuaClass | null {
  try {
    const rows = parseHtmlTable(tableHtml);

    const fields: LuaClass["fields"] = rows.map((row) => {
      const nameLines = row["Name"].split("\n").filter(Boolean);
      const typeLines = row["Type"].split("\n").filter(Boolean);

      const name = nameLines[0];
      const { type, flagHints } = buildClassTypeAndFlagHints(
        typeLines,
        constants,
      );

      const description = buildFieldDescription(
        typeLines.slice(1),
        row["Description"],
      );

      const defaultValue = row["Default if not set"];

      return {
        name,
        type,
        description,
        flagHints,
        optional: isClassFieldOptional(row["Description"] ?? ""),
        sinceVersion: getVersionNumber(nameLines.slice(1).join("\n")),
        notices: defaultValue ? [`Default if not set: ${defaultValue}`] : [],
        returns: type === "function" ? getReturns(description) : [],
      };
    });

    return { entityType: "class", name: className, fields };
  } catch (error) {
    console.error(`Error parsing HTML table for class "${className}":`, error);
    return null;
  }
}

function buildFuncSettings(
  parameterContent: string,
  settingsName: string,
  commonSettings: LuaClass | null,
  lvglConstants: LuaConstant[],
): LuaClass | null {
  const { tables, paragraphs } = extractTablesAndParagraphs(parameterContent);
  if (tables.length === 0) return null;

  let funcSettings = getLvglClass(
    tables[tables.length - 1],
    settingsName,
    lvglConstants,
  );
  if (!funcSettings) return null;

  const { withCommonSettings, notAllowed } = checkUnallowedSettings(paragraphs);

  if (withCommonSettings && commonSettings) {
    const inheritedFields = commonSettings.fields.filter(
      (f) => !notAllowed.includes(f.name),
    );
    funcSettings = {
      ...funcSettings,
      fields: [...inheritedFields, ...funcSettings.fields],
    };
  }

  return funcSettings;
}

// ─── Signature & Parameter Builders ──────────────────────────────────────────

function buildParameters(signature: string, settingsName: string): LuaParam[] {
  const parsed = parseSignatureParams(`(${signature})`);
  return parsed.defaultParams.map(({ name, optional }) => ({
    name: cleanString(name),
    description: getParamDescription(name),
    type: getParamType(name, settingsName),
    flagHints: [],
    optional: name.startsWith("{") ? false : optional,
  }));
}

function buildOverloadParameters(
  rawSignature: string,
  settingsName: string,
): LuaParam[] {
  const parsed = parseSignatureParams(rawSignature);
  return parsed.defaultParams.map(({ name, optional }) => ({
    name: cleanString(name),
    optional,
    description: getParamDescription(name),
    flagHints: [],
    type: getParamType(name, settingsName),
  }));
}

function normalizeSignature(raw: string, fnName: string): string {
  return raw
    .toLowerCase()
    .replace(`lvgl.${fnName.toLowerCase()}`, "")
    .replace(/[/\\]/g, "")
    .replace(/[()]/g, "");
}

function parseLvglFunction(
  source: SourceWithContent,
  commonSettings: LuaClass | null,
  lvglConstants: LuaConstant[],
): { function: LuaFunction; settings?: LuaClass } | null {
  const segments = splitIntoSegmentsByPounds(source.content);

  const funcDefSegs = segments.filter((seg) => seg.tag.startsWith("lvgl."));
  if (!funcDefSegs.length) return null;

  const { module, name: fnName } = parseModuleAndName(
    funcDefSegs[0]!.tag.trim(),
  );
  const settingsName = `${fnName.charAt(0).toUpperCase()}${fnName.slice(1)}Settings`;

  const syntaxSegs = segments.filter(
    (seg) => seg.tag.toLowerCase() === "syntax",
  );
  const paramSegs = segments.filter(
    (seg) =>
      seg.tag.toLowerCase() === "parameters" &&
      seg.content.toLowerCase().includes("<table"),
  );
  const noteSegs = segments.filter((seg) =>
    seg.tag.toLowerCase().startsWith("note"),
  );
  const changeLogSegs = segments.filter((seg) =>
    seg.tag.toLowerCase().startsWith("change"),
  );
  const returnSegs = segments.filter((seg) =>
    seg.tag.toLowerCase().includes("return"),
  );

 
  const signatures =
    syntaxSegs[0]?.content
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((s) => s.replace(/[/\\]/g, "")) ?? [];

  if (!signatures[0]) return null;

  const mainSignatureNormalized = normalizeSignature(signatures[0], fnName);
  const parameters = buildParameters(mainSignatureNormalized, settingsName);
  const overloadParameters = buildOverloadParameters(
    signatures[1] ?? "",
    settingsName,
  );


  const validReturnSegs = returnSegs.filter((seg) =>
    EMPTY_RETURN_WORDS.every((w) => !seg.content.includes(w)),
  );
  const returns: LuaReturn[] = validReturnSegs[0]?.content
    ? getReturns(validReturnSegs[0].content)
    : [];


  const funcSettings = buildFuncSettings(
    paramSegs[0]?.content ?? "",
    settingsName,
    commonSettings,
    lvglConstants,
  );

  const func: LuaFunction = {
    entityType: "function",
    signature: signatures,
    name: fnName,
    module,
    parameters,
    description: getFnDescription(source.content),
    notices: noteSegs.map((s) => s.content.trim()),
    status: "",
    returns,
    sinceVersion: getVersionNumber(
      parseMarkdown(changeLogSegs[0]?.content ?? ""),
    ),
    deprecated: false,
    overloadParameters,
    availableOn: "COLOR_LCD",
    sourceFile: source.name,
  };

  return { function: func, ...(funcSettings && { settings: funcSettings }) };
}

function getCommonSettings(content: string): LuaClass | null {
  const { tables } = extractTablesAndParagraphs(content);
  return getLvglClass(tables[tables.length - 1], "CommonSettings", []);
}

function parseLvglConstants(content: string): LuaConstant[] {
  const constants: LuaConstant[] = [];
  const { tables } = extractTablesAndParagraphs(content);
  if (tables.length === 0) return constants;

  for (const t of tables) {
    const rows = parseHtmlTable(t);
    const _constants: LuaConstant[] = rows.map((row) => {
      const { module, name } = parseModuleAndName(row["Name"].trim());
      const description = row["Description"] ?? row["Equivalent to:"] ?? "";
      const type =
        description.startsWith('"') && description.endsWith('"')
          ? "string"
          : "number";
      return {
        name,
        module,
        availableOn: "COLOR_LCD",
        entityType: "constant",
        sourceFile: "constants.md",
        type,
        description,
      };
    });

    constants.push(..._constants);
  }

  return constants;
}

export function parseLvglSourceFile(
  source: SourceWithContent,
  commonSettings: LuaClass | null,
  lvglConstants: LuaConstant[],
): (LuaFunction | LuaConstant | LuaClass)[] {
  if (source.name === "api.md") {
    const updated = getCommonSettings(source.content);
    return updated ? [updated] : [];
  }

  if (source.name === "constants.md") {
    return parseLvglConstants(source.content);
  }

  const parsed = parseLvglFunction(source, commonSettings, lvglConstants);
  if (!parsed) return [];

  return [parsed.function, ...(parsed.settings ? [parsed.settings] : [])];
}
