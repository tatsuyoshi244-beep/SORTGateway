import test from "node:test";
import assert from "node:assert/strict";
import { cleanFilename, fallbackAnswer, queryTerms, rankChunks, splitIntoChunks } from "../src/core.js";

test("Japanese intent phrases retrieve the relevant procedure first", () => {
  const rows = [
    { manual_id: "open", title: "開店前の準備", category: "店舗業務", summary: "出勤後、営業を始める前", keywords: "開店、出勤", content: "道具を点検し、責任者へ準備完了を報告する。" },
    { manual_id: "handover", title: "業務の申し送り", category: "引き継ぎ", summary: "交代時に未完了作業を伝える", keywords: "交代", content: "次に行うことを記録する。" },
  ];
  const matches = rankChunks("出勤したあと開店までに何を準備する", rows);
  assert.equal(matches[0].manual_id, "open");
  assert.equal(matches.some((match) => match.manual_id === "handover"), false);
});

test("Japanese terms include useful bigrams and normalize full-width text", () => {
  const terms = queryTerms("ＡＢＣ　開店準備");
  assert.ok(terms.includes("abc"));
  assert.ok(terms.includes("開店"));
  assert.ok(terms.includes("準備"));
});

test("long manual text is divided into overlapping chunks without losing the tail", () => {
  const text = "あ".repeat(1600);
  const chunks = splitIntoChunks(text, 700, 100);
  assert.equal(chunks.length, 3);
  assert.equal(chunks.at(-1).length, 400);
  assert.ok(chunks[0].endsWith(chunks[1].slice(0, 100)));
});

test("filenames cannot inject a path and fallback answer cites source content", () => {
  assert.equal(cleanFilename("../../社員名簿.pdf"), ".._.._社員名簿.pdf");
  const answer = fallbackAnswer([{ manual_id: "m1", title: "開店前の準備", content: "道具を点検する" }]);
  assert.match(answer, /開店前の準備/);
  assert.match(answer, /道具を点検する/);
});
