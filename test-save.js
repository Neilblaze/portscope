import { saveConversation } from "./src/ai/history.js";
try {
  saveConversation("test_123", { ai: { provider: "openai", model: "gpt-4" } }, [
    { role: "user", content: "hi" }
  ]);
  console.log("Success");
} catch (err) {
  console.error("Error:", err);
}
