import { test } from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../../src/engine.ts";

function fakeWorker() {
  return {
    terminated: false,
    onmessage: null as Worker["onmessage"],
    onerror: null as Worker["onerror"],
    onmessageerror: null as Worker["onmessageerror"],
    postMessage() {},
    terminate() {
      this.terminated = true;
    },
    receive(data: unknown) {
      this.onmessage?.call(this as unknown as Worker, { data } as MessageEvent);
    },
  };
}
test("deadline terminates a stuck worker and allows the next render", async () => {
  const workers: ReturnType<typeof fakeWorker>[] = [];
  const engine = new Engine(() => {
    const worker = fakeWorker();
    workers.push(worker);
    return worker;
  }, 15);
  await assert.rejects(
    engine.render("cube(1);", "http://localhost/", () => {}),
    /上限/,
  );
  assert.equal(workers[0].terminated, true);
  const next = engine.render("cube(2);", "http://localhost/", () => {});
  workers[1].receive({
    type: "success",
    result: { bytes: new ArrayBuffer(100), logs: "", elapsedMs: 1 },
  });
  assert.equal((await next).bytes.byteLength, 100);
  assert.equal(workers[1].terminated, true);
});
test("cancel terminates work; late messages do not change the result", async () => {
  const worker = fakeWorker();
  const engine = new Engine(() => worker, 100);
  const promise = engine.render("cube(1);", "http://localhost/", () => {});
  engine.cancel();
  worker.receive({ type: "success", result: {} });
  await assert.rejects(promise, /中止/);
  assert.equal(worker.terminated, true);
});
test("bad source is rejected before a worker is allocated", async () => {
  const engine = new Engine(() => {
    throw new Error("worker should not start");
  });
  await assert.rejects(
    engine.render("include <a>", "http://localhost/", () => {}),
    /外部ファイル/,
  );
});

test("worker startup failure is explained and a later attempt succeeds", async () => {
  let fail = true;
  const worker = fakeWorker();
  const engine = new Engine(() => {
    if (fail) throw new Error("SecurityError");
    return worker;
  });
  await assert.rejects(
    engine.render("cube(1);", "http://localhost/", () => {}),
    /起動できません/,
  );
  fail = false;
  const next = engine.render("cube(1);", "http://localhost/", () => {});
  worker.receive({
    type: "success",
    result: { bytes: new ArrayBuffer(100), logs: "", elapsedMs: 1 },
  });
  assert.equal((await next).bytes.byteLength, 100);
});
