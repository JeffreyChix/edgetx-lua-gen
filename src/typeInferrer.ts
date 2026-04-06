// Known param names that reliably map to a type.
// NOTE: These are only used as a FALLBACK when the description has no explicit
// type hint. Description-based inference runs first and takes priority now.
const PARAM_NAME_TYPE_MAP: Record<string, LuaValueType> = {
  flags: "number",
  flag: "number",
  x: "number",
  y: "number",
  w: "number",
  h: "number",
  width: "number",
  height: "number",
  radius: "number",
  value: "number", // check this
  idx: "number",
  index: "number",
  channel: "number",
  color: "number",
  thickness: "number",
  start: "number",
  text: "string",
  title: "string",
  name: "string",
  filename: "string",
  file: "string",
  pattern: "number",
};

// Maps a single type keyword to a canonical LuaValueType
function mapSingleTypeName(name: string): LuaValueType | null {
  const map: Record<string, LuaValueType> = {
    number: "number",
    num: "number",
    integer: "number",
    int: "number",
    string: "string",
    str: "string",
    boolean: "boolean",
    bool: "boolean",
    table: "table",
    function: "function",
    nil: "nil",
    mixed: "mixed",
  };
  return map[name.toLowerCase()] ?? null;
}

export function extractTypeFromDescription(
  raw: string,
  name?: string,
): {
  type: LuaValueType;
  description: string;
} {
  const trimmed = raw.trim();

  // --- Edge cases
  if (
    name &&
    ["table", "function", "number", "boolean", "string"].includes(
      name.toLowerCase(),
    )
  )
    return { type: name.toLowerCase(), description: trimmed };

  if (name && name.toLowerCase().includes("index"))
    return { type: "number", description: trimmed };

  // if (name && name.startsWith("is"))
  //   return { type: "boolean", description: trimmed };

  // Step 1: collect all explicit bracketed type hints: (number), (string), etc.
  const bracketedTypes: string[] = [];
  const bracketRe =
    /\((number|num|numbers|string|str|text|boolean|bool|int|integer|integers|table|function|nil)\)/gi;
  for (const m of trimmed.matchAll(bracketRe)) {
    const mapped = mapSingleTypeName(m[1]!);
    if (mapped && !bracketedTypes.includes(mapped)) bracketedTypes.push(mapped);
  }

  if (bracketedTypes.length > 0) {
    // Strip a leading bracketed type hint for a cleaner description
    const leadingBracket = trimmed.match(
      /^\((?:number|num|numbers|string|str|text|boolean|bool|int|integer|integers|table|function|nil)\)\s*/i,
    );
    const description = leadingBracket
      ? trimmed.slice(leadingBracket[0].length).trim()
      : trimmed;
    return { type: bracketedTypes.join("|"), description };
  }

  // Step 2: keyword scan in the description body (order matters — check boolean before string)
  const keywordPatterns: Array<[RegExp, LuaValueType]> = [
    [/true\/false|true or false|\btrue\b|\bfalse\b|\bboolean\b/i, "boolean"],
    [
      /\bnumber\b|\binteger\b|\bcolor\b|\bnum\b|\bint\b|\bnumbers\b|\bintegers\b|\bintergers\b|\bindex\b/i,
      "number",
    ],
    [/\bstring\b|\btext\b|\bstr\b/i, "string"],
    [/\btable\b/i, "table"],
    [/\bfunction\b/i, "function"],
    [/\bnil\b/i, "nil"],
  ];

  const keywordMatches: LuaValueType[] = [];
  for (const [pattern, type] of keywordPatterns) {
    if (pattern.test(trimmed) && !keywordMatches.includes(type)) {
      keywordMatches.push(type);
    }
  }

  if (keywordMatches.length > 0) {
    return { type: keywordMatches.join("|"), description: trimmed };
  }

  return { type: "unknown", description: trimmed };
}

/**
 * Infer parameter type.
 * Priority: description-based inference first (catches explicit type hints and
 * union types), then fall back to name-based heuristics.
 */
export function inferParamType(
  paramName: string,
  description: string,
): { type: LuaValueType; description: string } {
  const nameLower = paramName.toLowerCase();

  if (nameLower in PARAM_NAME_TYPE_MAP) {
    return {
      type: PARAM_NAME_TYPE_MAP[nameLower]!,
      description: description.trim(),
    };
  }

  const fromDesc = extractTypeFromDescription(description, paramName);
  if (fromDesc.type !== "unknown") return fromDesc;

  return { type: "unknown", description: description.trim() };
}

/**
 * Infer return value type from its name and description.
 * "nil" as the retval name is a strong signal.
 */
export function inferReturnType(
  retvalName: string,
  description: string,
): { type: LuaValueType; description: string } {
  const retvalNameLower = retvalName.toLowerCase();
  if (retvalNameLower === "nil") {
    return { type: "nil", description: description.trim() };
  }
  if (retvalNameLower in PARAM_NAME_TYPE_MAP) {
    return {
      type: PARAM_NAME_TYPE_MAP[retvalNameLower]!,
      description: description.trim(),
    };
  }

  return extractTypeFromDescription(description, retvalName);
}

export function inferModuleFromFile(sourceFile: string): string {
  if (sourceFile.includes("lcd")) return "lcd";
  if (sourceFile.includes("model")) return "model";
  return "general";
}

export function isOptional(description: string): boolean {
  if (/required|\[required\]/i.test(description)) return false;
  return /optional|\[optional\]|or nil|if nil|can be nil/i.test(description);
}

export function isDeprecated(notices: string[]): boolean {
  return notices.some((n) => /deprecated|do not use|obsolete/i.test(n));
}
