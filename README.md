# EdgeTX Lua API Extractor

Parses EdgeTX C++ source files and extracts the full Lua API into a structured
JSON file — suitable for use in IDE extensions, autocomplete engines, stub
generators, and developer toolkits.

---

## What it does

- Fetches all the `api_` files such as `api_general.cpp`, `api_filesystem.cpp`, `api_colorlcd.cpp`, and `api_model.cpp` from the EdgeTX GitHub repo 
- Extracts every `/*luadoc ... */` comment block — the same source as the
  official EdgeTX documentation
- Scans C++ Lua registration tables for constants not covered by luadoc blocks
- Infers types (`number`, `string`, `boolean`, `table`, `nil`, etc.) for every
  parameter and return value
- Extracts flag hints (e.g. `BOLD`, `BLINK`, `PLAY_NOW`) from parameter descriptions
- Tracks `availableOn` per function and constant: `GENERAL`, `COLOR_LCD`, or
  `NON_COLOR_LCD`
- Optionally generates `.d.lua` stub files for the Lua Language Server (LuaLS)
  in the same run

---

## Output shape

Each run produces a versioned JSON file with two top-level arrays: `functions`
and `constants`.

```json
{
  "version": "main",
  "generated": "2026-03-14T11:16:11.396Z",
  "functions": [
    {
      "entityType": "function",
      "module": "lcd",
      "name": "drawPoint",
      "signature": "lcd.drawPoint(x, y, [flags])",
      "description": "Draw a single pixel at (x,y) position",
      "parameters": [
        {
          "name": "x",
          "type": "number",
          "description": "(positive number) x position",
          "optional": false,
          "flagHints": []
        },
        {
          "name": "y",
          "type": "number",
          "description": "(positive number) y position",
          "optional": false,
          "flagHints": []
        },
        {
          "name": "flags",
          "type": "number",
          "description": "(optional) drawing flags",
          "optional": true,
          "flagHints": []
        }
      ],
      "overloadParameters": [],
      "returns": [],
      "notices": [
        "Taranis has an LCD display width of 212 pixels and height of 64 pixels."
      ],
      "status": "current Introduced in 2.0.0",
      "sinceVersion": "2.0.0",
      "deprecated": false,
      "sourceFile": "api_colorlcd.cpp",
      "availableOn": "GENERAL"
    }
  ],
  "constants": [
    {
      "entityType": "constant",
      "name": "COLOR_THEME_PRIMARY1",
      "module": "lcd",
      "description": "Theme color. Can be changed with lcd.setColor(color_index, color).",
      "sourceFile": "api_colorlcd.cpp",
      "availableOn": "COLOR_LCD"
    }
  ]
}
```

### Field reference

#### Function fields

| Field                | Type                                          | Description                                                                  |
| -------------------- | --------------------------------------------- | ---------------------------------------------------------------------------- |
| `entityType`         | `"function"`                                  | Always `"function"`                                                          |
| `module`             | `string`                                      | Lua namespace: `"general"`, `"lcd"`, `"model"`, `"Bitmap"`                   |
| `name`               | `string`                                      | Function name                                                                |
| `signature`          | `string`                                      | Full human-readable signature from luadoc                                    |
| `description`        | `string`                                      | Doc comment body                                                             |
| `parameters`         | `LuaParam[]`                                  | Ordered list of parameters (see below)                                       |
| `overloadParameters` | `LuaParam[]`                                  | Alternate parameter list for overloaded signatures (e.g. `rgb` vs `r, g, b`) |
| `returns`            | `LuaReturn[]`                                 | Return values — empty array means void                                       |
| `notices`            | `string[]`                                    | Warning or notice blocks from luadoc                                         |
| `status`             | `string`                                      | Raw status string from luadoc (e.g. `"current Introduced in 2.0.0"`)         |
| `sinceVersion`       | `string`                                      | Parsed version string, e.g. `"2.0.0"`                                        |
| `deprecated`         | `boolean`                                     | `true` if marked deprecated in luadoc                                        |
| `sourceFile`         | `string`                                      | Origin C++ file                                                              |
| `availableOn`        | `"GENERAL" \| "COLOR_LCD" \| "NON_COLOR_LCD"` | Screen type availability                                                     |

