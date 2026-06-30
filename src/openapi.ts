import type { McpTool, OpenApiOptions } from './types.js';

/**
 * Build the "mcp-mimic" OpenAPI 3.1 document: two generic operations that
 * mirror the MCP handshake.
 *
 *   GET  /tools  -> tools/list   (discovery; returns each tool + its inputSchema)
 *   POST /call   -> tools/call   (dispatch by tool name + arguments)
 *
 * Two operations sidestep the Custom-GPT ~30-operation limit entirely and
 * expose the full tool surface dynamically — new MCP tools appear with no
 * schema edit. The tool catalog is embedded in the GET /tools response schema
 * (as an enum + per-tool description) so the model can pick correctly.
 */
export function buildOpenApi(tools: McpTool[], opts: OpenApiOptions): Record<string, unknown> {
  const toolNames = tools.map((t) => t.name);
  const catalog = tools
    .map((t) => `- \`${t.name}\`: ${t.description ?? '(no description)'}`)
    .join('\n');

  return {
    openapi: '3.1.0',
    info: {
      title: opts.title ?? 'MCP Actions Bridge',
      description:
        opts.description ??
        "Generic bridge exposing a remote MCP server's tools as OpenAPI Actions. Call GET /tools first to discover available tools and their argument schemas, then POST /call to invoke one.",
      version: opts.version ?? '0.0.1',
    },
    servers: [{ url: opts.serverUrl }],
    paths: {
      '/tools': {
        get: {
          operationId: 'listTools',
          summary: 'List all available tools and their argument schemas.',
          description: `Returns the full tool catalog. Always call this first.\n\nAvailable tools:\n${catalog}`,
          responses: {
            '200': {
              description: 'The tool catalog.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      tools: {
                        type: 'array',
                        items: {
                          type: 'object',
                          additionalProperties: false,
                          properties: {
                            name: { type: 'string' },
                            description: { type: 'string' },
                            inputSchema: { type: 'object', additionalProperties: true },
                          },
                          required: ['name'],
                        },
                      },
                    },
                    required: ['tools'],
                  },
                },
              },
            },
          },
        },
      },
      '/call': {
        post: {
          operationId: 'callTool',
          summary: 'Invoke a tool by name with arguments.',
          description:
            "Dispatch a single tool call. `tool` must be one of the names from GET /tools; `arguments` must match that tool's inputSchema.",
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    tool: {
                      type: 'string',
                      description: 'The tool name to invoke.',
                      ...(toolNames.length ? { enum: toolNames } : {}),
                    },
                    arguments: {
                      type: 'object',
                      additionalProperties: true,
                      description: "Arguments matching the tool's inputSchema.",
                    },
                  },
                  required: ['tool'],
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'The tool result (MCP CallToolResult).',
              content: {
                'application/json': { schema: { type: 'object', additionalProperties: true } },
              },
            },
            '404': {
              description: 'Unknown or hidden tool.',
              content: {
                'application/json': { schema: { type: 'object', additionalProperties: true } },
              },
            },
          },
        },
      },
    },
  };
}
