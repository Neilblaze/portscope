import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prepareMessages, stripNulls } from "../src/ai/context.js";


describe("stripNulls", () => {
  it("removes null values from objects", () => {
    const input = { a: 1, b: null, c: "hello", d: undefined };
    const result = stripNulls(input);
    assert.deepStrictEqual(result, { a: 1, c: "hello" });
  });

  it("handles nested objects", () => {
    const input = { a: { b: null, c: 1 }, d: "ok" };
    const result = stripNulls(input);
    assert.deepStrictEqual(result, { a: { c: 1 }, d: "ok" });
  });

  it("handles arrays", () => {
    const input = [{ a: null, b: 1 }, { c: null }];
    const result = stripNulls(input);
    assert.deepStrictEqual(result, [{ b: 1 }, {}]);
  });

  it("passes through primitives", () => {
    assert.strictEqual(stripNulls("hello"), "hello");
    assert.strictEqual(stripNulls(42), 42);
    assert.strictEqual(stripNulls(true), true);
    assert.strictEqual(stripNulls(null), null);
  });
});


describe("prepareMessages", () => {
  it("returns empty array for empty messages", () => {
    assert.deepStrictEqual(prepareMessages([]), []);
    assert.deepStrictEqual(prepareMessages(null), []);
  });

  it("keeps all messages when below hot turns threshold", () => {
    const messages = [
      { role: "user", content: "hello" },
      { role: "assistant", text: "hi there" },
    ];
    const result = prepareMessages(messages);
    assert.strictEqual(result.length, 2);
  });

  it("preserves hot context (last N user messages) verbatim", () => {
    const messages = [];
    for (let i = 0; i < 10; i++) {
      messages.push({ role: "user", content: `question ${i}` });
      messages.push({ role: "assistant", text: `answer ${i}` });
    }
    const result = prepareMessages(messages, { hotTurns: 3 });
    // Last 3 user messages should be preserved
    const userMsgs = result.filter((m) => m.role === "user" && !m.toolResults);
    const lastThree = userMsgs.slice(-3);
    assert.ok(lastThree.some((m) => m.content === "question 7"));
    assert.ok(lastThree.some((m) => m.content === "question 8"));
    assert.ok(lastThree.some((m) => m.content === "question 9"));
  });

  it("summarizes old tool results into compact descriptions", () => {
    const messages = [
      { role: "user", content: "list ports" },
      {
        role: "assistant",
        text: "calling tools",
        toolCalls: [{ id: "tc1", name: "list_ports", input: {} }],
      },
      {
        role: "user",
        toolResults: [
          {
            id: "tc1",
            name: "list_ports",
            result: { ports: [{ port: 3000 }, { port: 5000 }, { port: 8080 }] },
          },
        ],
      },
      { role: "assistant", text: "here are 3 ports" },
      { role: "user", content: "question 1" },
      { role: "assistant", text: "answer 1" },
      { role: "user", content: "question 2" },
      { role: "assistant", text: "answer 2" },
      { role: "user", content: "question 3" },
      { role: "assistant", text: "answer 3" },
    ];

    const result = prepareMessages(messages, { hotTurns: 3 });
    const toolMsg = result.find(
      (m) => m.role === "user" && m.toolResults,
    );
    if (toolMsg) {
      const summary = toolMsg.toolResults[0].result;
      // Should be a compact string, not the full object
      assert.ok(typeof summary === "string", "Tool result should be summarized to a string");
      assert.ok(summary.includes("3 port"), `Summary should mention port count: ${summary}`);
    }
  });

  it("strips image data from old user messages", () => {
    const messages = [
      {
        role: "user",
        content: [
          { type: "image", source: { data: "base64data..." } },
          { type: "text", text: "what's in this image?" },
        ],
      },
      { role: "assistant", text: "I see a server" },
      { role: "user", content: "question 1" },
      { role: "assistant", text: "answer 1" },
      { role: "user", content: "question 2" },
      { role: "assistant", text: "answer 2" },
      { role: "user", content: "question 3" },
      { role: "assistant", text: "answer 3" },
    ];

    const result = prepareMessages(messages, { hotTurns: 3 });
    // Old image message should have been flattened to text only
    const oldUserMsg = result[0];
    assert.ok(typeof oldUserMsg.content === "string", "Old image message should be text-only");
    assert.ok(oldUserMsg.content.includes("what's in this image"), "Should preserve text");
  });

  it("respects maxContextTokens budget by pruning old messages", () => {
    const messages = [];
    for (let i = 0; i < 50; i++) {
      messages.push({ role: "user", content: "a ".repeat(500) }); // ~250 tokens each
      messages.push({ role: "assistant", text: "b ".repeat(500) });
    }

    // With a very small budget, should prune cold messages
    const result = prepareMessages(messages, { maxContextTokens: 2000, hotTurns: 2 });
    assert.ok(result.length < messages.length, "Should have pruned some messages");
    assert.ok(result.length >= 4, "Should keep at least hot turns (2 user + 2 assistant)");
  });

  it("does not mutate the original messages array", () => {
    const messages = [
      { role: "user", content: "hello" },
      { role: "assistant", text: "hi" },
    ];
    const original = JSON.stringify(messages);
    prepareMessages(messages);
    assert.strictEqual(JSON.stringify(messages), original, "Original should not be mutated");
  });
});
