// Handcrafted — not auto-generated. Update this when EdgeTX docs change.
import type {
  LuaStructure,
  ScriptTypeDefinition,
  SharedTypeDefinition,
} from "./types";

export const sharedTypes: Record<string, SharedTypeDefinition> = {
  TouchState: {
    description:
      "Touch event state passed to scripts on color LCD radios\n `nil` if `event` is not a touch event. This can be used to test if we have a touch event or a key event.",
    fields: {
      x: {
        type: "number",
        description: "Current touch point\nPresent for all touch events.",
        optional: false,
      },
      y: {
        type: "number",
        description: "Current touch point\nPresent for all touch events.",
        optional: false,
      },
      startX: {
        type: "number",
        description:
          "Point where slide started\nOnly present with `EVT_TOUCH_SLIDE`",
        optional: true,
      },
      startY: {
        type: "number",
        description:
          "Point where slide started\nOnly present with `EVT_TOUCH_SLIDE`",
        optional: true,
      },
      slideX: {
        type: "number",
        description:
          "Movement since previous SLIDE event (or start of slide)\nOnly present with `EVT_TOUCH_SLIDE`",
        optional: true,
      },
      slideY: {
        type: "number",
        description:
          "Movement since previous SLIDE event (or start of slide)\nOnly present with `EVT_TOUCH_SLIDE`",
        optional: true,
      },
      swipeUp: {
        type: "boolean",
        description:
          "The field is present and equal to true if a swipe event occurred in that direction\nMay be present only with `EVT_TOUCH_SLIDE`",
        optional: true,
      },
      swipeDown: {
        type: "boolean",
        description:
          "The field is present and equal to true if a swipe event occurred in that direction\nMay be present only with `EVT_TOUCH_SLIDE`",

        optional: true,
      },
      swipeLeft: {
        type: "boolean",
        description:
          "The field is present and equal to true if a swipe event occurred in that direction\nMay be present only with `EVT_TOUCH_SLIDE`",
        optional: true,
      },
      swipeRight: {
        type: "boolean",
        description:
          "The field is present and equal to true if a swipe event occurred in that direction\nMay be present only with `EVT_TOUCH_SLIDE`",
        optional: true,
      },
      tapCount: {
        type: "number",
        description:
          "Counts the number of consecutive taps\n Zero for anything but `EVT_TOUCH_TAP`",
        optional: false,
      },
    },
  },

  Zone: {
    description: "The screen zone a widget occupies",
    fields: {
      w: {
        type: "number",
        description: "Width of the zone\nFull screen mode: `LCD_W`",
        optional: false,
      },
      h: {
        type: "number",
        description: "Height of the zone\nFull screen mode: `LCD_H`",
        optional: false,
      },
    },
  },

  // ...
};

const SAMPLE_WIDGET_SCHEMA = "{item1:string; item2:number}";

