import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateSource,
  explainError,
  MAX_CODE_BYTES,
  isSourceOversized,
} from "../../src/policy.ts";

test("code limits count UTF-8 bytes instead of just characters", () => {
  assert.equal(isSourceOversized("a".repeat(MAX_CODE_BYTES)), false);
  assert.equal(isSourceOversized("あ".repeat(70_000)), true);
});

test("rejects empty, oversized and fenced input", () => {
  for (const input of [
    "",
    "// only comment",
    " ".repeat(MAX_CODE_BYTES + 1),
    "```scad\ncube(1);\n```",
  ]) {
    assert.throws(() => validateSource(input));
  }
});
test("blocks external file operations even with intervening comments", () => {
  for (const input of [
    "include <lib.scad>",
    "use <x.scad>",
    'import /* gap */ ("a.stl");',
    'surface\n(file="a.png");',
  ]) {
    assert.throws(() => validateSource(input), /外部ファイル/);
  }
  assert.throws(() => validateSource('// heading\n\nimport("x");'), /3行目/);
});
test("does not misinterpret strings, escapes, comments or longer identifiers", () => {
  validateSource(
    '/* include <x> */\n// import("x")\necho("use \\" import()"); cube(2);',
  );
  validateSource("module importable() { cube(1); } importable();");
});
test("translates parse, memory and empty-model errors", () => {
  assert.match(
    explainError("ERROR: Parser error in file input.scad, line 8"),
    /8行目/,
  );
  assert.match(explainError("memory access out of bounds"), /メモリ/);
  assert.match(
    explainError("Current top level object is empty."),
    /立体が生成されません/,
  );
});
