/**
 * FANCYHDR-0034: "the target of performance in an editor extension is cost per save, because
 * that is where the header gets written. Measure, do not estimate." This extension has no
 * automatic save hook (no `onWillSaveTextDocument`) - the hot path is `buildHeader` plus the
 * `hasGeneratedHeaderAtDocumentStart` duplicate check that must run before every insertion
 * (FANCYHDR-0001), both run once per command invocation. That invocation is what gets measured.
 */
import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { buildHeader, hasGeneratedHeaderAtDocumentStart, CommentSyntax, HeaderTemplateData } from "../Source/formatting";

const cStyleSyntax: CommentSyntax = {
  singleLineStart: "//",
  singleLineEnd: "",
  multiLineStart: "/*",
  multiLineMiddle: "*",
  multiLineEnd: "*/",
};

const sampleData: HeaderTemplateData = {
  fileName: "feature.ts",
  projectName: "saturno-project",
  date: "2026-05-28",
  lastModified: "2026-06-01",
  copyrightYear: "2024 - 2026",
  copyrightOwner: "Saturno Software",
  userName: "Mateus",
  userEmail: "mateus@saturno.software",
};

function median(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function timeCallMicros(fn: () => void, iterations: number): number {
  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint();
    fn();
    const end = process.hrtime.bigint();
    samples.push(Number(end - start) / 1000); // ns -> us
  }
  return median(samples);
}

describe("formatting latency (measured)", () => {
  it("buildHeader: median call time is well under one editor frame", () => {
    const micros = timeCallMicros(() => buildHeader(cStyleSyntax, sampleData), 2000);
    console.log(`  buildHeader: median ${micros.toFixed(2)}us over 2000 calls`);
    // 1000us (1ms) leaves two orders of magnitude below the ~16ms budget of a single 60fps
    // editor frame, and this runs once per save command, not per frame - generous on purpose.
    assert.ok(micros < 1000, `buildHeader median ${micros.toFixed(2)}us exceeds the 1000us guard`);
  });

  it("hasGeneratedHeaderAtDocumentStart: median call time on a realistic file is well under one editor frame", () => {
    const header = buildHeader(cStyleSyntax, sampleData);
    const body = header + Array.from({ length: 300 }, (_, i) => `const line${i} = ${i};`).join("\n");
    const micros = timeCallMicros(() => hasGeneratedHeaderAtDocumentStart(body, cStyleSyntax), 2000);
    console.log(`  hasGeneratedHeaderAtDocumentStart (300-line doc): median ${micros.toFixed(2)}us over 2000 calls`);
    assert.ok(micros < 1000, `hasGeneratedHeaderAtDocumentStart median ${micros.toFixed(2)}us exceeds the 1000us guard`);
  });
});
