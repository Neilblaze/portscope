# AI Usage Policy for Contributors

We believe in developer velocity and actively encourage the use of AI tools (like GitHub Copilot, Cursor, Claude, ChatGPT, or local LLMs) to enhance your workflow. However, to maintain the usability, security, and integrity of the codebase, we ask all contributors to adhere to the following guidelines.

## 1. You Own Your Commits
AI is a powerful assistant, but **you are ultimately responsible** for the code you submit.
- **No blind copy-pasting:** Never merge raw, unreviewed AI output.
- **Understand the logic:** If a maintainer asks how a specific algorithm, regex, or module within your PR works, you must be able to explain it.
- **Adhere to conventions:** Ensure the AI-generated code perfectly aligns with our existing architecture, variable naming schemes, and style standards.

## 2. Testing and Validation
LLMs can occasionally hallucinate APIs, invent ghost dependencies, or write plausible-looking logic that masks hidden edge cases.
- Always run the test suite and verify your code locally across supported environments.
- If the AI writes a complex utility (e.g., process string parsing or cross-platform command execution), ensure rigorous unit and smoke tests are included.

## 3. Security and Privacy
- **Never submit sensitive information** (e.g., API keys, personal machine data, proprietary credentials) into public LLM prompts while debugging.
- PortScope relies heavily on parsing local system environments (active ports, PIDs, file directories). Ensure that no AI-generated code unexpectedly alters local environments or inadvertently introduces telemetry/data exfiltration.

## 4. Licensing and Plagiarism
PortScope is licensed under the permissive Apache-2.0 open-source license.
- Ensure your AI assistants are not configured to plagiarize restrictive, copyleft (e.g., GPL) licensed source code.
- Generating boilerplate or generic traversal logic is completely fine, but verify that prompts do not pull proprietary corporate algorithms into the codebase.

## 5. Transparency
We don’t require you to comment on every single AI-autocompleted line in your code. However, if you utilized an LLM to architect a significant new feature, map out a complex regex parser, or re-write a core module, adding a brief note in your PR description helps reviewers understand the context.

---

> [!TIP]
> **TL;DR:** Use AI to code faster, but review it like a human. Write tests, protect environment secrets, and deeply own whatever you merge!
