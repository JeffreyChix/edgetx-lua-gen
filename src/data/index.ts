export const EVT_CONSTANTS = [
  "EVT_PAGE_FIRST",
  "EVT_PAGE_LONG",
  "EVT_PAGE_REPT",
  "EVT_PAGE_BREAK",
  "EVT_MENU_FIRST",
  "EVT_MENU_LONG",
  "EVT_MENU_REPT",
  "EVT_MENU_BREAK",
  "EVT_ENTER_FIRST",
  "EVT_ENTER_LONG",
  "EVT_ENTER_REPT",
  "EVT_ENTER_BREAK",
  "EVT_EXIT_FIRST",
  "EVT_EXIT_LONG",
  "EVT_EXIT_REPT",
  "EVT_EXIT_BREAK",
  "EVT_PLUS_FIRST",
  "EVT_PLUS_LONG",
  "EVT_PLUS_REPT",
  "EVT_PLUS_BREAK",
  "EVT_MINUS_FIRST",
  "EVT_MINUS_LONG",
  "EVT_MINUS_REPT",
  "EVT_MINUS_BREAK",
  "EVT_ROT_LEFT",
  "EVT_ROT_RIGHT",
  "EVT_UP_FIRST",
  "EVT_UP_LONG",
  "EVT_UP_REPT",
  "EVT_UP_BREAK",
  "EVT_DOWN_FIRST",
  "EVT_DOWN_LONG",
  "EVT_DOWN_REPT",
  "EVT_DOWN_BREAK",
  "EVT_RIGHT_FIRST",
  "EVT_RIGHT_LONG",
  "EVT_RIGHT_REPT",
  "EVT_RIGHT_BREAK",
  "EVT_LEFT_FIRST",
  "EVT_LEFT_LONG",
  "EVT_LEFT_REPT",
  "EVT_LEFT_BREAK",
  "EVT_SHIFT_FIRST",
  "EVT_SHIFT_LONG",
  "EVT_SHIFT_REPT",
  "EVT_SHIFT_BREAK",
  "EVT_PAGEUP_FIRST",
  "EVT_PAGEUP_LONG",
  "EVT_PAGEUP_REPT",
  "EVT_PAGEUP_BREAK",
  "EVT_PAGEDN_FIRST",
  "EVT_PAGEDN_LONG",
  "EVT_PAGEDN_REPT",
  "EVT_PAGEDN_BREAK",
  "EVT_SYS_FIRST",
  "EVT_SYS_LONG",
  "EVT_SYS_REPT",
  "EVT_SYS_BREAK",
  "EVT_MODEL_FIRST",
  "EVT_MODEL_LONG",
  "EVT_MODEL_REPT",
  "EVT_MODEL_BREAK",
  "EVT_TELEM_FIRST",
  "EVT_TELEM_LONG",
  "EVT_TELEM_REPT",
  "EVT_TELEM_BREAK",
  "EVT_TOUCH_FIRST",
  "EVT_TOUCH_BREAK",
  "EVT_TOUCH_SLIDE",
  "EVT_TOUCH_TAP",
];

export const SUPPORTED_MANIFEST_VERSION = 2;

export const BIT32_STUB_DEF = `---@meta
-- bit32: Lua 5.2 bitwise operations library.
-- Supported by EdgeTX despite Lua 5.3+ deprecation.
-- Consider using native operators (&, |, ~, >>, <<) for future compatibility.

---@deprecated Use native Lua 5.3+ bitwise operators (&, |, ~, >>, <<) for future compatibility
---@class bit32lib
local bit32lib = {}

---Returns the number x shifted disp bits to the right (arithmetic shift).
---Negative displacements shift to the left.
---Vacant bits on the left are filled with copies of the highest bit of x.
---@deprecated
---@param x integer
---@param disp integer
---@return integer
function bit32lib.arshift(x, disp) end

---Returns the bitwise AND of its operands.
---@deprecated
---@param ... integer
---@return integer
function bit32lib.band(...) end

---Returns the bitwise NOT of x.
---Identity: bit32.bnot(x) == (-1 - x) % 2^32
---@deprecated
---@param x integer
---@return integer
function bit32lib.bnot(x) end

---Returns the bitwise OR of its operands.
---@deprecated
---@param ... integer
---@return integer
function bit32lib.bor(...) end

---Returns true if the bitwise AND of its operands is not zero.
---@deprecated
---@param ... integer
---@return boolean
function bit32lib.btest(...) end

---Returns the bitwise XOR of its operands.
---@deprecated
---@param ... integer
---@return integer
function bit32lib.bxor(...) end

---Returns the unsigned number formed by bits field to field+width-1 from n.
---Bits are numbered 0 (least significant) to 31 (most significant).
---@deprecated
---@param n integer
---@param field integer Bit position (0-31)
---@param width? integer Number of bits to extract (default: 1)
---@return integer
function bit32lib.extract(n, field, width) end

---Returns a copy of n with bits field to field+width-1 replaced by v.
---@deprecated
---@param n integer
---@param v integer Replacement value
---@param field integer Bit position (0-31)
---@param width? integer Number of bits to replace (default: 1)
---@return integer
function bit32lib.replace(n, field, v, width) end

---Returns x rotated disp bits to the left.
---Negative displacements rotate to the right.
---@deprecated
---@param x integer
---@param disp integer
---@return integer
function bit32lib.lrotate(x, disp) end

---Returns x shifted disp bits to the left (logical shift).
---Negative displacements shift to the right. Vacant bits filled with zeros.
---@deprecated
---@param x integer
---@param disp integer
---@return integer
function bit32lib.lshift(x, disp) end

---Returns x rotated disp bits to the right.
---Negative displacements rotate to the left.
---@deprecated
---@param x integer
---@param disp integer
---@return integer
function bit32lib.rrotate(x, disp) end

---Returns x shifted disp bits to the right (logical shift).
---Negative displacements shift to the left. Vacant bits filled with zeros.
---@deprecated
---@param x integer
---@param disp integer
---@return integer
function bit32lib.rshift(x, disp) end

---@type bit32lib
bit32 = {}`;
