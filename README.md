# EdgeTX Lua API Extractor

Parses EdgeTX C++ source files and extracts all Lua API documentation into a
single structured JSON file — suitable for use in IDE extensions, autocomplete
engines, and developer toolkits.

## What it does

- Fetches `api_general.cpp`, `api_colorlcd.cpp`, and `api_model.cpp` from the
  EdgeTX GitHub repo
- Extracts every `/*luadoc ... */` comment block (same source as the official docs)
- Scans C++ Lua registration tables for constants not in luadoc blocks
- Infers types (`number`, `string`, `boolean`, `table`, `nil`, etc.) for every
  parameter and return value
- Extracts valid flag references (e.g. `BOLD`, `BLINK`, `PLAY_NOW`) from param descriptions
- Groups constants by naming convention (`font`, `alignment`, `color`, `playback`, etc.)

## Output shape

```json
{
  "version": "main",
  "generated": "2026-02-28T...",
  "functions": [
    {
      "entityType": "function",
      "module": "lcd",
      "name": "drawText",
      "signature": "lcd.drawText(x, y, text, flags)",
      "description": "Draw text on the LCD screen",
      "parameters": [
        { "name": "x",     "type": "number", "description": "x-coordinate", "optional": false, "validFlags": [] },
        { "name": "flags", "type": "number", "description": "drawing flags", "optional": true,  "validFlags": ["BOLD", "BLINK", "LEFT", "CENTER"] }
      ],
      "returns": [
        { "name": "nil", "type": "nil", "description": "" }
      ],
      "notices": [],
      "deprecated": false,
      "sourceFile": "api_colorlcd.cpp"
    }
  ],
  "constants": [
    {
      "entityType": "constant",
      "module": "lcd",
      "name": "BOLD",
      "description": "Bold font style",
      "group": "font",
      "sourceFile": "api_colorlcd.cpp"
    }
  ]
}
```

## Setup

```bash
npm install
```

## Usage

```bash
# Fetch from GitHub and write output/edgetx-lua-api.json
npm start

# Custom output path
npx tsx src/index.ts --out path/to/my-api.json

# Parse local C++ files (no network needed)
npx tsx src/index.ts --file ./api_general.cpp --file ./api_colorlcd.cpp

# Tag the output with a specific EdgeTX version
npx tsx src/index.ts --version 2.10
```

## Project structure

```
src/
├── index.ts          # Entry point — CLI, orchestration, JSON output
├── fetcher.ts        # Downloads C++ source files from GitHub
├── parser.ts         # luadoc block extraction + C++ registration table scan
├── typeInferrer.ts   # Infers LuaValueType from param names and descriptions
├── flagLinker.ts     # Extracts ALL_CAPS flag references, infers constant groups
└── types.ts          # All TypeScript interfaces
```
