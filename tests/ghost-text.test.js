import { describe, it } from "node:test";
import assert from "node:assert";
import { findSuggestion, getAllCommands } from "../src/ui/ghost-text.js";

describe("findSuggestion", () => {
  it("suggests slash commands", () => {
    assert.strictEqual(findSuggestion("/prov"), "ider");
    assert.strictEqual(findSuggestion("/mod"), "els");
    assert.strictEqual(findSuggestion("/sta"), "tus");
    assert.strictEqual(findSuggestion("/cle"), "ar");
    assert.strictEqual(findSuggestion("/his"), "tory [n]");
    assert.strictEqual(findSuggestion("/loa"), "d <n>");
    assert.strictEqual(findSuggestion("/exp"), "ort [md|html|txt]");
    assert.strictEqual(findSuggestion("/hel"), "p");
    assert.strictEqual(findSuggestion("/exi"), "t");
  });

  it("suggests direct commands", () => {
    assert.strictEqual(findSuggestion("kil"), "l <port|pid|range|all>");
    assert.strictEqual(findSuggestion("pau"), "se <port|pid>");
    assert.strictEqual(findSuggestion("res"), "ume <port|pid>");
    assert.strictEqual(findSuggestion("p"), "s [--all]");
    assert.strictEqual(findSuggestion("lis"), "t [--all]");
    assert.strictEqual(findSuggestion("log"), "s <port> [-f] [--lines N] [--err]");
    assert.strictEqual(findSuggestion("cle"), "an");
    assert.strictEqual(findSuggestion("wat"), "ch");
    assert.strictEqual(findSuggestion("insp"), "ect <port>");
    assert.strictEqual(findSuggestion("hel"), "p");
    assert.strictEqual(findSuggestion("exi"), "t");
    assert.strictEqual(findSuggestion("qui"), "t");
  });

  it("suggests 'all' for kill command", () => {
    assert.strictEqual(findSuggestion("kill a"), "ll");
    assert.strictEqual(findSuggestion("kill al"), "l");
  });

  it("suggests --all for ps/list commands", () => {
    assert.strictEqual(findSuggestion("ps -"), "-all");
    assert.strictEqual(findSuggestion("ps --a"), "ll");
    assert.strictEqual(findSuggestion("list -"), "-all");
    assert.strictEqual(findSuggestion("list --a"), "ll");
    assert.strictEqual(findSuggestion("ports -"), "-all");
  });

  it("suggests flags for logs command", () => {
    assert.strictEqual(findSuggestion("logs 3000 -"), "f");
    assert.strictEqual(findSuggestion("logs 3000 --l"), "ines");
    assert.strictEqual(findSuggestion("logs 3000 --e"), "rr");
  });

  it("returns null for complete commands", () => {
    assert.strictEqual(findSuggestion("/provider"), null);
    assert.strictEqual(findSuggestion("kill"), null);
    assert.strictEqual(findSuggestion("ps"), null);
  });

  it("returns null for port numbers", () => {
    assert.strictEqual(findSuggestion("3000"), null);
    assert.strictEqual(findSuggestion("8080"), null);
    assert.strictEqual(findSuggestion("5173"), null);
  });

  it("returns null for empty input", () => {
    assert.strictEqual(findSuggestion(""), null);
    assert.strictEqual(findSuggestion("   "), null);
  });

  it("returns null for unknown commands", () => {
    assert.strictEqual(findSuggestion("xyz"), null);
    assert.strictEqual(findSuggestion("/unknown"), null);
  });

  it("handles commands with trailing spaces", () => {
    assert.strictEqual(findSuggestion("kill "), null);
    assert.strictEqual(findSuggestion("/provider "), null);
  });

  it("suggests only the completion part", () => {
    const suggestion = findSuggestion("ki");
    assert.strictEqual(suggestion, "ll <port|pid|range|all>");
    
    const slashSuggestion = findSuggestion("/pr");
    assert.strictEqual(slashSuggestion, "ovider");
  });
});

describe("getAllCommands", () => {
  it("returns slash and direct commands", () => {
    const { slashCommands, directCommands } = getAllCommands();
    
    assert.ok(Array.isArray(slashCommands));
    assert.ok(Array.isArray(directCommands));
    
    assert.ok(slashCommands.length > 0);
    assert.ok(directCommands.length > 0);
  });

  it("slash commands have required fields", () => {
    const { slashCommands } = getAllCommands();
    
    for (const cmd of slashCommands) {
      assert.ok(cmd.name);
      assert.ok(cmd.desc);
      assert.ok(cmd.name.startsWith("/"));
    }
  });

  it("direct commands have required fields", () => {
    const { directCommands } = getAllCommands();
    
    for (const cmd of directCommands) {
      assert.ok(cmd.name);
      assert.ok(cmd.desc);
      assert.ok(!cmd.name.startsWith("/"));
    }
  });
});
