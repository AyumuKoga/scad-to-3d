import { test } from "node:test";
import assert from "node:assert/strict";
import { readSourceFile, safeSourceName } from "../../src/source-file.ts";

test("reads UTF-8 SCAD, preserving code and a safe filename", async () => {
  const source = "// 日本語\ncube([10,20,30]);\n";
  assert.deepEqual(await readSourceFile(new File([source], "収納箱.SCAD")), {
    source,
    filename: "収納箱.scad",
  });
  assert.equal(safeSourceName("../bad:name.scad"), ".._bad_name.scad");
});

test("rejects wrong file types, empty files, binary and non-UTF8 text", async () => {
  for (const [file, message] of [
    [new File(["cube(1);"], "mesh.stl"), /scad形式/],
    [new File([" "], "empty.scad"), /見つかりません/],
    [new File([new Uint8Array([0, 1])], "binary.scad"), /見つかりません/],
    [new File([new Uint8Array([0xff])], "encoding.scad"), /UTF-8/],
  ] as const)
    await assert.rejects(readSourceFile(file), message);
});

test("oversized files are rejected before reading and IO failure is explained", async () => {
  await assert.rejects(
    readSourceFile({
      name: "huge.scad",
      size: 200_001,
      arrayBuffer: async () => {
        assert.fail("Must not read oversized files");
      },
    }),
    /200KB/,
  );
  await assert.rejects(
    readSourceFile({
      name: "missing.scad",
      size: 1,
      arrayBuffer: async () => {
        throw new Error("device unavailable");
      },
    }),
    /読み込めません/,
  );
});
