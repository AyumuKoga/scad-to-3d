import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PROTECTED_TEST_URL ?? "http://127.0.0.1:8788";
if (
  baseURL !== "http://127.0.0.1:8788" &&
  !/^https:\/\/(?:[a-z0-9-]+\.)?scad-to-3d-private\.pages\.dev\/?$/.test(baseURL)
) throw new Error("Refusing to send test credentials to an unexpected origin");

export default defineConfig({
  testDir: "./tests/protected",
  timeout: 90_000,
  expect: { timeout: 60_000 },
  workers: 1,
  reporter: "./tests/support/private-reporter.ts",
  // Credentials are supplied only to the test context; never record traces or HAR.
  use: { baseURL, trace: "off", video: "off" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "webkit-ipad",
      use: { ...devices["iPad (gen 7)"], browserName: "webkit" },
    },
  ],
  webServer: process.env.PROTECTED_TEST_URL ? undefined : {
    command: "npm run preview:protected",
    url: "http://127.0.0.1:8788",
    reuseExistingServer: false,
  },
});
