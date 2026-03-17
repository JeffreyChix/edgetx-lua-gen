---@meta edgetx
--- EdgeTX script type definitions for version 2.6

--- Touch event state passed to scripts on color LCD radios
---  `nil` if `event` is not a touch event. This can be used to test if we have a touch event or a key event.
---@class TouchState
--- Current touch point
--- Present for all touch events.
---@field x number
--- Current touch point
--- Present for all touch events.
---@field y number
--- Point where slide started
--- Only present with `EVT_TOUCH_SLIDE`
---@field startX? number
--- Point where slide started
--- Only present with `EVT_TOUCH_SLIDE`
---@field startY? number
--- Movement since previous SLIDE event (or start of slide)
--- Only present with `EVT_TOUCH_SLIDE`
---@field slideX? number
--- Movement since previous SLIDE event (or start of slide)
--- Only present with `EVT_TOUCH_SLIDE`
---@field slideY? number
--- The field is present and equal to true if a swipe event occurred in that direction
--- May be present only with `EVT_TOUCH_SLIDE`
---@field swipeUp? boolean
--- The field is present and equal to true if a swipe event occurred in that direction
--- May be present only with `EVT_TOUCH_SLIDE`
---@field swipeDown? boolean
--- The field is present and equal to true if a swipe event occurred in that direction
--- May be present only with `EVT_TOUCH_SLIDE`
---@field swipeLeft? boolean
--- The field is present and equal to true if a swipe event occurred in that direction
--- May be present only with `EVT_TOUCH_SLIDE`
---@field swipeRight? boolean
--- Counts the number of consecutive taps
---  Zero for anything but `EVT_TOUCH_TAP`
---@field tapCount number

--- The screen zone a widget occupies
---@class Zone
--- Width of the zone
--- Full screen mode: `LCD_W`
---@field w number
--- Height of the zone
--- Full screen mode: `LCD_H`
---@field h number

---@alias MixSourceType
---| `SOURCE`

---@alias MixValueType
---| `VALUE`

--- SOURCE form mix input entry. Provides the current value of a selected EdgeTX variable.<br>Typical range is -1024 to +1024. Divide by 10.24 to get a percentage from -100% to +100%.
---@class MixSourceInput
--- Input name. Max 8 characters
---@field [1] string
--- Always the SOURCE constant
---@field [2] MixSourceType

--- VALUE form mix input entry. Provides a constant value set by the user when the mix script is configured.
---@class MixValueInput
--- Input name. Max 8 characters
---@field [1] string
--- Always the VALUE constant
---@field [2] MixValueType
--- Minimum value. Min -128
---@field [3] integer
--- Maximum value. Max 127
---@field [4] integer
--- Default value. Must be within min/max range
---@field [5] integer

--- A mix script input table entry. Either SOURCE or VALUE form.
---@alias MixInput
---| MixSourceInput
---| MixValueInput

--- Mix script input table. Maximum 6 inputs per script.
---@alias MixInputs MixInput[]

--- Mix script output table. Declares output channel names. run() must return values matching this table.
---@alias MixOutput table<string, string>

---@alias WidgetOptionType
---| `SOURCE`
---| `VALUE`
---| `BOOL`
---| `COLOR`
---| `STRING`
---| `TIMER`
---| `SWITCH`
---| `TEXT_SIZE`
---| `ALIGNMENT`
---| `SLIDER`
---| `CHOICE`
---| `FILE`

--- Choice option — lets the user pick from available sources (sticks, switches, LS etc.)
---@class WidgetOptionSOURCE
--- Option name. Max 10 characters, no spaces
---@field [1] string
--- Always the SOURCE constant
---@field [2] `SOURCE`
--- Default value
---@field [3] integer

--- Toggle option — displays a checkbox. Toggles between 0 and 1 (not a true boolean).
---@class WidgetOptionBOOL
--- Option name. Max 10 characters, no spaces
---@field [1] string
--- Always the BOOL constant
---@field [2] `BOOL`
--- Default value. 0 or 1
---@field [3] integer

--- Numerical input option — lets the user specify a value with default, min and max.
---@class WidgetOptionVALUE
--- Option name. Max 10 characters, no spaces
---@field [1] string
--- Always the VALUE constant
---@field [2] `VALUE`
--- Default value
---@field [3] integer
--- Minimum value
---@field [4] integer
--- Maximum value
---@field [5] integer

--- Color picker option — displays a color picker, returns a color flag value.
---@class WidgetOptionCOLOR
--- Option name. Max 10 characters, no spaces
---@field [1] string
--- Always the COLOR constant
---@field [2] `COLOR`
--- Default color flag value
---@field [3] integer

--- Text input option. Max 8 characters in 2.10 or earlier, max 12 characters from 2.11.
---@class WidgetOptionSTRING
--- Option name. Max 10 characters, no spaces
---@field [1] string
--- Always the STRING constant
---@field [2] `STRING`
--- Default string value
---@field [3] string

--- Choice option — lets the user pick from available timers.
---@class WidgetOptionTIMER
--- Option name. Max 10 characters, no spaces
---@field [1] string
--- Always the TIMER constant
---@field [2] `TIMER`
--- Default value
---@field [3] integer

--- Choice option — lets the user select from available switches.
---@class WidgetOptionSWITCH
--- Option name. Max 10 characters, no spaces
---@field [1] string
--- Always the SWITCH constant
---@field [2] `SWITCH`
--- Default value
---@field [3] integer

