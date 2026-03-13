import {
  LuaFunction,
  LuaConstant,
  LuaParam,
  LuaReturn,
  LuaTableField,
  GitHubContentItems,
  Availability,
  ScreenTypeSegment,
} from "./types";
import {
  inferParamType,
  inferReturnType,
  isOptional,
  isDeprecated,
  extractTypeFromDescription,
  inferModuleFromFile,
} from "./typeInferrer";
import { extractFlagReferences } from "./flagLinker";
import {
  getVersionNumber,
  findWord,
  cleanString,
  deduceNameAndDescriptionFromString,
  versionGte,
  versionLte,
  matchConstant,
  parseMarkdown,
  getColorInfo,
  splitIntoScreenTypeSegments,
} from "./helpers";
import { LUADOC_PATTERN } from "./regex";
import { fetchSourceFile } from "./fetcher";

export function extractLuadocBlocks(source: string): string[] {
  const blocks: string[] = [];
  for (const match of source.matchAll(LUADOC_PATTERN)) {
    blocks.push(match[1]!);
  }
  return blocks;
}

// ---------------------------------------------------------------------------
// Tag block splitter  (fix #2)
//
// Splits a raw luadoc block into an array of tagged segments. Each segment is:
//   { tag: "function" | "param" | "retval" | "notice" | "status" | "text",
//     content: string }
//
// Rules:
//  - A tag line starts with @word (at any column after optional whitespace)
//  - Everything after @word on that line AND on subsequent lines that do NOT
//    start a new tag belongs to that tag's content.
//  - Lines that start with # / ## / ### (markdown headings) terminate a block.
//  - Everything before the first @tag is "text" (preamble — rare but possible).
// ---------------------------------------------------------------------------

interface TagSegment {
  tag: string;
  content: string;
}

function splitIntoTagSegments(doc: string): TagSegment[] {
  const lines = doc.split("\n");
  const segments: TagSegment[] = [];
  const functionTags = ["function", "name"]; // eg: @function, @name;

  let currentTag: string | null = null;
  let currentLines: string[] = [];

  const flush = () => {
    if (currentTag !== null) {
      segments.push({
        tag: currentTag,
        content: currentLines.join("\n").trim(),
      });
    } else if (currentLines.some((l) => l.trim())) {
      segments.push({ tag: "text", content: currentLines.join("\n").trim() });
    }
    currentLines = [];
  };

  for (const line of lines) {
    const stripped = line.replace(/^\s*\*\s?/, ""); // strip leading " * " from C block comments

    if (/^#{1,3}\s/.test(stripped)) {
      flush();
      currentTag = "text";
      currentLines = [stripped];
      continue;
    }

    const tagMatch = stripped.match(/^@(\w+)(.*)/);
    if (tagMatch) {
      flush();
      currentTag = tagMatch[1]!.toLowerCase();
      const rest = tagMatch[2]!.trim();
      currentLines = rest ? [rest] : [];
      if (functionTags.includes(currentTag)) {
        flush();
      }
      continue;
    }

    if (currentTag && functionTags.includes(currentTag)) {
      currentTag = null;
    }

    currentLines.push(stripped);
  }

  flush();
  return segments;
}

// --- parseConstants
function makeLuaConstant(
  name: string,
  availableOn: Availability,
  sourceFileName: string,
): LuaConstant {
  return {
    entityType: "constant",
    availableOn,
    description: "",
    sourceFile: sourceFileName,
    name,
    module: inferModuleFromFile(sourceFileName),
  };
}

type Partition = {
  colorOnly: string[];
  nonColorOnly: string[];
  general: string[];
};

function partitionByAvailability(
  colorBody: string[],
  nonColorBody: string[],
): Partition {
  return {
    colorOnly: colorBody.filter((n) => !nonColorBody.includes(n)),
    nonColorOnly: nonColorBody.filter((n) => !colorBody.includes(n)),
    general: colorBody.filter((n) => nonColorBody.includes(n)),
  };
}

