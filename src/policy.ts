export const MAX_CODE_BYTES = 200_000;
export const MAX_STL_BYTES = 25_000_000;
export const MAX_LOG_CHARS = 64_000;
export const TIMEOUT_MS = 60_000;

export function isSourceOversized(source: string): boolean {
  // Avoid allocating an encoded copy of an already oversized paste.
  return (
    source.length > MAX_CODE_BYTES ||
    new TextEncoder().encode(source).byteLength > MAX_CODE_BYTES
  );
}

// Preserve offsets and line breaks while ignoring comments and quoted strings.
export function maskCommentsAndStrings(source: string): string {
  return source.replace(
    /\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\n]*|"(?:\\[\s\S]|[^"\\])*(?:"|$)/g,
    (match) => match.replace(/[^\n]/g, " "),
  );
}

export function validateSource(source: string): void {
  if (isSourceOversized(source)) {
    throw new Error("コードが大きすぎます。200KB以下に短くしてください。");
  }
  const masked = maskCommentsAndStrings(source);
  if (!masked.trim()) throw new Error("OpenSCADコードを入力してください。");
  if (masked.includes("```"))
    throw new Error(
      "コードを囲む ``` を取り除き、OpenSCADコードだけを貼り付けてください。",
    );
  const blocked = /\b(include|use)\b|\b(import|surface)\s*\(/.exec(masked);
  if (blocked) {
    const line = masked.slice(0, blocked.index).split("\n").length;
    throw new Error(
      `${line}行目：外部ファイルを使う ${blocked[1] ?? blocked[2]} は利用できません。1つのコードで完結する形にしてください。`,
    );
  }
}

export function explainError(logs: string): string {
  const line = /(?:line\s+|line:\s*)(\d+)/i.exec(logs)?.[1];
  if (/memory|out of bounds|allocation|OOM/i.test(logs)) {
    return "モデルの処理に必要なメモリが足りません。分割数（$fn）や形状の数を減らしてください。";
  }
  if (/not a 3D object|top level object is empty|empty geometry/i.test(logs)) {
    return "立体が生成されませんでした。形状を追加するか、2D形状を linear_extrude() などで立体にしてください。";
  }
  return line
    ? `OpenSCADコードの${line}行目付近に問題があります。かっこやセミコロンなどを確認してください。`
    : "3Dモデルを生成できませんでした。下のOpenSCADメッセージを確認してください。";
}
