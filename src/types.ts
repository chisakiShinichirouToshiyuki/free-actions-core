import { z } from 'zod';

/**
 * A single tool as returned by an MCP server's `tools/list`.
 * Unknown keys (annotations, title, …) are stripped — the bridge only needs
 * these three. Validated at the trust boundary because it comes off the wire.
 */
export const McpToolSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  inputSchema: z.record(z.unknown()).optional(),
});
export type McpTool = z.infer<typeof McpToolSchema>;

export const McpToolListSchema = z.array(McpToolSchema);

/**
 * The `POST /call` request body. External, untrusted input — always parsed
 * with this schema before dispatch. `arguments` defaults to `{}`.
 */
export const CallRequestSchema = z.object({
  tool: z.string().min(1),
  arguments: z.record(z.unknown()).default({}),
});
export type CallRequest = z.infer<typeof CallRequestSchema>;

export const OpenApiOptionsSchema = z.object({
  serverUrl: z.string().url(),
  title: z.string().optional(),
  description: z.string().optional(),
  version: z.string().optional(),
});
export type OpenApiOptions = z.infer<typeof OpenApiOptionsSchema>;

/**
 * Resolves the bearer token for the bridge -> MCP hop. A string for a static
 * shared token, or a function for one fetched/rotated at call time. This is
 * developer-supplied config (not wire input), so it stays a TS type.
 */
export type TokenProvider = string | (() => string | Promise<string>);

export interface BridgeConfig {
  /** Streamable-HTTP MCP endpoint to proxy to (e.g. the exp server's /mcp). */
  mcpServerUrl: string;
  /** Shared credential injected on every upstream call. Omit for an open MCP. */
  token?: TokenProvider;
  /**
   * Tool names to hide entirely (never listed, never callable). Use to keep
   * destructive ops off a public, no-login surface (e.g. ['datalog_reset']).
   */
  excludeTools?: readonly string[];
  /** Client identity reported to the MCP server. */
  clientName?: string;
  clientVersion?: string;
}

/** Framework-agnostic response returned by the bridge handlers. */
export interface BridgeResponse {
  status: number;
  body: unknown;
}

/**
 * The surface the HTTP handlers depend on. {@link McpProxy} implements it;
 * tests inject a fake. Keeps the handlers decoupled from the MCP SDK.
 */
export interface McpProxyLike {
  listTools(): Promise<McpTool[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
}