--- Choice option — lets the user pick from available text sizes (e.g. small, large).
---@class WidgetOptionTEXT_SIZE
--- Option name. Max 10 characters, no spaces
---@field [1] string
--- Always the TEXT_SIZE constant
---@field [2] `TEXT_SIZE`
--- Default value
---@field [3] integer

--- Choice option — lets the user pick from available alignment options (e.g. left, center, right).
---@class WidgetOptionALIGNMENT
--- Option name. Max 10 characters, no spaces
---@field [1] string
--- Always the ALIGNMENT constant
---@field [2] `ALIGNMENT`
--- Default value
---@field [3] integer

--- Numerical slider option. Available from 2.11.
---@class WidgetOptionSLIDER
--- Option name. Max 10 characters, no spaces
---@field [1] string
--- Always the SLIDER constant
---@field [2] `SLIDER`
--- Default value
---@field [3] integer

--- Custom popup list option. Available from 2.11.
---@class WidgetOptionCHOICE
--- Option name. Max 10 characters, no spaces
---@field [1] string
--- Always the CHOICE constant
---@field [2] `CHOICE`
--- Default value
---@field [3] integer

--- File picker option — lets the user select a file from SD card. Filename limited to 12 characters. Available from 2.11.
---@class WidgetOptionFILE
--- Option name. Max 10 characters, no spaces
---@field [1] string
--- Always the FILE constant
---@field [2] `FILE`
--- Default filename. Max 12 characters
---@field [3] string
--- Path on SD card
---@field [4] string

--- A single widget option entry. One of the supported option types.
---@alias WidgetOption
---| WidgetOptionSOURCE
---| WidgetOptionBOOL
---| WidgetOptionVALUE
---| WidgetOptionCOLOR
---| WidgetOptionSTRING
---| WidgetOptionTIMER
---| WidgetOptionSWITCH
---| WidgetOptionTEXT_SIZE
---| WidgetOptionALIGNMENT
---| WidgetOptionSLIDER
---| WidgetOptionCHOICE
---| WidgetOptionFILE

--- Table of widget options. Max 5 options in 2.10 or earlier, max 10 from 2.11.
---@alias WidgetOptions WidgetOption[]

--- Base widget table returned by create() and passed to update(), background(), and refresh().<br>Extend this class to add your own widget state fields.
---@class WidgetContext
--- The zone passed at creation time
---@field zone Zone

--- Runs once when activated. Useful for configuration or setup tasks.
---@class (exact) OneTimeScript
--- Called once when the script is loaded
---@field init? fun()
--- Called every cycle. If return value is zero, script will continue to run, non-zero, script will be halted.
--- If return value is a text string with the file path to a new Lua script, then the new script will be loaded and run.
---@field run fun(event: number): string | number

--- Displayed on a telemetry screen page. Has full access to the LCD display.
---@class (exact) TelemetryScript
--- Called once when the script is loaded
---@field init? fun()
--- Called when the script is not visible on screen
---@field background? fun()
--- Called every cycle when the telemetry page is active
---@field run fun(event: number)

--- Displayed in a widget zone on color LCD radios. Widgets must be created via the EdgeTX widget system.
--- >⚠️ Widget name must be 10 characters or less<br>
--- >⚠️ Maximum 5 options allowed from 2.3 to 2.10, maximum 10 options from 2.11<br>
--- >⚠️ Option names must be 10 characters or less with no spaces<br>
---@class (exact) WidgetScript
--- Widget name shown in the EdgeTX UI. Must be 10 characters or less
---@field name string
--- Table of up to 5 widget options. Names must be 10 characters or less with no spaces
---@field options? WidgetOptions
--- Called when the widget is created. Must return a widget table
---@field create fun(zone: Zone, options: WidgetOptions): WidgetContext
--- Called when the user changes widget options
---@field update? fun(widget: WidgetContext, options: WidgetOptions)
--- Called when the widget is not in the foreground
---@field background? fun(widget: WidgetContext)
--- Called every cycle to draw the widget. No touch support in 2.3
---@field refresh fun(widget: WidgetContext, event: number, touchState?: TouchState)

--- Activated by a switch. Runs in the background alongside the main firmware. Does NOT have access to the LCD display.
--- >⚠️ Function scripts do NOT have access to the LCD display<br>
--- >⚠️ File name (without extension) must be 6 characters or less<br>
--- >⚠️ background function is not available in 2.3<br>
---@class (exact) FunctionScript
--- Called once when the script is loaded
---@field init? fun()
--- Called every cycle while the activating switch is on
---@field run fun()
--- Called every cycle regardless of switch state
---@field background fun()

--- Custom mix script that reads inputs and produces outputs used in the mixer. Runs alongside built-in mixes.
--- >⚠️ Do NOT use mix scripts for anything safety-critical — if the script stops executing, your model could crash<br>
--- >⚠️ Cannot update the LCD screen or handle user input<br>
--- >⚠️ Custom scripts run at lower priority than built-in mixes. Execution period is approximately 30ms and is not guaranteed<br>
--- >⚠️ Should not exceed the allowed run-time or instruction count<br>
---@class (exact) MixesScript
--- Declares the script inputs shown in the EdgeTX mixer UI. Each entry is either SOURCE or VALUE form
---@field input? MixInputs
--- Declares the output channel names. run() must return values matching this table
---@field output? MixOutput
--- Called once when the script is loaded
---@field init? fun()
--- Called every mix cycle. Must return values matching the output table declarations
---@field run fun(input: MixInputs): string, string

