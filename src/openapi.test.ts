import { describe, expect, it } from 'vitest';
import { buildOpenApi } from './openapi.js';
import type { McpTool } from './types.js';

interface SchemaView {
  properties: { tool: { enum?: string[] }; arguments: unknown };
  additionalProperties: boolean;
  required: string[];
}
interface OpenApiView {
  openapi: string;
  servers: Array<{ url: string }>;
  paths: {
    '/tools': { get: { operationId: string; description: string } };
    '/call': {
      post: {
        operationId: string;
        requestBody: { content: { 'application/json': { schema: SchemaView } } };
      };
    };
  };
}

const tools: McpTool[] = [
  { name: 'datalog_query', description: 'Run an ad-hoc query', inputSchema: { type: 'object' } },
  { name: 'datalog_schema', description: 'Show the schema' },
];

function view(t: McpTool[]): OpenApiView {
  return buildOpenApi(t, { serverUrl: 'https://bridge.example.com' }) as unknown as OpenApiView;
}

describe('buildOpenApi', () => {
  const doc = view(tools);

  it('is an OpenAPI 3.1 document with the configured server', () => {
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.servers).toEqual([{ url: 'https://bridge.example.com' }]);
  });

  it('exposes exactly the two mcp-mimic operations', () => {
    expect(Object.keys(doc.paths).sort()).toEqual(['/call', '/tools']);
    expect(doc.paths['/tools'].get.operationId).toBe('listTools');
    expect(doc.paths['/call'].post.operationId).toBe('callTool');
  });

  it('constrains the tool field to the provided tool names', () => {
    const schema = doc.paths['/call'].post.requestBody.content['application/json'].schema;
    expect(schema.properties.tool.enum).toEqual(['datalog_query', 'datalog_schema']);
    expect(schema.additionalProperties).toBe(false);
  });

  it('embeds the tool catalog (names + descriptions) in the listTools description', () => {
    const desc = doc.paths['/tools'].get.description;
    expect(desc).toContain('datalog_query');
    expect(desc).toContain('Run an ad-hoc query');
  });

  it('omits the enum when there are no tools', () => {
    const schema = view([]).paths['/call'].post.requestBody.content['application/json'].schema;
    expect(schema.properties.tool.enum).toBeUndefined();
  });
});
