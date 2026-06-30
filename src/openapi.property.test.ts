import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildOpenApi } from './openapi.js';
import type { McpTool } from './types.js';

interface CallSchema {
  properties: { tool: { enum?: string[] } };
  additionalProperties: boolean;
}
interface Doc {
  openapi: string;
  paths: {
    '/tools': { get: { description: string } };
    '/call': { post: { requestBody: { content: { 'application/json': { schema: CallSchema } } } } };
  };
}

const toolArb: fc.Arbitrary<McpTool> = fc.record(
  {
    name: fc.string({ minLength: 1 }),
    description: fc.option(fc.string(), { nil: undefined }),
  },
  { requiredKeys: ['name'] },
);

function doc(tools: McpTool[]): Doc {
  return buildOpenApi(tools, { serverUrl: 'https://b.example.com' }) as unknown as Doc;
}

describe('buildOpenApi — properties', () => {
  it('always emits OpenAPI 3.1 with exactly /tools and /call', () => {
    fc.assert(
      fc.property(fc.array(toolArb), (tools) => {
        const d = doc(tools);
        expect(d.openapi).toBe('3.1.0');
        expect(Object.keys(d.paths).sort()).toEqual(['/call', '/tools']);
      }),
    );
  });

  it('tool enum equals input names (and is absent only when empty)', () => {
    fc.assert(
      fc.property(fc.array(toolArb), (tools) => {
        const schema =
          doc(tools).paths['/call'].post.requestBody.content['application/json'].schema;
        if (tools.length === 0) {
          expect(schema.properties.tool.enum).toBeUndefined();
        } else {
          expect(schema.properties.tool.enum).toEqual(tools.map((t) => t.name));
        }
        // request body is always closed
        expect(schema.additionalProperties).toBe(false);
      }),
    );
  });

  it('every tool name appears in the listTools catalog description', () => {
    fc.assert(
      fc.property(fc.array(toolArb), (tools) => {
        const desc = doc(tools).paths['/tools'].get.description;
        for (const t of tools) {
          expect(desc).toContain(t.name);
        }
      }),
    );
  });
});
