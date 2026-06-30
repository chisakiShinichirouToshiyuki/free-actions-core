# free-actions-core

Expose any remote **MCP server** as ChatGPT-compatible **OpenAPI Actions**.

A vendor-neutral *"mcp-mimic"* bridge: instead of one OpenAPI operation per tool
(which hits the Custom-GPT ~30-operation limit and needs editing every time a
tool changes), it exposes **two generic operations** that mirror the MCP
handshake:

| Operation | Maps to | Purpose |
|---|---|---|
| `GET /tools` | `tools/list` | Discovery — returns every tool + its `inputSchema` |
| `POST /call` | `tools/call` | Dispatch — `{ "tool": "...", "arguments": {...} }` |

The GPT calls `listTools` first to learn what exists, then `callTool` to invoke.
New MCP tools appear automatically with **no schema edit**.

## Why

Custom GPTs (GPT Builder) cannot speak MCP — they only consume OpenAPI Actions.
This package lets you put your MCP server behind a GPT with **zero per-user
auth**: the bridge holds one shared credential server-side, so a trial user just
opens the GPT and starts calling tools. (OpenAI's own guidance recommends
no-auth for first-touch flows to avoid drop-off.)

## Usage

```ts
import { ActionsBridge, buildGptInstructions } from "free-actions-core";

const bridge = new ActionsBridge({
  mcpServerUrl: process.env.MCP_URL!,        // e.g. the exp server's /mcp
  token: () => getSharedServiceToken(),      // one common-account token, hidden from users
  excludeTools: ["datalog_reset"],           // keep destructive ops off a public surface
});

// Wire these to your HTTP layer (Lambda Function URL / Express / …):
app.get("/tools", async (_req, res) => {
  const { status, body } = await bridge.listTools();
  res.status(status).json(body);
});
app.post("/call", async (req, res) => {
  const { status, body } = await bridge.call(req.body);
  res.status(status).json(body);
});

// Generate the OpenAPI doc to paste into the GPT's Action config:
const { body: openapi } = await bridge.openapi({ serverUrl: "https://bridge.example.com" });

// And the Instructions text for the GPT:
const instructions = buildGptInstructions({ productName: "the logic-solver audit engine" });
```

## Scope

This is the **core/adapter library** (translation + dispatch + OpenAPI/instruction
generation). It does **not** deploy anything — the IaC (Amplify, Secrets Manager
wiring, rate limiting) lives in the deployable that depends on this package.

`free-actions-core` is a pure **consumer** of the MCP server (reads `tools/list`,
emits OpenAPI, relays `tools/call`). It is **not** a fork of any MCP server and
does not modify one.

## License

Apache-2.0