export const scriptTypes: Record<string, ScriptTypeDefinition> = {
  oneTime: {
    description:
      "Runs once when activated. Useful for configuration or setup tasks.",
    notices: [],
    versions: [
      {
        // touchState was not available before 2.7
        from: "2.3",
        to: "2.6",
        fields: {
          init: {
            optional: true,
            signature: "fun()",
            description: "Called once when the script is loaded",
          },
          run: {
            optional: false,
            signature: "fun(event: number): string | number",
            description:
              "Called every cycle. If return value is zero, script will continue to run, non-zero, script will be halted.\nIf return value is a text string with the file path to a new Lua script, then the new script will be loaded and run.",
          },
        },
      },
      {
        // touchState added in 2.7
        from: "2.7",
        to: null,
        fields: {
          init: {
            optional: true,
            signature: "fun()",
            description: "Called once when the script is loaded",
          },
          run: {
            optional: false,
            signature:
              "fun(event: number, touchState?: TouchState): string | number",
            description:
              "Called every cycle. If return value is zero, script will continue to run, non-zero, script will be halted.\nIf return value is a text string with the file path to a new Lua script, then the new script will be loaded and run.",
          },
        },
      },
    ],
  },
  telemetry: {
    description:
      "Displayed on a telemetry screen page. Has full access to the LCD display.",
    notices: [],
    versions: [
      {
        from: "2.3",
        to: "2.3",
        fields: {
          init: {
            optional: true,
            description: "Called once when the script is loaded",
            signature: "fun()",
          },
          background: {
            optional: false,
            signature: "fun()",
            description: "Called when the script is not visible on screen",
          },
          run: {
            optional: false,
            signature: "fun(event: number)",
            description: "Called every cycle when the telemetry page is active",
          },
        },
      },
      {
        from: "2.4",
        to: null,
        fields: {
          init: {
            optional: true,
            description: "Called once when the script is loaded",
            signature: "fun()",
          },
          background: {
            optional: true,
            signature: "fun()",
            description: "Called when the script is not visible on screen",
          },
          run: {
            optional: false,
            signature: "fun(event: number)",
            description: "Called every cycle when the telemetry page is active",
          },
        },
      },
    ],
  },
  widget: {
    generic: {
      name: "TWidget",
      type: "table",
      description:
        "Base widget table returned by create() and passed to update(), background(), and refresh().<br>Extend this class to add your own widget state fields.",
      sample: SAMPLE_WIDGET_SCHEMA,
    },

    description:
      "Displayed in a widget zone on color LCD radios. Widgets must be created via the EdgeTX widget system.",
    notices: [
      "Widget name must be 10 characters or less",
      "Maximum 5 options allowed from 2.3 to 2.10, maximum 10 options from 2.11",
      "Option names must be 10 characters or less with no spaces",
    ],
    versions: [
      {
        from: "2.3",
        to: "2.3",
        fields: {
          name: {
            optional: false,
            signature: "string",
            description:
              "Widget name shown in the EdgeTX UI. Must be 10 characters or less",
          },
          options: {
            optional: true,
            signature: "WidgetOptions",
            description:
              "Table of up to 5 widget options. Names must be 10 characters or less with no spaces",
          },
          create: {
            optional: false,
            signature: "fun(zone: Zone, options: WidgetOptions): TWidget",
            description:
              "Called when the widget is created. Must return a widget table",
            returnSample: SAMPLE_WIDGET_SCHEMA,
          },
          update: {
            optional: true,
            signature: "fun(widget: TWidget, options: WidgetOptions)",
            description: "Called when the user changes widget options",
          },
          background: {
            optional: true,
            signature: "fun(widget: TWidget)",
            description: "Called when the widget is not in the foreground",
          },
          refresh: {
            optional: false,
            signature: "fun(widget: TWidget)",
            description:
              "Called every cycle to draw the widget. No touch support in 2.3",
          },
        },
      },
      {
        from: "2.4",
        to: null,
        fields: {
          name: {
            optional: false,
            signature: "string",
            description:
              "Widget name shown in the EdgeTX UI. Must be 10 characters or less",
          },
          options: {
            optional: true,
            signature: "WidgetOptions",
            description:
              "Table of up to 5 widget options. Names must be 10 characters or less with no spaces",
          },
          create: {
            optional: false,
            signature: "fun(zone: Zone, options: WidgetOptions): TWidget",
            description:
              "Called when the widget is created. Must return a widget table",
            returnSample: SAMPLE_WIDGET_SCHEMA,
          },
          update: {
            optional: true,
            signature: "fun(widget: TWidget, options: WidgetOptions)",
            description: "Called when the user changes widget options",
          },
          background: {
            optional: true,
            signature: "fun(widget: TWidget)",
            description: "Called when the widget is not in the foreground",
          },
          refresh: {
            optional: false,
            signature:
              "fun(widget: TWidget, event: number, touchState?: TouchState)",
            description:
              "Called every cycle to draw the widget. No touch support in 2.3",
          },
        },
      },
    ],
  },
  function: {
    description:
      "Activated by a switch. Runs in the background alongside the main firmware. Does NOT have access to the LCD display.",
    notices: [
      "Function scripts do NOT have access to the LCD display",
      "File name (without extension) must be 6 characters or less",
      "background function is not available in 2.3",
    ],
    versions: [
      {
        from: "2.3",
        to: "2.3",
        fields: {
          init: {
            optional: true,
            signature: "fun()",
            description: "Called once when the script is loaded",
          },
          run: {
            optional: false,
            signature: "fun()",
            description: "Called every cycle while the activating switch is on",
          },
        },
      },
      {
        from: "2.4",
        to: null,
        fields: {
          init: {
            optional: true,
            signature: "fun()",
            description: "Called once when the script is loaded",
          },
          run: {
            optional: false,
            signature: "fun()",
            description: "Called every cycle while the activating switch is on",
          },
          background: {
            optional: false,
            signature: "fun()",
            description: "Called every cycle regardless of switch state",
          },
        },
      },
    ],
  },
  mix: {
    description:
      "Custom mix script that reads inputs and produces outputs used in the mixer. Runs alongside built-in mixes.",
    notices: [
      "Do NOT use mix scripts for anything safety-critical — if the script stops executing, your model could crash",
      "Cannot update the LCD screen or handle user input",
      "Custom scripts run at lower priority than built-in mixes. Execution period is approximately 30ms and is not guaranteed",
      "Should not exceed the allowed run-time or instruction count",
    ],
    versions: [
      {
        from: "2.3",
        to: "2.10",
        fields: {
          input: {
            optional: true,
            signature: "MixInputs",
            description:
              "Declares the script inputs shown in the EdgeTX mixer UI. Each entry is either SOURCE or VALUE form",
          },
          output: {
            optional: true,
            signature: "MixOutput",
            description:
              "Declares the output channel names. run() must return values matching this table",
          },
          init: {
            optional: true,
            signature: "fun()",
            description: "Called once when the script is loaded",
          },
          run: {
            optional: false,
            signature: "fun(input: MixInputs): string, string",
            description:
              "Called every mix cycle. Must return values matching the output table declarations",
          },
        },
      },
      {
        from: "2.11",
        to: null,
        fields: {
          input: {
            optional: false,
            signature: "MixInputs",
            description:
              "Declares the script inputs shown in the EdgeTX mixer UI. Each entry is either SOURCE or VALUE form",
          },
          output: {
            optional: false,
            signature: "MixOutput",
            description:
              "Declares the output channel names. fun() must return values matching this table",
          },
          init: {
            optional: true,
            signature: "fun()",
            description: "Called once when the script is loaded",
          },
          run: {
            optional: false,
            signature: "fun(input: MixInputs): string, string",
            description:
              "Called every mix cycle. Must return values matching the output table declarations",
          },
        },
      },
    ],
  },
};

