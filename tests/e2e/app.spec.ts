import { test, expect } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import { examples } from "../../src/examples";

const cases = {
  largeBox: examples.largeBox.code,
  cube: "cube([10,20,30]);",
  cylinder: "$fn=24; cylinder(h=12,r=8);",
  sphere: "$fn=24; sphere(10);",
  union: "union(){cube(10); translate([8,0,0])cube(10);}",
  difference:
    "$fn=24; difference(){cube(20);translate([10,10,-1])cylinder(h=22,r=3);}",
  rotate: "rotate([20,30,40])cube([10,20,30]);",
  hull: "$fn=16; hull(){sphere(3);translate([20,0,0])sphere(4);}",
  module_for:
    "module part(x){translate([x,0,0])cube(3);} for(i=[0:4])part(i*2);",
  intersection: "intersection(){cube(10);translate([5,5,5])cube(10);}",
  minkowski: "$fn=8; minkowski(){cube(5);sphere(1);}",
  extrude: "linear_extrude(height=8) polygon([[0,0],[10,0],[5,10]]);",
  rotate_extrude: "$fn=24; rotate_extrude() translate([10,0])square([3,5]);",
  scale_if_math: "size=3*4; if(size>5)scale([1,2,1])cube(size);",
  bracket: examples.bracket.code,
  phone: examples.phone.code,
  holder: examples.holder.code,
};

test("SCAD files round-trip locally and replacement requires confirmation", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const source = "// 保存した作品\ncube([10,20,30]);\n";
  const file = {
    name: "my-box.scad",
    mimeType: "text/plain",
    buffer: Buffer.from(source),
  };
  await page.locator("#source-file").setInputFiles(file);
  await expect(page.locator("#code")).toHaveValue(source);
  await expect(page.locator("#file-name")).toHaveText("my-box.scad");
  await page.locator("#generate").click();
  await expect(page.locator("#download")).toBeEnabled();
  const stlPending = page.waitForEvent("download");
  await page.locator("#download").click();
  expect((await stlPending).suggestedFilename()).toBe("my-box.stl");

  const changed = source + "// 編集しました\n";
  await page.locator("#code").fill(changed);
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "SCADコードを保存" }).click();
  const saved = await pending;
  expect(saved.suggestedFilename()).toBe("my-box.scad");
  const path = testInfo.outputPath("saved.scad");
  await saved.saveAs(path);
  expect(await readFile(path, "utf8")).toBe(changed);

  await page
    .locator("#source-file")
    .setInputFiles({ ...file, name: "wrong.stl" });
  await expect(page.locator("#status")).toContainText(".scad形式");
  await expect(page.locator("#code")).toHaveValue(changed);
  await page.locator("#source-file").setInputFiles(file);
  await expect(page.locator("#sample-dialog")).toBeVisible();
  await page.locator("#sample-cancel").click();
  await expect(page.locator("#code")).toHaveValue(changed);
  await page.locator("#source-file").setInputFiles(file);
  await page.locator("#sample-confirm").click();
  await expect(page.locator("#code")).toHaveValue(source);
});

test("oversized file and paste preserve the existing code", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#code").fill("cube(12);");
  await page.locator("#source-file").setInputFiles({
    name: "large.scad",
    mimeType: "text/plain",
    buffer: Buffer.alloc(200_001, "x"),
  });
  await expect(page.locator("#status")).toContainText("200KB");
  await expect(page.locator("#code")).toHaveValue("cube(12);");
  const prevented = await page.locator("#code").evaluate((element) => {
    const data = new DataTransfer();
    data.setData("text/plain", "あ".repeat(70_000));
    const event = new ClipboardEvent("paste", {
      clipboardData: data,
      bubbles: true,
      cancelable: true,
    });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(true);
  await expect(page.locator("#code")).toHaveValue("cube(12);");
  await expect(page.locator("#status")).toContainText("貼り付けませんでした");
  await page.locator("#generate").click();
  await expect(page.locator("#download")).toBeEnabled();
});

test("a lost 3D context can be restarted without losing code or the model", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#code").fill("cube([10,20,30]);");
  await page.locator("#generate").click();
  await expect(page.locator("#download")).toBeEnabled();
  await page.locator("#viewport canvas").evaluate((canvas) => {
    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
  });
  await expect(page.locator("#restore-viewer")).toBeVisible();
  await expect(page.locator("#download")).toBeDisabled();
  await page.locator("#restore-viewer").click();
  await expect(page.locator("#status")).toHaveText("3D表示を再開しました。");
  await expect(page.locator("#code")).toHaveValue("cube([10,20,30]);");
  await expect(page.locator("#dimensions")).toHaveText(
    "X 1 cm · Y 2 cm · Z 3 cm",
  );
  await expect(page.locator("#download")).toBeEnabled();
  await expect(page.locator("#viewport canvas")).toHaveCount(1);
});

