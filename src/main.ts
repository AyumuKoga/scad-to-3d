import "./style.css";
import { Engine, RenderError } from "./engine.ts";
import { examples } from "./examples.ts";
import { Viewer } from "./viewer.ts";
import type { ViewName } from "./viewer.ts";
import { formatLength } from "./measurements.ts";
import type { DisplayUnit } from "./measurements.ts";
import { isSourceOversized } from "./policy.ts";
import { downloadFile, readSourceFile } from "./source-file.ts";

const cubeIcon =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="m12 2 9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10M12 2v10"/></svg>';
const arrowIcon =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
const downloadIcon =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></svg>';

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <header class="site-header">
    <a class="brand" href="./" aria-label="SCAD to 3D ホーム"><span class="brand-icon">${cubeIcon}</span><span>SCAD <span class="brand-arrow">→</span> 3D</span></a>
    <span class="local-badge"><span class="dot"></span>コードは端末内で処理</span>
  </header>
  <main>
    <section class="intro">
      <div><h1>コードを、<span>かたちに。</span></h1><p>OpenSCADコードを貼って、3Dで確認。<br class="mobile-break">STLを保存して、ものづくりへ。</p></div>
      <ol class="steps" aria-label="使い方"><li><b>01</b><span>コードを貼る</span></li><li><b>02</b><span>3Dモデル生成</span></li><li><b>03</b><span>3Dで確認</span></li><li><b>04</b><span>STLを保存</span></li></ol>
    </section>
    <div class="workspace">
      <section class="editor-panel panel" aria-labelledby="code-heading">
        <div class="panel-heading"><h2 id="code-heading"><span class="section-index">01</span>SCADコード</h2><div class="file-actions"><button id="open-code" class="text-button" aria-label="SCADファイルを開く">開く</button><button id="save-code" class="text-button" aria-label="SCADコードを保存">コード保存</button><input id="source-file" type="file" accept=".scad" hidden /></div></div>
        <div class="editor-toolbar"><label for="sample">サンプル</label><select id="sample"><option value="">コードを選択…</option>${Object.entries(
          examples,
        )
          .map(([key, item]) => `<option value="${key}">${item.title}</option>`)
          .join(
            "",
          )}</select><button id="clear" class="text-button" title="全選択して削除（取り消し可能）">クリア</button></div>
        <div class="code-surface"><pre id="line-numbers" aria-hidden="true"></pre><textarea id="code" aria-label="OpenSCADコード" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off"></textarea></div>
        <div class="editor-meta"><span id="file-name">model.scad</span><span id="line-count"></span></div>
        <div class="generate-row"><button id="generate" class="primary-button">${cubeIcon}<span>3Dモデル生成</span>${arrowIcon}</button><button id="cancel" class="secondary-button" hidden>中止</button></div>
      </section>
      <section class="preview-panel panel" aria-labelledby="preview-heading">
        <div class="panel-heading"><h2 id="preview-heading"><span class="section-index">02</span>3Dプレビュー</h2><span id="model-state" class="state-badge">生成待ち</span></div>
        <div class="view-toolbar" aria-label="視点の変更">${(
          [
            ["iso", "アイソメ"],
            ["front", "正面"],
            ["back", "背面"],
            ["left", "左"],
            ["right", "右"],
            ["top", "上"],
            ["bottom", "下"],
          ] as const
        )
          .map(
            ([key, title]) =>
              `<button class="view-button ${key === "iso" ? "active" : ""}" data-view="${key}" aria-pressed="${key === "iso"}" disabled>${title}</button>`,
          )
          .join(
            "",
          )}<button id="fit" class="fit-button" title="モデル全体を表示" aria-label="モデル全体を表示" disabled>⛶</button></div>
        <div id="viewport">
          <div id="measurement-overlay" hidden><span id="dimensions"></span><span id="grid-scale"></span></div>
          <div id="empty-state"><div class="empty-icon">${cubeIcon}</div><h3>アイデアが、ここでかたちになる。</h3><p>コードを貼り付けて「3Dモデル生成」を押してください。<br>まずはサンプルでも試せます。</p></div>
          <div id="loading" hidden><span class="spinner"></span><strong>3Dモデルを生成しています…</strong><span id="phase"></span><small>最大60秒で停止します。いつでも中止できます。</small></div>
          <div class="axis-key" aria-label="軸の色"><span class="x">X</span><span class="y">Y</span><span class="z">Z</span></div>
        </div>
        <div class="preview-meta"><span id="model-info">モデルはまだ生成されていません</span><label class="unit-selector" for="display-unit">目盛り<select id="display-unit"><option value="cm">cm</option><option value="mm">mm</option></select></label></div>
        <div class="download-row"><button id="download" class="download-button" disabled>${downloadIcon}<span>STLをダウンロード</span></button><span id="download-note">生成したモデルを保存できます</span></div>
      </section>
    </div>
    <section id="feedback" class="feedback" hidden aria-live="polite"><p id="status"></p><button id="restore-viewer" class="secondary-button" hidden>3D表示を再開</button><details id="log-details"><summary>OpenSCADのメッセージを確認</summary><pre id="logs"></pre></details></section>
    <div class="below-workspace"><p><span class="small-cube">◇</span> ドラッグで回転 <span>·</span> ホイールでズーム <span>·</span> 右ドラッグで移動 <span class="touch-help">／ タッチ：1本指で回転、2本指でズーム・移動</span></p><details class="help"><summary>使い方と対応範囲</summary><p>ChatGPT・Gemini・Claudeなどで生成したOpenSCADコードを貼り付けてください。コードを囲む \`\`\` は不要です。生成後は視点を切り替えて確認し、STLをBambu Studio・PrusaSlicer・Curaなどで開けます。</p><p>外部ファイルを使う include / use / import / surface、追加フォントは利用できません。2D形状は立体化してください。複雑なモデルは分割数（$fn）を下げると軽くなります。STLは色や単位情報を持ちません。スライサーではmmとして読み込んでください。</p><p>入力コードとモデルは端末内で処理され、サーバーへ送信されません。このページを閉じると入力内容は失われます。必要なコードは「コード保存」でSCADファイルとして保存できます。「開く」で再度読み込めます。Ctrl/Cmd+Enterで生成、Ctrl/Cmd+Sでコードを保存できます。</p></details></div>
  </main>
  <footer><span>アイデアから、ものづくりへ。</span><div><span class="privacy-icon">◇</span> コードはサーバーに送信されません<span class="footer-divider">|</span><a href="./licenses.html" target="_blank" rel="noopener">Open source & ライセンス ↗</a></div></footer>
  <dialog id="sample-dialog" aria-labelledby="replace-heading" aria-describedby="replace-description"><h2 id="replace-heading">コードを置き換えますか？</h2><p id="replace-description">編集中のコードが置き換わります。必要なコードは先に保存してください。</p><div><button id="sample-cancel" class="secondary-button">戻る</button><button id="sample-confirm" class="primary-button">サンプルを開く</button></div></dialog>
`;

