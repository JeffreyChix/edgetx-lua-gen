import { ConstantGroup } from "./types";

// Regex to find ALL_CAPS identifiers in text (potential flag/constant references)
// Must be at least 2 chars, can contain underscores, must start with a letter
const CAPS_WORD_RE = /\b([A-Z][A-Z0-9_]{1,})\b/g;

/**
 * Scan a description string and extract any ALL_CAPS words that look like
 * EdgeTX constants/flags (e.g. BOLD, BLINK, PLAY_NOW, COLOR_THEME_PRIMARY1).
 */
export function extractFlagReferences(description: string): string[] {
  const matches = description.match(CAPS_WORD_RE) ?? [];

  // Filter out common English acronyms / noise that aren't EdgeTX constants
  const NOISE = new Set([
    "LCD",
    "RGB",
    "GPS",
    "RTC",
    "ID",
    "OK",
    "API",
    "TX",
    "RX",
    "USB",
    "SD",
    "RC",
    "PPM",
    "PWM",
    "BW",
    "BMP",
    "PNG",
  ]);

  return [...new Set(matches)].filter((w) => !NOISE.has(w));
}

// Naming pattern → constant group mapping, checked in order
const GROUP_PATTERNS: Array<[RegExp, ConstantGroup]> = [
  [/^COLOR_|_COLOR$|COLOUR/i, "color"],
  [/^FONT_|BOLD|ITALIC|INVERS|XXS|XS_FONT|SHADOWED/i, "font"],
  [/^LEFT$|^RIGHT$|^CENTER$|^CENTRE$|ALIGN/i, "alignment"],
  [/^PLAY_|_NOW$|_BACKGROUND$|REPEAT/i, "playback"],
  [/^BLINK$|^FLASH|INVERTED/i, "display"],
  [/^SW_|SWITCH|SWITCH/i, "switch"],
  [/^INPUT|^SRC_/i, "input"],
];

/**
 * Infer a constant's group from its name using naming conventions.
 */
export function inferConstantGroup(name: string): ConstantGroup {
  for (const [pattern, group] of GROUP_PATTERNS) {
    if (pattern.test(name)) return group;
  }
  return "other";
}
