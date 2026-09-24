import {
  MAX_LOG_CHARS,
  MAX_STL_BYTES,
  explainError,
  validateSource,
} from "./policy.ts";

interface OpenSCADModule {
  FS: {
    writeFile(path: string, data: string): void;
    readFile(path: string): Uint8Array;
    stat(path: string): { size: number };
  };
  callMain(args: string[]): number;
}

self.onmessage = async ({
  data,
}: MessageEvent<{ source: string; assetBase: string }>) => {
  let logs = "";
  let stage = "load";
  const log = (message: string) => {
    if (logs.length < MAX_LOG_CHARS)
      logs += `${message}\n`.slice(0, MAX_LOG_CHARS - logs.length);
  };
  const started = performance.now();
  try {
    validateSource(data.source);
    self.postMessage({
      type: "phase",
      message: "OpenSCADを準備しています… 初回は少し時間がかかります。",
    });
    const engineUrl = new URL("engine/openscad.js", data.assetBase).href;
    const { default: OpenSCAD } = await import(/* @vite-ignore */ engineUrl);
    const engine: OpenSCADModule = await OpenSCAD({
      noInitialRun: true,
      print: log,
      printErr: log,
      locateFile: (name: string) =>
        new URL(`engine/${name}`, data.assetBase).href,
    });
    stage = "render";
    self.postMessage({ type: "phase", message: "3Dモデルを生成しています…" });
    engine.FS.writeFile("/input.scad", data.source);
    const status = engine.callMain([
      "/input.scad",
      "--backend=Manifold",
      "--export-format=binstl",
      "-o",
      "/model.stl",
    ]);
    if (status !== 0 || /^(?:ERROR:|Parser error:)/im.test(logs))
      throw new Error(`OpenSCAD exit status: ${status}`);
    if (engine.FS.stat("/model.stl").size > MAX_STL_BYTES) {
      self.postMessage({
        type: "error",
        message:
          "STLが25MBを超えました。分割数（$fn）や形状の数を減らしてください。",
        logs,
      });
      return;
    }
    const bytes = engine.FS.readFile("/model.stl").slice().buffer;
    if (bytes.byteLength < 84) throw new Error("Empty geometry");
    self.postMessage(
      {
        type: "success",
        result: { bytes, logs, elapsedMs: performance.now() - started },
      },
      { transfer: [bytes] },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    log(detail);
    self.postMessage({
      type: "error",
      message:
        stage === "load"
          ? "OpenSCADを読み込めませんでした。通信状態やブラウザの対応状況を確認して、もう一度お試しください。"
          : explainError(logs),
      logs,
    });
  }
};
