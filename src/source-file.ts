import { MAX_CODE_BYTES } from "./policy.ts";

export async function readSourceFile(
  file: Pick<File, "name" | "size" | "arrayBuffer">,
) {
  if (!/\.scad$/i.test(file.name))
    throw new Error(".scad形式のファイルを選んでください。");
  if (file.size > MAX_CODE_BYTES)
    throw new Error(
      "ファイルが大きすぎます。200KB以下のSCADファイルを選んでください。",
    );
  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    throw new Error(
      "ファイルを読み込めませんでした。端末に保存されているか確認して、もう一度選んでください。",
    );
  }
  if (buffer.byteLength > MAX_CODE_BYTES)
    throw new Error(
      "ファイルが大きすぎます。200KB以下のSCADファイルを選んでください。",
    );
  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw new Error(
      "文字コードを読み取れませんでした。UTF-8で保存したSCADファイルを選んでください。",
    );
  }
  if (!source.trim() || source.includes("\0"))
    throw new Error(
      "ファイルにOpenSCADコードが見つかりません。内容を確認してください。",
    );
  return { source, filename: safeSourceName(file.name) };
}

export function safeSourceName(name: string) {
  const stem = name
    .replace(/\.scad$/i, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, "_")
    .slice(0, 100)
    .trim();
  return `${stem || "model"}.scad`;
}

export function downloadFile(
  contents: BlobPart,
  filename: string,
  type: string,
) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Safari may consume the Blob asynchronously after the click.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
