type EdgeTXVersion = {
  generatedAt: string;
  stubHash: string;
  sources: {
    [key: string]: string;
  };
  files: string[];
};

interface Manifest {
  manifestVersion: number;
  updatedAt: string;
  versions: {
    [key: string]: EdgeTXVersion;
  };
}

interface TagSegment {
  tag: string;
  content: string;
}

interface StubEntry {
  sources: Sources;
  stubHash: string;
  files: string[];
}

type StubManifest = Record<string, StubEntry>;

type LuaEntityType = "function" | "constant" | "variable";

type LuaValueType = string;

type ConstantGroup =
  | "font"
  | "alignment"
  | "color"
  | "playback"
  | "display"
  | "switch"
  | "input"
  | "other";

interface LuaTableField {
  name: string;
  type: LuaValueType;
  description: string;
}

interface LuaParam {
  name: string;
  type: LuaValueType;
  description: string;
  optional: boolean;
  fields?: LuaTableField[];
  flagHints: string[];
}

interface LuaReturn {
  name: string;
  type: LuaValueType;
  description: string;
  fields?: LuaTableField[]; // populated when type === "table"
}

interface TableRow {
  [header: string]: string;
}

type Availability = "COLOR_LCD" | "NON_COLOR_LCD" | "GENERAL";

interface LuaFunction {
  entityType: "function";
  module: string;
  name: string;
  signature: string | string[];
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

interface LuaConstant {
  entityType: "constant";
  module: string;
  name: string;
  description: string;
  type: "number" | "string";
  availableOn: Availability;
  sourceFile: string;
}

interface LuaClass {
  entityType: "class";
  name: string;
  fields: {
    name: string;
    type: string;
    optional: boolean;
    description: string;
    notices: string[];
    returns: LuaReturn[];
    flagHints: string[];
    sinceVersion: string;
  }[];
}

interface ApiDoc {
  version: string;
  generated: string;
  functions: LuaFunction[];
  constants: LuaConstant[];
  lvgl: {
    functions: LuaFunction[];
    constants: LuaConstant[];
    classes: LuaClass[];
  };
}

interface Source {
  name: string;
  path: string;
  url: string;
  sha: string;
  download_url: string;
}

type Sources = Source[];

type ScreenTypeSegment = {
  category: "COLOR_LCD" | "NON_COLOR_LCD" | "GENERAL";
  body: string[];
  elseBody?: string[];
};

type SourceWithContent = { content: string } & Source;

type SourceTarget = Map<string, SourceWithContent>;

type AllSources = {
  mainSources: SourceTarget;
  lvglSources: SourceTarget;
};

// --- --- -- --- ---

interface SharedTypeField {
  type: string;
  description: string;
  optional: boolean;
}

interface SharedTypeDefinition {
  description: string;
  fields: Record<string, SharedTypeField>;
}

interface ScriptField {
  optional: boolean;
  signature: string;
  description: string;
  returnSample?: string;
}

interface ScriptVersion {
  from: string;
  to: string | null; // null means latest
  fields: Record<string, ScriptField>;
}

interface ScriptTypeDefinition {
  generic?: { name: string; description: string; type: string; sample: string };
  description: string;
  notices: string[];
  versions: ScriptVersion[];
}

interface LuaClassField {
  key: string | number;
  type: string;
  description: string;
  optional?: boolean;
}

interface LuaClassDef {
  kind: "class";
  description?: string;
  fields: LuaClassField[];
}

interface LuaAliasDef {
  kind: "alias";
  description?: string;
  type?: string; // simple alias e.g. table<string, WidgetOption>
  union?: string[]; // union alias
}

type LuaStructure = LuaClassDef | LuaAliasDef;
