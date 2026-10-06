const CJK = /[\u3040-\u30ff\u3400-\u9fff]/u;
const STOP = new Set(["これ", "それ", "ここ", "ため", "から", "まで", "について", "場合", "こと", "もの", "ください", "します", "する", "です", "ます", "など", "教えて", "知りたい"]);

export function queryTerms(input) {
  const text = String(input || "").normalize("NFKC").toLocaleLowerCase("ja-JP").trim();
  const pieces = text.split(/[\s、。,.!?！？:：;；/\\()[\]{}]+/u).filter(Boolean);
  const terms = new Set(pieces.filter((part) => part.length > 1 && !STOP.has(part)));
  for (const part of pieces) {
    const chars = [...part];
    if (chars.length < 2) continue;
    for (let i = 0; i < chars.length - 1; i++) {
      const pair = chars[i] + chars[i + 1];
      if (CJK.test(pair) && !STOP.has(pair)) terms.add(pair);
    }
  }
  return [...terms].slice(0, 50);
}

export function rankChunks(query, rows, limit = 6) {
  const q = String(query || "").normalize("NFKC").toLocaleLowerCase("ja-JP");
  const terms = queryTerms(q);
  if (!terms.length) return [];
  return rows.map((row) => {
    const title = String(row.title || "").toLocaleLowerCase("ja-JP");
    const meta = `${row.category || ""} ${row.summary || ""} ${row.keywords || ""}`.toLocaleLowerCase("ja-JP");
    const body = String(row.content || "").toLocaleLowerCase("ja-JP");
    let score = title.includes(q) ? 12 : 0;
    if (meta.includes(q)) score += 6;
    for (const term of terms) {
      if (title.includes(term)) score += term.length > 2 ? 4 : 2;
      if (meta.includes(term)) score += term.length > 2 ? 2.5 : 1;
      if (body.includes(term)) score += term.length > 2 ? 1.4 : 0.7;
    }
    return { ...row, score };
  }).filter((row) => row.score >= 1.2).sort((a, b) => b.score - a.score).slice(0, limit);
}

export function splitIntoChunks(value, size = 700, overlap = 120) {
  const text = String(value || "").replace(/\r\n/g, "\n").trim();
  if (!text) return [];
  const chars = [...text];
  const chunks = [];
  for (let start = 0; start < chars.length; start += size - overlap) {
    const piece = chars.slice(start, start + size).join("").trim();
    if (piece) chunks.push(piece);
    if (start + size >= chars.length) break;
  }
  return chunks;
}

export function cleanFilename(name) {
  return String(name || "資料").normalize("NFKC").replace(/[\\/\r\n\u0000-\u001f]/g, "_").slice(0, 160) || "資料";
}

export function fallbackAnswer(matches) {
  if (!matches.length) return "登録されたマニュアルから関連する手順を見つけられませんでした。質問の言葉を変えるか、管理者へ登録を相談してください。";
  const excerpts = [...new Map(matches.map((m) => [m.manual_id, m])).values()].slice(0, 3).map((m) => `・${m.title}: ${String(m.content).slice(0, 260)}`);
  return `関連する記述を見つけました。参照したマニュアルの該当箇所を確認してください。\n\n${excerpts.join("\n\n")}`;
}