function element<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}
const code = element<HTMLTextAreaElement>("code");
const generate = element<HTMLButtonElement>("generate");
const download = element<HTMLButtonElement>("download");
const cancel = element<HTMLButtonElement>("cancel");
const sample = element<HTMLSelectElement>("sample");
const engine = new Engine();
let viewer: Viewer | undefined;
let viewerFailed = false;
let busy = false;
let output: { source: string; bytes: ArrayBuffer } | undefined;
let lastLoaded: string = examples.bracket.code;
let pendingReplacement: { source: string; filename: string } | undefined;
let filename = "model.scad";
let fileReadSequence = 0;
let oversized = false;
const saveCode = element<HTMLButtonElement>("save-code");
const fileInput = element<HTMLInputElement>("source-file");
let measurements:
  | { dimensions: { x: number; y: number; z: number }; gridStep: number }
  | undefined;
const displayUnit = element<HTMLSelectElement>("display-unit");
code.value = lastLoaded;

function updateMeasurements() {
  const unit = displayUnit.value as DisplayUnit;
  viewer?.setDisplayUnit(unit);
  element("measurement-overlay").hidden = !measurements;
  if (!measurements) return;
  const { dimensions, gridStep } = measurements;
  element("dimensions").textContent =
    `X ${formatLength(dimensions.x, unit)} · Y ${formatLength(dimensions.y, unit)} · Z ${formatLength(dimensions.z, unit)}`;
  element("grid-scale").textContent =
    `グリッド1マス = ${formatLength(gridStep, unit)} · コード/STLはmm`;
}
displayUnit.addEventListener("change", updateMeasurements);

