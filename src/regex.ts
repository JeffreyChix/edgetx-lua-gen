// All MAJOR regular expressions

export const LUADOC_PATTERN = /\/\*luadoc(.*?)\*\//gs;

export const LROT_PATTERN =
  /^\s*LROT_(?:NUMENTRY|LUDENTRY)\s*\(\s*([A-Z][A-Z0-9_]*)\s*,/;

export const CURLY_PATTERN = /^\s*\{\s*"([A-Z][A-Z0-9_]*[A-Z0-9])"/;

export const LCD_FUNCTION_DEF_PATTERN = /\{\s*"(\w+)",\s*lua/;