test("real WASM renders the language fixtures and downloads valid binary STL", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (!request.url().startsWith("http://127.0.0.1:4173"))
      external.push(request.url());
  });
  await page.goto("/");
  await expect(page.locator("#generate")).toBeEnabled();
  for (const [name, source] of Object.entries(cases)) {
    await page.locator("#code").fill(source);
    await page.locator("#generate").click();
    await expect(
      page.locator("#download"),
      `${name}: ${await page.locator("#status").textContent()}`,
    ).toBeEnabled();
    const pending = page.waitForEvent("download");
    await page.locator("#download").click();
    const download = await pending;
    const file = testInfo.outputPath(`${name}.stl`);
    await download.saveAs(file);
    const bytes = await readFile(file);
    const count = bytes.readUInt32LE(80);
    expect(count).toBeGreaterThan(0);
    expect(bytes.length).toBe(84 + count * 50);
    // Mesh volume must be positive; reject NaN/Infinity vertex coordinates.
    let volume = 0;
    for (let i = 0; i < count; i++) {
      const vertices = Array.from({ length: 9 }, (_, n) =>
        bytes.readFloatLE(84 + i * 50 + 12 + n * 4),
      );
      expect(vertices.every(Number.isFinite)).toBe(true);
      const [ax, ay, az, bx, by, bz, cx, cy, cz] = vertices;
      volume +=
        (ax * (by * cz - bz * cy) -
          ay * (bx * cz - bz * cx) +
          az * (bx * cy - by * cx)) /
        6;
    }
    expect(volume).toBeGreaterThan(0);
    if (name === "cube") expect(volume).toBeCloseTo(6000, 4);
    if (name === "bracket" && testInfo.project.name === "chromium") {
      await mkdir("artifacts", { recursive: true });
      await download.saveAs("artifacts/bracket.stl");
      await page.screenshot({ path: "artifacts/desktop.png", fullPage: true });
    }
  }
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test("centimeter rulers describe a large model without changing its exported size", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.locator("#sample").selectOption("largeBox");
  await page.locator("#generate").click();
  await expect(page.locator("#download")).toBeEnabled();
  await expect(page.locator("#dimensions")).toHaveText(
    "X 22 cm · Y 14 cm · Z 8 cm",
  );
  await expect(page.locator("#grid-scale")).toContainText("1マス = 5 cm");
  const save = async (name: string) => {
    const pending = page.waitForEvent("download");
    await page.locator("#download").click();
    const download = await pending;
    const file = testInfo.outputPath(name);
    await download.saveAs(file);
    return readFile(file);
  };
  const centimeters = await save("large-cm.stl");
  await page.locator("#display-unit").selectOption("mm");
  await expect(page.locator("#dimensions")).toHaveText(
    "X 220 mm · Y 140 mm · Z 80 mm",
  );
  await expect(page.locator("#grid-scale")).toContainText("1マス = 50 mm");
  const millimeters = await save("large-mm.stl");
  expect(centimeters.equals(millimeters)).toBe(true);
  const max = [0, 0, 0];
  const count = millimeters.readUInt32LE(80);
  for (let i = 0; i < count; i++) {
    for (let j = 0; j < 9; j++) {
      max[j % 3] = Math.max(
        max[j % 3],
        millimeters.readFloatLE(84 + i * 50 + 12 + j * 4),
      );
    }
  }
  expect(max).toEqual([220, 140, 80]);
  await page.locator("#display-unit").selectOption("cm");
  if (testInfo.project.name === "chromium") {
    await page.screenshot({ path: "artifacts/large-box.png", fullPage: true });
  }
});

test("error line, original log, recovery, stale download and all viewpoints", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#code").fill("cube(10);\ntranslate([1,2,3]) cube(;");
  await page.locator("#generate").click();
  await expect(page.locator("#status")).toContainText("2行目");
  await expect(page.locator("#logs")).toContainText("ERROR");
  await expect(page.locator("#download")).toBeDisabled();
  await page.locator("#code").fill("cube(10);");
  await page.locator("#generate").click();
  await expect(page.locator("#download")).toBeEnabled();
  for (const name of [
    "front",
    "back",
    "left",
    "right",
    "top",
    "bottom",
    "iso",
  ]) {
    await page.locator(`[data-view="${name}"]`).click();
    await expect(page.locator(`[data-view="${name}"]`)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  }
  await page.locator("#fit").click();
  await page.locator("#code").fill("cube(20);");
  await expect(page.locator("#model-state")).toHaveText("変更が未反映");
  await expect(page.locator("#download")).toBeDisabled();
  await page.locator("#code").fill("difference(){cube(5);cube(5);}");
  await page.locator("#generate").click();
  await expect(page.locator("#status")).toContainText("立体が生成されません");
  await expect(page.locator("#download")).toBeDisabled();
});