function updateEditor() {
  oversized = isSourceOversized(code.value);
  // Limit gutter work for pasted text; rendering already rejects larger input.
  const count = oversized ? 0 : code.value.split("\n").length;
  saveCode.disabled = !code.value.trim() || oversized;
  element("file-name").textContent = filename;
  element("file-name").title = filename;
  code.setAttribute("aria-invalid", String(oversized));
  element("line-numbers").textContent = Array.from(
    { length: count },
    (_, i) => i + 1,
  ).join("\n");
  element("line-count").textContent = oversized
    ? "200KBを超えています"
    : `${count} 行`;
  syncLines();
  updateState();
}
function syncLines() {
  element("line-numbers").scrollTop = code.scrollTop;
}
function updateState() {
  const current = output?.source === code.value;
  download.disabled = busy || !current || viewerFailed;
  generate.disabled = busy || viewerFailed || oversized;
  element("restore-viewer").hidden = !viewerFailed;
  document
    .querySelectorAll<HTMLButtonElement>("[data-view], #fit")
    .forEach((button) => {
      button.disabled = !output || viewerFailed;
    });
  cancel.hidden = !busy;
  element("loading").hidden = !busy;
  element("empty-state").hidden = Boolean(output) || busy;
  element("model-state").textContent = busy
    ? "生成中"
    : output
      ? current
        ? "生成済み"
        : "変更が未反映"
      : "生成待ち";
  element("model-state").className =
    `state-badge ${output && !current ? "stale" : current ? "ready" : ""}`;
  element("download-note").textContent =
    output && !current
      ? "コードが変更されています。再生成してください。"
      : "STL形式 · スライサーで開けます";
  element("viewport").setAttribute("aria-busy", String(busy));
}
function feedback(message: string, logs = "", error = false) {
  element("feedback").hidden = false;
  element("feedback").classList.toggle("error", error);
  element("status").textContent = message;
  element("logs").textContent = logs;
  element("log-details").hidden = !logs;
  element<HTMLDetailsElement>("log-details").open = error && Boolean(logs);
}
function setViewButton(view: string) {
  document
    .querySelectorAll<HTMLButtonElement>("[data-view]")
    .forEach((button) => {
      const active = button.dataset.view === view;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
}

code.addEventListener("input", updateEditor);
code.addEventListener("paste", (event) => {
  if (!event.clipboardData) return;
  const pasted = event.clipboardData.getData("text/plain");
  const next =
    code.value.slice(0, code.selectionStart) +
    pasted +
    code.value.slice(code.selectionEnd);
  if (isSourceOversized(next)) {
    event.preventDefault();
    feedback(
      "コードが200KBを超えるため貼り付けませんでした。内容を短くしてお試しください。入力中のコードは残っています。",
      "",
      true,
    );
  }
});
code.addEventListener("scroll", syncLines);
code.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    if (!generate.disabled) generate.click();
  }
});
// execCommand preserves the native textarea undo history in current browsers.
element("clear").addEventListener("click", () => {
  code.focus();
  code.select();
  if (!document.execCommand("delete")) {
    feedback(
      "全選択しました。Deleteキーまたはキーボードの削除で消してください。",
    );
  }
  updateEditor();
});
function loadSource(next: { source: string; filename: string }) {
  code.value = next.source;
  filename = next.filename;
  lastLoaded = code.value;
  code.scrollTop = 0;
  updateEditor();
  code.focus();
  sample.value = "";
}
function replaceSource(
  next: { source: string; filename: string },
  isSample: boolean,
) {
  if (code.value.trim() && code.value !== lastLoaded) {
    pendingReplacement = next;
    element("replace-heading").textContent = isSample
      ? "サンプルに切り替えますか？"
      : "ファイルを開きますか？";
    element("replace-description").textContent =
      "編集中のコードが置き換わります。必要なコードは先に「コード保存」で保存してください。";
    element("sample-confirm").textContent = isSample
      ? "サンプルを開く"
      : "ファイルを開く";
    element<HTMLDialogElement>("sample-dialog").showModal();
  } else loadSource(next);
}
sample.addEventListener("change", () => {
  if (!sample.value) return;
  const key = sample.value as keyof typeof examples;
  replaceSource({ source: examples[key].code, filename: `${key}.scad` }, true);
});
function closeSampleDialog() {
  pendingReplacement = undefined;
  sample.value = "";
  element<HTMLDialogElement>("sample-dialog").close();
}
element("sample-cancel").addEventListener("click", closeSampleDialog);
element("sample-confirm").addEventListener("click", () => {
  if (pendingReplacement) loadSource(pendingReplacement);
  closeSampleDialog();
});
element("sample-dialog").addEventListener("cancel", () => {
  pendingReplacement = undefined;
  sample.value = "";
});
element("open-code").addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  fileInput.value = "";
  if (!file) return;
  const sequence = ++fileReadSequence;
  try {
    const next = await readSourceFile(file);
    if (sequence === fileReadSequence) replaceSource(next, false);
  } catch (error) {
    if (sequence === fileReadSequence)
      feedback(
        error instanceof Error ? error.message : "ファイルを開けませんでした。",
        "",
        true,
      );
  }
});
saveCode.addEventListener("click", () => {
  if (!code.value.trim() || oversized) return;
  downloadFile(code.value, filename, "text/plain;charset=utf-8");
});
window.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    if (!saveCode.disabled) saveCode.click();
  }
});

