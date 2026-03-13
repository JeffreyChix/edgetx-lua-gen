export type LuaEntityType = "function" | "constant" | "variable";

export type LuaValueType =
  | "number"
  | "string"
  | "boolean"
  | "table"
  | "function"
  | "nil"
  | "mixed"
  | "unknown"
  | string; // allows unions like "string|number"

export type ConstantGroup =
  | "font"
  | "alignment"
  | "color"
  | "playback"
  | "display"
  | "switch"
  | "input"
  | "other";

export interface LuaTableField {
  name: string;
  type: LuaValueType;
  description: string;
}

export interface LuaParam {
  name: string;
  type: LuaValueType;
  description: string;
  optional: boolean;
  validFlags: string[]; // e.g. ["BOLD", "BLINK", "LEFT"]
}

export interface LuaReturn {
  name: string;
  type: LuaValueType;
  description: string;
  fields?: LuaTableField[]; // populated when type === "table"
}

export type Availability = "COLOR_LCD" | "NON_COLOR_LCD" | "GENERAL";

export interface LuaFunction {
  entityType: "function";
  module: string;
  name: string;
  signature: string;
  description: string;
  parameters: LuaParam[];
  overloadParameters: LuaParam[];
  returns: LuaReturn[];
  notices: string[];
  status: string;
  sinceVersion: string;
  availableOn?: Availability;
  deprecated: boolean;
  sourceFile: string;
}

export interface LuaConstant {
  entityType: "constant";
  module: string;
  name: string;
  description: string;
  availableOn: Availability;
  // group: ConstantGroup;
  sourceFile: string;
}

export interface ApiDoc {
  version: string;
  generated: string;
  functions: LuaFunction[];
  constants: LuaConstant[];
}

export interface GitHubContentItem {
  name: string;
  path: string;
  url: string;
  download_url: string | null;
}

export type GitHubContentItems = GitHubContentItem[];

export type ScreenTypeSegment = {
  category: "COLOR_LCD" | "NON_COLOR_LCD" | "GENERAL";
  body: string[];
  elseBody?: string[];
};
