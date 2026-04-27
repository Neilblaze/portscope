import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toAnthropicImageContent, toOpenAIImageContent, extractImages } from "../src/ai/image.js";

describe("extractImages", () => {
  it("extracts valid image paths", () => {
    const input = "What's in this image? ./screenshot.png";
    const result = extractImages(input);
    assert.equal(result.images.length, 0);
    assert.equal(result.errors.length, 1);
  });
});

describe("toAnthropicImageContent", () => {
  it("formats image correctly", () => {
    const result = toAnthropicImageContent("text", [{ mimeType: "image/png", base64: "base64data" }]);
    assert.equal(result.length, 2);
    assert.equal(result[0].type, "image");
    assert.equal(result[1].type, "text");
    assert.equal(result[1].text, "text");
  });
});

describe("toOpenAIImageContent", () => {
  it("formats image correctly", () => {
    const result = toOpenAIImageContent("text", [{ mimeType: "image/png", base64: "base64data" }]);
    assert.equal(result.length, 2);
    assert.equal(result[0].type, "image_url");
    assert.equal(result[1].type, "text");
    assert.equal(result[1].text, "text");
  });
});