generate.addEventListener("click", async () => {
  const source = code.value;
  busy = true;
  element("feedback").hidden = true;
  element("phase").textContent = "処理を開始しています…";
  updateState();
  try {
    const result = await engine.render(
      source,
      new URL(import.meta.env.BASE_URL, document.baseURI).href,
      (phase) => {
        element("phase").textContent = phase;
      },
    );
    const stats = viewer!.setModel(result.bytes);
    measurements = stats;
    updateMeasurements();
    output = { source, bytes: result.bytes };
    setViewButton("iso");
    document
      .querySelectorAll<HTMLButtonElement>("[data-view], #fit")
      .forEach((button) => {
        button.disabled = false;
      });
    element("model-info").textContent =
      `${stats.triangles.toLocaleString()} 三角形 · ${(result.elapsedMs / 1000).toFixed(1)}秒`;
    const warning = /warning:/i.test(result.logs);
    feedback(
      warning
        ? "モデルを生成しました。OpenSCADからの注意事項を確認してください。"
        : "3Dモデルを生成しました。形状を確認して、STLを保存できます。",
      result.logs,
    );
  } catch (error) {
    if (viewerFailed) return;
    feedback(
      error instanceof Error ? error.message : "生成に失敗しました。",
      error instanceof RenderError ? error.logs : "",
      true,
    );
  } finally {
    busy = false;
    updateState();
  }
});
cancel.addEventListener("click", () => engine.cancel());
document
  .querySelectorAll<HTMLButtonElement>("[data-view]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      viewer?.fit(button.dataset.view as ViewName);
      setViewButton(button.dataset.view!);
    });
  });
element("fit").addEventListener("click", () => {
  viewer?.fit("iso");
  setViewButton("iso");
});
download.addEventListener("click", () => {
  if (!output || output.source !== code.value || busy || viewerFailed) return;
  downloadFile(output.bytes, filename.replace(/\.scad$/i, ".stl"), "model/stl");
});

function startViewer() {
  viewer?.dispose();
  viewer = undefined;
  try {
    if (!("WebAssembly" in window) || !("Worker" in window))
      throw new Error(
        "このブラウザではOpenSCADを実行できません。最新のChrome・Edge・Safariをお使いください。",
      );
    viewer = new Viewer(element("viewport"), () => {
      viewerFailed = true;
      engine.cancel();
      feedback(
        "3D表示が停止しました。「3D表示を再開」を押してください。入力コードは残っています。繰り返す場合は分割数（$fn）を減らしてください。",
        "",
        true,
      );
      updateState();
    });
    viewerFailed = false;
    if (output) {
      measurements = viewer.setModel(output.bytes);
      updateMeasurements();
      setViewButton("iso");
    }
  } catch (error) {
    viewerFailed = true;
    feedback(
      `3D表示を開始できませんでした。WebGL2が利用できるブラウザでお試しください。${error instanceof Error ? ` (${error.message})` : ""}`,
      "",
      true,
    );
  }
  updateState();
}
element("restore-viewer").addEventListener("click", () => {
  startViewer();
  if (!viewerFailed) feedback("3D表示を再開しました。");
});
startViewer();
updateEditor();
window.addEventListener("pagehide", () => engine.cancel());
window.addEventListener("beforeunload", (event) => {
  if (code.value !== lastLoaded) {
    event.preventDefault();
    event.returnValue = "";
  }
});
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    engine.cancel();
    viewer?.dispose();
  });
