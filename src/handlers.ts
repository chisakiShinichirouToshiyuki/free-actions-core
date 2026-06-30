import { McpProxy, ToolNotAvailableError } from './dispatch.js';
import { buildOpenApi } from './openapi.js';
import {
  type BridgeConfig,
  type BridgeResponse,
  CallRequestSchema,
  type McpProxyLike,
  type OpenApiOptions,
  OpenApiOptionsSchema,
} from './types.js';

/**
 * Framework-agnostic bridge handlers. Each returns a plain { status, body }
 * so the deployable (Lambda/Function-URL, Express, …) can adapt it to its
 * own request/response objects.
 */
export class ActionsBridge {
  private readonly proxy: McpProxyLike;

  /** `proxy` is injectable for testing; defaults to a real {@link McpProxy}. */
  constructor(config: BridgeConfig, proxy?: McpProxyLike) {
    this.proxy = proxy ?? new McpProxy(config);
  }

  /** GET /tools */
  async listTools(): Promise<BridgeResponse> {
    const tools = await this.proxy.listTools();
    return { status: 200, body: { tools } };
  }

  /** POST /call — body: { tool, arguments } (string or already-parsed object) */
  async call(body: unknown): Promise<BridgeResponse> {
    const candidate = typeof body === 'string' ? safeJson(body) : body;
    const parsed = CallRequestSchema.safeParse(candidate);
    if (!parsed.success) {
      return { status: 400, body: { error: 'Invalid request body', issues: parsed.error.issues } };
    }
    const { tool, arguments: args } = parsed.data;
    try {
      const result = await this.proxy.callTool(tool, args);
      return { status: 200, body: result };
    } catch (err: unknown) {
      if (err instanceof ToolNotAvailableError) {
        return { status: 404, body: { error: err.message, tool: err.tool } };
      }
      return { status: 502, body: { error: errorMessage(err) } };
    }
  }

  /**
   * Generate the OpenAPI document to paste into the GPT's Action config.
   * Fetches the live tool catalog so the schema reflects what's actually
   * callable (excluded tools omitted).
   */
  async openapi(options: OpenApiOptions): Promise<BridgeResponse> {
    const opts = OpenApiOptionsSchema.parse(options);
    const tools = await this.proxy.listTools();
    return { status: 200, body: buildOpenApi(tools, opts) };
  }
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
