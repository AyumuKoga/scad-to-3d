import type { FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";

// Playwright's HTTP error call logs can include the Basic Authorization value.
// Protected tests report status and duration only; never print request call logs.
export default class PrivateReporter implements Reporter {
  onTestEnd(test: TestCase, result: TestResult) {
    console.log(`${result.status}: ${test.title} (${result.duration} ms)`);
    if (result.status !== "passed" && result.status !== "skipped") {
      console.log("Protected test failed. Authentication request logs are intentionally not printed.");
    }
  }
  onEnd(result: FullResult) {
    console.log(`Protected test suite: ${result.status}`);
  }
}