function constantsFromPartition(
  partition: Partition,
  sourceFileName: string,
): LuaConstant[] {
  return [
    ...partition.general.map((n) =>
      makeLuaConstant(n, "GENERAL", sourceFileName),
    ),
    ...partition.colorOnly.map((n) =>
      makeLuaConstant(n, "COLOR_LCD", sourceFileName),
    ),
    ...partition.nonColorOnly.map((n) =>
      makeLuaConstant(n, "NON_COLOR_LCD", sourceFileName),
    ),
  ];
}

function parseConstants(
  constantSegments: ScreenTypeSegment[],
  sourceFileName: string,
): LuaConstant[] {
  const byCategory = {
    COLOR_LCD: constantSegments.filter((s) => s.category === "COLOR_LCD"),
    NON_COLOR_LCD: constantSegments.filter(
      (s) => s.category === "NON_COLOR_LCD",
    ),
    GENERAL: constantSegments.filter((s) => s.category === "GENERAL"),
  };

  const constants: LuaConstant[] = [];

  // COLOR_LCD segments: body = color side, elseBody = non-color side
  for (const seg of byCategory.COLOR_LCD) {
    const elseBody = seg.elseBody ?? [];
    constants.push(
      ...constantsFromPartition(
        partitionByAvailability(seg.body, elseBody),
        sourceFileName,
      ),
    );
  }

  // NON_COLOR_LCD segments: body = non-color side, elseBody = color side
  for (const seg of byCategory.NON_COLOR_LCD) {
    const elseBody = seg.elseBody ?? [];
    constants.push(
      ...constantsFromPartition(
        partitionByAvailability(elseBody, seg.body),
        sourceFileName,
      ),
    );
  }

  // GENERAL segments: no conditional branching, everything is available everywhere
  for (const seg of byCategory.GENERAL) {
    constants.push(
      ...seg.body.map((n) => makeLuaConstant(n, "GENERAL", sourceFileName)),
    );
  }

  return constants;
}

// ---------------------------------------------------------------------------
// Signature parser
//
// Parses "loadScript(file [, mode] [, env])" into:
//   [
//     { name: "file",  optional: false },
//     { name: "mode",  optional: true  },
//     { name: "env",   optional: true  },
//   ]
// Rules:
//   - Strip everything before and including "("
//   - Everything inside [...] is optional
//   - Split by comma, trim brackets and whitespace from each name
// ---------------------------------------------------------------------------

interface SigParam {
  name: string;
  optional: boolean;
}

const IMPLICITLY_OPTIONAL_PARAMS = new Set(["flag", "flags"]);

function parseSignatureParams(signature: string): {
  overloadParams: string[];
  defaultParams: SigParam[];
} {
  const parenStart = signature.indexOf("(");
  const parenEnd = signature.lastIndexOf(")");
  if (parenStart === -1) return { overloadParams: [], defaultParams: [] };

  let inner = (
    parenEnd !== -1
      ? signature.slice(parenStart + 1, parenEnd)
      : signature.slice(parenStart + 1)
  ).trim();

  if (!inner) return { overloadParams: [], defaultParams: [] };

  // Extract overload alternate param e.g. "r, g, b | rgb" → overload: "rgb"
  const overloadParams: string[] = [];
  const overloadMatch = inner.match(/\|\s*(\w+)/);
  if (overloadMatch) {
    inner = inner.slice(0, overloadMatch.index).trim();
    overloadParams.push(overloadMatch[1]);
  }

  // Split required and optional portions on first "["
  const sqBrIndex = inner.indexOf("[");
  const requiredRaw =
    sqBrIndex === -1 ? inner : inner.slice(0, sqBrIndex).trim();
  const optionalRaw = sqBrIndex === -1 ? "" : inner.slice(sqBrIndex).trim();

  const requiredParams: SigParam[] = requiredRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => ({
      name,
      optional: IMPLICITLY_OPTIONAL_PARAMS.has(name.toLowerCase()),
    }));

  const optionalParams: SigParam[] = optionalRaw
    .replace(/[\[\]]/g, "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => ({ name, optional: true }));

  return {
    overloadParams,
    defaultParams: [...requiredParams, ...optionalParams],
  };
}

