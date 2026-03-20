export type EdgeTXVersion = {
  generatedAt: string;
  stubHash: string;
  sources: {
    [key: string]: string;
  };
  files: string[];
};

export interface Manifest {
  manifestVersion: number;
  updatedAt: string;
  versions: {
    [key: string]: EdgeTXVersion;
  };
}

interface StubEntry {
  sources: GitHubContentItems;
  stubHash: string;
  files: string[];
}

export type StubManifest = Record<string, StubEntry>;

export type LuaEntityType = "function" | "constant";

export type LuaValueType = string;

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
  flagHints: string[]; // e.g. ["BOLD", "BLINK", "LEFT"]
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
  sha: string;
  download_url: string;
}

export type GitHubContentItems = GitHubContentItem[];

export type ScreenTypeSegment = {
  category: "COLOR_LCD" | "NON_COLOR_LCD" | "GENERAL";
  body: string[];
  elseBody?: string[];
};

// --- --- -- --- ---

export interface SharedTypeField {
  type: string;
  description: string;
  optional: boolean;
}

export interface SharedTypeDefinition {
  description: string;
  fields: Record<string, SharedTypeField>;
}

export interface ScriptField {
  optional: boolean;
  signature: string;
  description: string;
}

export interface ScriptVersion {
  from: string;
  to: string | null; // null means latest
  fields: Record<string, ScriptField>;
}

export interface ScriptTypeDefinition {
  generic?: { name: string; description: string; type: string };
  description: string;
  notices: string[];
  versions: ScriptVersion[];
}

export interface LuaClassField {
  key: string | number;
  type: string;
  description: string;
  optional?: boolean;
}

export interface LuaClassDef {
  kind: "class";
  description?: string;
  fields: LuaClassField[];
}

export interface LuaAliasDef {
  kind: "alias";
  description?: string;
  type?: string; // simple alias e.g. table<string, WidgetOption>
  union?: string[]; // union alias
}

export type LuaStructure = LuaClassDef | LuaAliasDef;
