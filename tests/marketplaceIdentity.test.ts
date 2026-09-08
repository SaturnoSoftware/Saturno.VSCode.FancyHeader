import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

// WSPROC-0102: o id de uma extensao no marketplace do VS Code e publisher + name do
// package.json. Se qualquer um dos dois mudar, o VS Code trata como extensao NOVA - quem
// ja instalou nunca recebe update, a contagem de instalacao zera, e a avaliacao some. Nao
// ha desfazer sem republicar sob o id antigo. Valores literais de proposito: e a unica
// forma deste teste significar alguma coisa.
describe("marketplace identity (WSPROC-0102)", () => {
  it("publisher and name never change", () => {
    const pkgPath = path.join(__dirname, "..", "..", "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    assert.strictEqual(pkg.publisher, "SaturnoSoftware");
    assert.strictEqual(pkg.name, "saturno-fancy-header");
  });
});
