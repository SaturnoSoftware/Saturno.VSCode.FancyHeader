import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

describe("marketplace identity", () => {
  it("publisher and name never change", () => {
    const pkgPath = path.join(__dirname, "..", "..", "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    assert.strictEqual(pkg.publisher, "SaturnoSoftware");
    assert.strictEqual(pkg.name, "saturno-fancy-header");
  });
});
