import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
  type BridgeConfig,
  type McpProxyLike,
  type McpTool,
  McpToolListSchema,
  type TokenProvider,
} from './types.js';

async function resolveToken(token: TokenProvider | undefined): Promise<string | undefined> {
  if (token === undefined) return undefined;
  return typeof token === 'function' ? await token() : token;
}

export class ToolNotAvailableError extends Error {
  constructor(public readonly tool: string) {
    super(`Tool "${tool}" is not available on this bridge.`);
    this.name = 'ToolNotAvailableError';
  }
}

/**
 * Thin client to a remote MCP server. Opens a fresh Streamable-HTTP connection
 * per request (stateless — friendly to Lambda/Function-URL), injecting the
 * shared bearer token so the GPT caller never has to authenticate.
 */
export class McpProxy implements McpProxyLike {
  private readonly hidden: ReadonlySet<string>;

  constructor(private readonly config: BridgeConfig) {
    this.hidden = new Set(config.excludeTools ?? []);
  }

  private async connect(): Promise<Client> {
    const token = await resolveToken(this.config.token);
    const transport = new StreamableHTTPClientTransport(
      new URL(this.config.mcpServerUrl),
      token === undefined ? {} : { requestInit: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const client = new Client(
      {
        name: this.config.clientName ?? 'free-actions-core',
        version: this.config.clientVersion ?? '0.0.1',
      },
      { capabilities: {} },
    );
    await client.connect(transport);
    return client;
  }

  /** `tools/list`, minus any excluded tools. Validated with zod. */
  async listTools(): Promise<McpTool[]> {
    const client = await this.connect();
    try {
      const raw = await client.listTools();
      const tools = McpToolListSchema.parse(raw.tools);
      return tools.filter((t) => !this.hidden.has(t.name));
    } finally {
      await client.close();
    }
  }

  /** `tools/call`. Rejects excluded tools as if they did not exist. */
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (this.hidden.has(name)) {
      throw new ToolNotAvailableError(name);
    }
    const client = await this.connect();
    try {
      return await client.callTool({ name, arguments: args });
    } finally {
      await client.close();
    }
  }
}