// ---------------------------------------------------------------------------
// Table structure parser  (fix #5)
//
// Parses the body of a @retval table description like:
//   "table custom function data:\n * `switch` (number) switch index\n * ..."
// into an array of LuaTableField.
// ---------------------------------------------------------------------------

function parseTableFields(description: string): LuaTableField[] {
  const fields: LuaTableField[] = [];

  // Each field line looks like:  * `name` (type) description
  // or:                          `name` (type) description
  // The backtick-wrapped name is mandatory; type in parens is optional.
  const fieldRe = /^\s*\*?\s*`([^`]+)`\s*(.*)/gm;

  for (const m of description.matchAll(fieldRe)) {
    const fieldName = m[1]!.trim();
    const rest = m[2]!.trim();
    const { type, description: fieldDesc } = extractTypeFromDescription(rest);
    fields.push({ name: fieldName, type, description: fieldDesc });
  }

  return fields;
}

// ---------------------------------------------------------------------------
// Table structure parser for @name functions
//
// Found in @returndesc and between hyphens. Eg: table keys - name (string), max (int) and allow (bool) -
// ---
function parseTableFieldsForAtNameFunctions(
  description: string,
): LuaTableField[] {
  // --- Grab the section between the dashes
  const keysSection = description.match(/-(.*)-/)?.[1] ?? "";

  if (keysSection.length === 0) return [];

  const keys = keysSection.trim().split(/\s*,\s*|\s+and\s+/); // split by commas and conjuctions like 'and'

  return keys.map((key) => {
    const firstSpace = key.search(/\s/);

    return {
      name: firstSpace === -1 ? key : key.slice(0, firstSpace),
      type: extractTypeFromDescription(key).type,
      description: key,
    };
  });
}

function parseModuleAndName(signature: string): {
  module: string;
  name: string;
} {
  const baseName = signature.split("(")[0]!.trim();
  const dotIdx = baseName.indexOf(".");
  if (dotIdx !== -1) {
    return {
      module: baseName.slice(0, dotIdx),
      name: baseName.slice(dotIdx + 1),
    };
  }
  return { module: "general", name: baseName };
}

export function parseLuadocBlock(
  raw: string,
  sourceFile: string,
): LuaFunction | null {
  const segments = splitIntoTagSegments(raw);

  // Detect content type from first real @tag
  const firstTag = segments.find((s) => s.tag !== "text");
  if (!firstTag) return null;

  if (firstTag.tag === "function") {
    return parseFunctionBlock(segments, sourceFile);
  }

  // Edge case: In newer edgetx versions,
  // some function definitions in luadocs use the @name tag */
  if (firstTag.tag === "name") {
    return parseAtNameFunctionBlock(segments, sourceFile);
  }

  console.warn(
    `  Unknown luadoc content type: @${firstTag.tag} in ${sourceFile}`,
  );
  return null;
}

// ---------------------------------------------------------------------------
// Function block parser: @function
// ---------------------------------------------------------------------------

function parseFunctionBlock(
  segments: TagSegment[],
  sourceFile: string,
): LuaFunction | null {
  try {
    const funcSegs = segments.filter((s) => s.tag === "function");
    const paramSegs = segments.filter((s) => s.tag === "param");
    const retvalSegs = segments.filter((s) => s.tag === "retval");
    const noticeSegs = segments.filter((s) => s.tag === "notice");
    const statusSegs = segments.filter((s) => s.tag === "status");
    const textSegs = segments.filter((s) => s.tag === "text");

    if (funcSegs.length === 0) return null;

    const signature = funcSegs[0]!.content.split("\n")[0]!.trim();
    const { module, name } = parseModuleAndName(signature);

    const { defaultParams: sigParams, overloadParams } =
      parseSignatureParams(signature);
    const overloadParameters: LuaParam[] = [];

    // Build params from @params segs
    const paramDocMap = new Map<string, string>();
    for (const seg of paramSegs) {
      // First word of content is the param name
      const firstSpace = seg.content.search(/\s/);
      if (firstSpace === -1) {
        paramDocMap.set(cleanString(seg.content.trim()), "");
      } else {
        const { name: pName, desc: pDesc } = deduceNameAndDescriptionFromString(
          seg.content,
        );

        // --- Edge case: split two or more params on one line separated by commas. E.g x,y,h (positive numbers)
        const pNames = pName
          .split(",")
          .filter(Boolean)
          .map((i) => i.trim());
        if (pNames.length > 1) {
          for (const p of pNames) {
            paramDocMap.set(p, pDesc);
          }
        } else {
          paramDocMap.set(pName, pDesc);
        }
      }
    }

    // --- Build parameters ---
    // Use sigParams as the authoritative list (order + optionality).
    // If a sigParam has no matching @param tag, use the name-only fallback.
    // If @param tags exist that aren't in the signature and the overload params, append them.
    const usedParamNames = new Set<string>();

    const parameters: LuaParam[] = sigParams.map((sp) => {
      usedParamNames.add(sp.name);
      const rawDesc = paramDocMap.get(sp.name) ?? "";
      const { type, description: cleanDesc } = inferParamType(sp.name, rawDesc);
      return {
        name: sp.name,
        type,
        description: cleanDesc,
        optional: sp.optional !== undefined ? sp.optional : isOptional(rawDesc),
        validFlags: extractFlagReferences(rawDesc),
      };
    });

    // Append any @param tags whose names weren't in the signature and make them optional
    for (const [pName, rawDesc] of paramDocMap) {
      if (!usedParamNames.has(pName) && !overloadParams.includes(pName)) {
        const { type, description: cleanDesc } = inferParamType(pName, rawDesc);
        parameters.push({
          name: pName,
          type,
          description: cleanDesc,
          optional: true,
          validFlags: extractFlagReferences(rawDesc),
        });
      }
    }

    // Build overload parameters
    for (const ovp of overloadParams) {
      const ovpRawDesc = paramDocMap.get(ovp) ?? "";
      const { type, description: cleanDesc } = inferParamType(ovp, ovpRawDesc);
      overloadParameters.push({
        name: ovp,
        type,
        description: cleanDesc,
        optional: false,
        validFlags: extractFlagReferences(ovpRawDesc),
      });
    }

    const returns: LuaReturn[] = retvalSegs
      .filter((seg) => seg.content.trim() !== "none")
      // --- Cover edge case: two return values on one line. E.g w,h (positive numbers)
      .reduce((prev, curr) => {
        const { name, desc } = deduceNameAndDescriptionFromString(curr.content);
        const newReturnSegs: TagSegment[] = [];
        const retNames = name
          .split(",")
          .filter(Boolean)
          .map((i) => i.trim());

        if (retNames.length > 1) {
          for (const n of retNames) {
            newReturnSegs.push({ tag: "retval", content: n + " " + desc });
          }
        } else {
          newReturnSegs.push(curr);
        }
        return [...prev, ...newReturnSegs];
      }, [] as TagSegment[])
      .map((seg) => {
        const { name: retName, desc: rawDesc } =
          deduceNameAndDescriptionFromString(seg.content);

        const { type, description: cleanDesc } = inferReturnType(
          retName,
          rawDesc,
        );

        let fields: LuaTableField[] | undefined;
        if (type === "table") {
          const parsed = parseTableFields(rawDesc);
          if (parsed.length > 0) fields = parsed;
        }

        const retval: LuaReturn = {
          name: retName,
          type,
          description: cleanDesc,
        };
        if (fields) retval.fields = fields;
        return retval;
      });

    const description = textSegs
      .map((s) => s.content)
      .join("\n")
      .trim();

    const notices = noticeSegs.map((s) => s.content.trim());
    const status = statusSegs
      .map((s) => s.content.trim())
      .join(" ")
      .trim();

    return {
      entityType: "function",
      module,
      name,
      signature,
      description,
      parameters,
      overloadParameters,
      returns,
      notices,
      status,
      sinceVersion: getVersionNumber(status),
      deprecated: isDeprecated(notices),
      sourceFile,
    };
  } catch (err) {
    console.error(
      `  Failed to parse function block: ${(err as Error).message}`,
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Function block parser: @name
// ---------------------------------------------------------------------------

function parseAtNameFunctionBlock(
  segments: TagSegment[],
  sourceFile: string,
): LuaFunction | null {
  try {
    const functionNameSegs = segments.filter((s) => s.tag === "name");
    const descSegs = segments.filter((s) => s.tag === "description");
    const syntaxSegs = segments.filter((s) => s.tag === "syntax");
    const argSegs = segments.filter((s) => s.tag === "arg");
    const argDescSegs = segments.filter((s) => s.tag === "argdesc");
    const returnSegs = segments.filter((s) => s.tag === "return");
    const returnDescSegs = segments.filter((s) => s.tag === "returndesc");
    const statusSegs = segments.filter(
      (s) => s.tag === "apistat" || s.tag === "status",
    );
    const notesSegs = segments.filter(
      (s) => s.tag === "notes" || s.tag === "notice",
    );
    // const targetSegs = segments.filter((s) => s.tag === "target");

    if (functionNameSegs.length === 0) return null;

    let signature = functionNameSegs[0]!.content.split("\n")[0]!.trim();
    if (syntaxSegs.length > 0) {
      const syntax = syntaxSegs[0].content.trim();
      signature = syntax;

      if (syntax.search(/\=/) !== -1) {
        signature = syntax.split("=")[1].trim();
      }
    }

    const { module, name } = parseModuleAndName(signature);

    const { defaultParams: sigParams } = parseSignatureParams(signature);
    const argsAndDesc = argSegs.reduce(
      (prev, curr, currIndex) => {
        return {
          ...prev,
          [curr.content]: argDescSegs[currIndex].content ?? "",
        };
      },
      {} as Record<string, string>,
    );

    const parameters: LuaParam[] = sigParams.map((param) => {
      const foundArg = Object.entries(argsAndDesc).flatMap(([key]) =>
        findWord(key, param.name).map((match) => ({
          key,
          value: argsAndDesc[key],
          ...match,
        })),
      );

      const cleanedParamName = cleanString(param.name);

      if (foundArg.length === 0) {
        return {
          name: cleanedParamName,
          description: "",
          optional: true,
          type: "unknown",
          validFlags: [],
        };
      }

      const { type } = inferParamType(cleanedParamName, foundArg[0].others);

      return {
        name: cleanedParamName,
        description: foundArg[0].value,
        optional: isOptional(foundArg[0].others),
        type,
        validFlags: [],
      };
    });

    const returns: LuaReturn[] = returnSegs
      .filter((seg) => seg.content.trim() !== "none")
      .map((seg, index) => {
        const name = cleanString(seg.content.trim());
        const { type } = inferReturnType(name, name);
        const description = returnDescSegs[index].content ?? "";

        let fields: LuaTableField[] | undefined;
        if (type === "table") {
          const parsed = parseTableFieldsForAtNameFunctions(description);
          if (parsed.length > 0) fields = parsed;
        }

        const retval: LuaReturn = { name, type, description };

        if (fields) retval.fields = fields;

        return retval;
      });

    const notices = notesSegs.map((s) => s.content.trim());
    const status = statusSegs
      .map((s) => s.content.trim())
      .join(" ")
      .trim();

    return {
      entityType: "function",
      module,
      name,
      signature,
      description: descSegs[0]?.content ?? "",
      parameters,
      overloadParameters: [],
      returns,
      notices,
      status,
      sinceVersion: getVersionNumber(status),
      deprecated: isDeprecated(notices),
      sourceFile,
    };
  } catch (err) {
    console.error(
      `  Failed to parse function block: ${(err as Error).message}`,
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Full source file parser
// ---------------------------------------------------------------------------

export function parseSourceFile(
  source: string,
  sourceFile: string,
  version: string,
): { functions: LuaFunction[]; constants: LuaConstant[] } {
  const functions: LuaFunction[] = [];

  // 1. Parse all luadoc blocks
  const blocks = extractLuadocBlocks(source);
  console.log(`  Found ${blocks.length} luadoc blocks`);

  for (const block of blocks) {
    const result = parseLuadocBlock(block, sourceFile);
    if (!result) continue;

    if (result.entityType === "function") {
      functions.push(result);
    }
  }

  // 2. Scan {} and LROT_NUMENTRY / LROT_LUDENTRY macros for constants
  let constants: LuaConstant[] = [];
  if (
    versionGte(version, "2.11") ||
    (versionLte(version, "2.10") && sourceFile === "api_general.cpp")
  ) {
    const defaultCategory: ScreenTypeSegment["category"] = sourceFile.includes(
      "color",
    )
      ? "COLOR_LCD"
      : "GENERAL";

    const constantSegments = splitIntoScreenTypeSegments(
      source,
      matchConstant,
      defaultCategory,
    );

    constants = parseConstants(constantSegments, sourceFile);
  }

  console.log(
    `  → ${functions.length} functions, ${constants.length} constants`,
  );

  return {
    functions,
    constants,
  };
}

export async function parseConstantMarkdownSources(
  constantSources: GitHubContentItems,
) {
  const constantsWithDescriptions: Record<string, string> = {};

  for (const source of constantSources) {
    if (!source.download_url) continue;

    const content = await fetchSourceFile(source.download_url);
    const parsedContent = parseMarkdown(content);
    const lines = parsedContent.split("\n");

    for (const line of lines) {
      const cleaned = line
        .replace(/\\_/g, "_")
        .replace(/^\s*\*\s*/, "")
        .trim();

      const constantMatch = cleaned.match(/\b([A-Z][A-Z0-9_]{3,})\b/);
      if (!constantMatch) continue;

      const constant = constantMatch[0];

      // description is everything else on the line, with pipes and extra whitespace cleaned up
      const description = cleaned
        .replace(constant, "")
        .replace(/(^|\s)\|(\s|$)/g, "$1$2")
        // .replace(/^\s*\|\s*/gm, " ") // leading |
        // .replace(/\s*\|\s*$/gm, " ") // trailing |
        // .replace(/(^|\s)\|(\s|$)/g, "$1.$2") // middle |
        .replace(/-&gt;/g, "→")
        .replace(/\*\*/g, "")
        .trim();

      if (constant && !constantsWithDescriptions[constant]) {
        constantsWithDescriptions[constant] = mendConstantDescription(
          constant,
          description ?? "",
        );
      }
    }
  }
  return constantsWithDescriptions;
}

function mendConstantDescription(constant: string, description: string) {
  if (constant.startsWith("UNIT")) {
    // UNIT_ constants' descriptions contain some table row numbers.
    return description.replace(/\d+/g, "").trim();
  }

  if (
    (constant.startsWith("COLOR_") || constant.endsWith("_COLOR")) &&
    description.length === 0
  ) {
    return "Theme color. They can be changed with the function lcd.setColor(color_index, color). Please note: if an indexed color is changed, then it changes everywhere that it is used. For the theme colors, this is not only in other widgets, but everywhere throughout the radio's user interface!";
  }

  const color = getColorInfo(constant);

  if (color.isColor) {
    return color.desc;
  }

  return description;
}
