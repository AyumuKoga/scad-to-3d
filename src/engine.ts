import { TIMEOUT_MS, validateSource } from "./policy.ts";

export type RenderResult = {
  bytes: ArrayBuffer;
  logs: string;
  elapsedMs: number;
};
export class RenderError extends Error {
  logs: string;
  constructor(message: string, logs = "") {
    super(message);
    this.name = "RenderError";
    this.logs = logs;
  }
}

type WorkerLike = Pick<
  Worker,
  "onmessage" | "onerror" | "onmessageerror" | "postMessage" | "terminate"
>;

export class Engine {
  private stopCurrent?: () => void;
  private makeWorker: () => WorkerLike;
  private timeoutMs: number;
  constructor(
    makeWorker: () => WorkerLike = () =>
      new Worker(new URL("./scad.worker.ts", import.meta.url), {
        type: "module",
      }),
    timeoutMs = TIMEOUT_MS,
  ) {
    this.makeWorker = makeWorker;
    this.timeoutMs = timeoutMs;
  }

  cancel() {
    this.stopCurrent?.();
  }

  async render(
    source: string,
    assetBase: string,
    onPhase: (phase: string) => void,
  ): Promise<RenderResult> {
    validateSource(source);
    this.cancel();
    return new Promise((resolve, reject) => {
      let worker: WorkerLike;
      try {
        worker = this.makeWorker();
      } catch (error) {
        reject(
          new RenderError(
            "処理エンジンを起動できませんでした。ブラウザの設定を確認して、もう一度生成してください。",
            String(error),
          ),
        );
        return;
      }
      let finished = false;
      const finish = (error?: Error, result?: RenderResult) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        worker.terminate();
        this.stopCurrent = undefined;
        if (error) reject(error);
        else resolve(result!);
      };
      const timer = setTimeout(
        () =>
          finish(
            new RenderError(
              "処理時間の上限に達したため停止しました。形状の数や分割数（$fn）を減らして再生成してください。",
            ),
          ),
        this.timeoutMs,
      );
      this.stopCurrent = () =>
        finish(
          new RenderError(
            "生成を中止しました。コードを調整して、もう一度生成できます。",
          ),
        );
      worker.onerror = (event) => {
        event.preventDefault();
        finish(
          new RenderError(
            "処理エンジンを実行できませんでした。ブラウザを更新するか、モデルを簡単にして再試行してください。",
            event.message,
          ),
        );
      };
      worker.onmessageerror = () =>
        finish(
          new RenderError(
            "処理結果を受け取れませんでした。もう一度生成してください。",
          ),
        );
      worker.onmessage = ({ data }) => {
        if (finished) return;
        if (data.type === "phase") onPhase(data.message);
        else if (data.type === "success") finish(undefined, data.result);
        else if (data.type === "error")
          finish(new RenderError(data.message, data.logs));
      };
      try {
        worker.postMessage({ source, assetBase });
      } catch (error) {
        finish(
          new RenderError(
            "コードを処理エンジンへ渡せませんでした。もう一度お試しください。",
            String(error),
          ),
        );
      }
    });
  }
}