export const scriptStructures: Record<string, LuaStructure> = {
  MixSourceType: {
    kind: "alias",
    description: "",
    union: ["`SOURCE`"],
  },
  MixValueType: {
    kind: "alias",
    description: "",
    union: ["`VALUE`"],
  },
  MixSourceInput: {
    kind: "class",
    description:
      "SOURCE form mix input entry. Provides the current value of a selected EdgeTX variable.<br>Typical range is -1024 to +1024. Divide by 10.24 to get a percentage from -100% to +100%.",
    fields: [
      { key: 1, type: "string", description: "Input name. Max 8 characters" },
      {
        key: 2,
        type: "MixSourceType",
        description: "Always the SOURCE constant",
      },
    ],
  },

  MixValueInput: {
    kind: "class",
    description:
      "VALUE form mix input entry. Provides a constant value set by the user when the mix script is configured.",
    fields: [
      { key: 1, type: "string", description: "Input name. Max 8 characters" },
      {
        key: 2,
        type: "MixValueType",
        description: "Always the VALUE constant",
      },
      { key: 3, type: "integer", description: "Minimum value. Min -128" },
      { key: 4, type: "integer", description: "Maximum value. Max 127" },
      {
        key: 5,
        type: "integer",
        description: "Default value. Must be within min/max range",
      },
    ],
  },

  MixInput: {
    kind: "alias",
    description: "A mix script input table entry. Either SOURCE or VALUE form.",
    union: ["MixSourceInput", "MixValueInput"],
  },

  MixInputs: {
    kind: "alias",
    description: "Mix script input table. Maximum 6 inputs per script.",
    type: "MixInput[]",
  },

  MixOutput: {
    kind: "alias",
    description:
      "Mix script output table. Declares output channel names. run() must return values matching this table.",
    type: "table<string, string>",
  },

  WidgetOptionType: {
    kind: "alias",
    description: "",
    union: [
      "`SOURCE`",
      "`VALUE`",
      "`BOOL`",
      "`COLOR`",
      "`STRING`",
      "`TIMER`",
      "`SWITCH`",
      "`TEXT_SIZE`",
      "`ALIGNMENT`",
      "`SLIDER`",
      "`CHOICE`",
      "`FILE`",
    ],
  },

  WidgetOptionSOURCE: {
    kind: "class",
    description:
      "Choice option — lets the user pick from available sources (sticks, switches, LS etc.)",
    fields: [
      {
        key: 1,
        type: "string",
        description: "Option name. Max 10 characters, no spaces",
      },
      { key: 2, type: "`SOURCE`", description: "Always the SOURCE constant" },
      { key: 3, type: "integer", description: "Default value" },
    ],
  },

  WidgetOptionBOOL: {
    kind: "class",
    description:
      "Toggle option — displays a checkbox. Toggles between 0 and 1 (not a true boolean).",
    fields: [
      {
        key: 1,
        type: "string",
        description: "Option name. Max 10 characters, no spaces",
      },
      { key: 2, type: "`BOOL`", description: "Always the BOOL constant" },
      { key: 3, type: "integer", description: "Default value. 0 or 1" },
    ],
  },

  WidgetOptionVALUE: {
    kind: "class",
    description:
      "Numerical input option — lets the user specify a value with default, min and max.",
    fields: [
      {
        key: 1,
        type: "string",
        description: "Option name. Max 10 characters, no spaces",
      },
      { key: 2, type: "`VALUE`", description: "Always the VALUE constant" },
      { key: 3, type: "integer", description: "Default value" },
      { key: 4, type: "integer", description: "Minimum value" },
      { key: 5, type: "integer", description: "Maximum value" },
    ],
  },

  WidgetOptionCOLOR: {
    kind: "class",
    description:
      "Color picker option — displays a color picker, returns a color flag value.",
    fields: [
      {
        key: 1,
        type: "string",
        description: "Option name. Max 10 characters, no spaces",
      },
      { key: 2, type: "`COLOR`", description: "Always the COLOR constant" },
      { key: 3, type: "integer", description: "Default color flag value" },
    ],
  },

  WidgetOptionSTRING: {
    kind: "class",
    description:
      "Text input option. Max 8 characters in 2.10 or earlier, max 12 characters from 2.11.",
    fields: [
      {
        key: 1,
        type: "string",
        description: "Option name. Max 10 characters, no spaces",
      },
      { key: 2, type: "`STRING`", description: "Always the STRING constant" },
      { key: 3, type: "string", description: "Default string value" },
    ],
  },

  WidgetOptionTIMER: {
    kind: "class",
    description: "Choice option — lets the user pick from available timers.",
    fields: [
      {
        key: 1,
        type: "string",
        description: "Option name. Max 10 characters, no spaces",
      },
      { key: 2, type: "`TIMER`", description: "Always the TIMER constant" },
      { key: 3, type: "integer", description: "Default value" },
    ],
  },

  WidgetOptionSWITCH: {
    kind: "class",
    description:
      "Choice option — lets the user select from available switches.",
    fields: [
      {
        key: 1,
        type: "string",
        description: "Option name. Max 10 characters, no spaces",
      },
      { key: 2, type: "`SWITCH`", description: "Always the SWITCH constant" },
      { key: 3, type: "integer", description: "Default value" },
    ],
  },

  WidgetOptionTEXT_SIZE: {
    kind: "class",
    description:
      "Choice option — lets the user pick from available text sizes (e.g. small, large).",
    fields: [
      {
        key: 1,
        type: "string",
        description: "Option name. Max 10 characters, no spaces",
      },
      {
        key: 2,
        type: "`TEXT_SIZE`",
        description: "Always the TEXT_SIZE constant",
      },
      { key: 3, type: "integer", description: "Default value" },
    ],
  },

  WidgetOptionALIGNMENT: {
    kind: "class",
    description:
      "Choice option — lets the user pick from available alignment options (e.g. left, center, right).",
    fields: [
      {
        key: 1,
        type: "string",
        description: "Option name. Max 10 characters, no spaces",
      },
      {
        key: 2,
        type: "`ALIGNMENT`",
        description: "Always the ALIGNMENT constant",
      },
      { key: 3, type: "integer", description: "Default value" },
    ],
  },

  WidgetOptionSLIDER: {
    kind: "class",
    description: "Numerical slider option. Available from 2.11.",
    fields: [
      {
        key: 1,
        type: "string",
        description: "Option name. Max 10 characters, no spaces",
      },
      { key: 2, type: "`SLIDER`", description: "Always the SLIDER constant" },
      { key: 3, type: "integer", description: "Default value" },
    ],
  },

  WidgetOptionCHOICE: {
    kind: "class",
    description: "Custom popup list option. Available from 2.11.",
    fields: [
      {
        key: 1,
        type: "string",
        description: "Option name. Max 10 characters, no spaces",
      },
      { key: 2, type: "`CHOICE`", description: "Always the CHOICE constant" },
      { key: 3, type: "integer", description: "Default value" },
    ],
  },

  WidgetOptionFILE: {
    kind: "class",
    description:
      "File picker option — lets the user select a file from SD card. Filename limited to 12 characters. Available from 2.11.",
    fields: [
      {
        key: 1,
        type: "string",
        description: "Option name. Max 10 characters, no spaces",
      },
      { key: 2, type: "`FILE`", description: "Always the FILE constant" },
      {
        key: 3,
        type: "string",
        description: "Default filename. Max 12 characters",
      },
      { key: 4, type: "string", description: "Path on SD card" },
    ],
  },

  WidgetOption: {
    kind: "alias",
    description:
      "A single widget option entry. One of the supported option types.",
    union: [
      "WidgetOptionSOURCE",
      "WidgetOptionBOOL",
      "WidgetOptionVALUE",
      "WidgetOptionCOLOR",
      "WidgetOptionSTRING",
      "WidgetOptionTIMER",
      "WidgetOptionSWITCH",
      "WidgetOptionTEXT_SIZE",
      "WidgetOptionALIGNMENT",
      "WidgetOptionSLIDER",
      "WidgetOptionCHOICE",
      "WidgetOptionFILE",
    ],
  },

  WidgetOptions: {
    kind: "alias",
    description:
      "Table of widget options. Max 5 options in 2.10 or earlier, max 10 from 2.11.",
    type: "WidgetOption[]",
  },
};
