import { test } from "node:test";
import assert from "node:assert/strict";
import { formatLength, gridSpacing } from "../../src/measurements.ts";

test("display units convert mm to cm without rounding small models to zero", () => {
  assert.equal(formatLength(220, "cm"), "22 cm");
  assert.equal(formatLength(220, "mm"), "220 mm");
  assert.equal(formatLength(0.005, "cm"), "0.0005 cm");
});

test("grid spacing grows with the model and stays readable at very small scales", () => {
  assert.equal(gridSpacing(30), 5);
  assert.equal(gridSpacing(140), 50);
  assert.equal(gridSpacing(0.01), 0.002);
});