#### Parameter fields (`LuaParam`)

| Field         | Type       | Description                                                                                                         |
| ------------- | ---------- | ------------------------------------------------------------------------------------------------------------------- |
| `name`        | `string`   | Parameter name                                                                                                      |
| `type`        | `string`   | Inferred type: `number`, `string`, `boolean`, `table`, `nil`, etc.                                                  |
| `description` | `string`   | Inline doc description                                                                                              |
| `optional`    | `boolean`  | Whether the parameter is optional                                                                                   |
| `flagHints`   | `string[]` | ALL_CAPS flag/constant references parsed from the description. Non-exhaustive — treat as hints, not a complete list |

#### Constant fields

| Field         | Type                                          | Description                |
| ------------- | --------------------------------------------- | -------------------------- |
| `entityType`  | `"constant"`                                  | Always `"constant"`        |
| `name`        | `string`                                      | Constant name, e.g. `BOLD` |
| `module`      | `string`                                      | Lua namespace              |
| `description` | `string`                                      | Doc comment if available   |
| `sourceFile`  | `string`                                      | Origin C++ file            |
| `availableOn` | `"GENERAL" \| "COLOR_LCD" \| "NON_COLOR_LCD"` | Screen type availability   |

---

## Setup

```bash
npm install
```

---

## Usage

### Basic

```bash
# Fetch latest from GitHub (main branch) and write to output/
npm start

# Equivalent explicit form
npx tsx src/index.ts
```

### Options

```bash
# Fetch a specific EdgeTX version
npx tsx src/index.ts --version 2.4

# Fetch ALL tagged versions (produces one JSON file per version under output/)
npx tsx src/index.ts --version ALL

# Custom output directory (default: output/)
npx tsx src/index.ts --outDir ./my-output

# Also generate .d.lua stubs for the Lua Language Server after JSON extraction
npx tsx src/index.ts --withStubs

# Combine options
npx tsx src/index.ts --version 2.10 --outDir ./releases/2.10 --withStubs
```

### CLI flags

| Flag              | Default  | Description                                                               |
| ----------------- | -------- | ------------------------------------------------------------------------- |
| `--version <ver>` | `main`   | EdgeTX version to fetch. Use `ALL` or `all` to fetch every tagged release |
| `--outDir <path>` | `output` | Directory to write JSON (and stubs if `--withStubs`)                      |
| `--withStubs`     | off      | Generate `.d.lua` stubs immediately after JSON extraction                 |

---

## Stub generation

Stubs can be generated in two ways:

### 1. As part of extraction (`--withStubs`)

```bash
npx tsx src/index.ts --withStubs
```

Stubs are written alongside the JSON under `--outDir`.

### 2. Standalone from an existing JSON

```bash
npx tsx src/stubgen.ts --input output/main/edgetx-lua-api.json --outDir ./stubs
```

| Flag              | Default                           | Description                            |
| ----------------- | --------------------------------- | -------------------------------------- |
| `--input <path>`  | `output/main/edgetx-lua-api.json` | Path to an existing API JSON file      |
| `--outDir <path>` | `stubs`                           | Directory to write `.d.lua` stub files |

The stub generator produces one file per module:

```
stubs/
├── edgetx.globals.lua    # Global functions (module == "general")
├── edgetx.lcd.lua        # lcd.* namespace
├── edgetx.model.lua      # model.* namespace
├── edgetx.Bitmap.lua     # Bitmap.* namespace
└── edgetx.constants.lua  # All constants
```

Each file uses LuaLS [LuaCATS annotations](https://luals.github.io/wiki/annotations/)
(`---@param`, `---@return`, `---@overload`, `---@class`, `---@deprecated`, etc.)
for full IntelliSense support.

---

## Project structure

```
src/
├── index.ts          # Entry point — CLI, orchestration, JSON output
├── fetcher.ts        # Downloads C++ source files from GitHub
├── parser.ts         # luadoc block extraction + C++ registration table scan
├── typeInferrer.ts   # Infers LuaValueType from param names and descriptions
├── flagLinker.ts     # Extracts ALL_CAPS flag references from param descriptions
├── stubgen.ts        # Generates .d.lua stub files from the API JSON
└── types.ts          # All TypeScript interfaces
```