test("cancel and blocked external files remain recoverable", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#code").fill("include <secret.scad>\ncube(1);");
  await page.locator("#generate").click();
  await expect(page.locator("#status")).toContainText("外部ファイル");
  await page
    .locator("#code")
    .fill("$fn=200; minkowski(){sphere(20);sphere(10);}");
  await page.locator("#generate").click();
  await page.locator("#cancel").click();
  await expect(page.locator("#status")).toContainText("中止");
  await expect(page.locator("#generate")).toBeEnabled();
  await page.locator("#code").fill("cube(5);");
  await page.locator("#generate").click();
  await expect(page.locator("#download")).toBeEnabled();
});

test("engine download failure is explained and can be retried", async ({
  page,
}) => {
  await page.route("**/engine/openscad.js", (route) => route.abort());
  await page.goto("/");
  await page.locator("#generate").click();
  await expect(page.locator("#status")).toContainText("読み込めません");
  await expect(page.locator("#download")).toBeDisabled();
  await page.unroute("**/engine/openscad.js");
  await page.locator("#generate").click();
  await expect(page.locator("#download")).toBeEnabled();
});

test("view presets and pointer gestures change the rendered model", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.locator("#generate").click();
  await expect(page.locator("#download")).toBeEnabled();
  const canvas = page.locator("#viewport canvas");
  const iso = await canvas.screenshot();
  await page.locator('[data-view="top"]').click();
  const top = await canvas.screenshot();
  expect(top.equals(iso)).toBe(false);
  await page.locator('[data-view="front"]').click();
  const front = await canvas.screenshot();
  expect(front.equals(top)).toBe(false);
  await page.locator("#fit").click();
  if (testInfo.project.name === "chromium") {
    const box = (await canvas.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 80, y + 25, { steps: 8 });
    await page.mouse.up();
    const rotated = await canvas.screenshot();
    expect(rotated.equals(iso)).toBe(false);
    await page.mouse.wheel(0, -150);
    const zoomed = await canvas.screenshot();
    expect(zoomed.equals(rotated)).toBe(false);
    await page.mouse.down({ button: "right" });
    await page.mouse.move(x + 120, y + 50, { steps: 6 });
    await page.mouse.up({ button: "right" });
    expect((await canvas.screenshot()).equals(zoomed)).toBe(false);
  } else {
    // WebKit's automation does not expose a multi-touch device API; exercise
    // the Pointer Events route used by OrbitControls, separate from real-device QA.
    const pointer = (id: number, x: number, y: number) => ({
      pointerId: id,
      pointerType: "touch",
      clientX: x,
      clientY: y,
      bubbles: true,
    });
    await canvas.dispatchEvent("pointerdown", pointer(1, 180, 200));
    await canvas.dispatchEvent("pointermove", pointer(1, 240, 230));
    await canvas.dispatchEvent("pointerup", pointer(1, 240, 230));
    const rotated = await canvas.screenshot();
    expect(rotated.equals(iso)).toBe(false);
    await canvas.dispatchEvent("pointerdown", pointer(1, 180, 200));
    await canvas.dispatchEvent("pointerdown", pointer(2, 280, 200));
    await canvas.dispatchEvent("pointermove", pointer(2, 340, 220));
    await canvas.dispatchEvent("pointerup", pointer(2, 340, 220));
    await canvas.dispatchEvent("pointerup", pointer(1, 180, 200));
    expect((await canvas.screenshot()).equals(rotated)).toBe(false);
  }
});

test("narrow screens stack and support sample replacement without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("#generate")).toBeEnabled();
  const editor = await page.locator(".editor-panel").boundingBox();
  const preview = await page.locator(".preview-panel").boundingBox();
  expect(preview!.y).toBeGreaterThan(editor!.y + editor!.height);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator("#code").fill("cube(42);");
  await page.locator("#sample").selectOption("phone");
  await expect(page.locator("#sample-dialog")).toBeVisible();
  await page.locator("#sample-cancel").click();
  await expect(page.locator("#code")).toHaveValue("cube(42);");
  await page.locator("#sample").selectOption("phone");
  await page.locator("#sample-confirm").click();
  await expect(page.locator("#code")).toHaveValue(examples.phone.code);
  await page.screenshot({ path: "artifacts/mobile.png", fullPage: true });
});
