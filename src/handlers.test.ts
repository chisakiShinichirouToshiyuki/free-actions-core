import { describe, expect, it } from 'vitest';
import { ToolNotAvailableError } from './dispatch.js';
import { ActionsBridge } from './handlers.js';
import type { BridgeConfig, McpProxyLike, McpTool } from './types.js';

const config: BridgeConfig = { mcpServerUrl: 'https://mcp.example.com/mcp' };

function bridgeWith(proxy: Partial<McpProxyLike>): ActionsBridge {
  const full: McpProxyLike = {
    listTools: proxy.listTools ?? (() => Promise.resolve([])),
    callTool: proxy.callTool ?? (() => Promise.resolve({ ok: true })),
  };
  return new ActionsBridge(config, full);
}

describe('ActionsBridge.listTools', () => {
  it('wraps the proxy tool list in { tools }', async () => {
    const tools: McpTool[] = [{ name: 'a' }, { name: 'b' }];
    const res = await bridgeWith({ listTools: () => Promise.resolve(tools) }).listTools();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ tools });
  });
});

describe('ActionsBridge.call', () => {
  it('rejects a body missing the tool field with 400', async () => {
    const res = await bridgeWith({}).call({ arguments: {} });
    expect(res.status).toBe(400);
  });

  it('rejects a non-JSON string body with 400', async () => {
    const res = await bridgeWith({}).call('not json {{{');
    expect(res.status).toBe(400);
  });

  it('parses a JSON string body and forwards tool + arguments', async () => {
    let seen: { name: string; args: Record<string, unknown> } | undefined;
    const res = await bridgeWith({
      callTool: (name, args) => {
        seen = { name, args };
        return Promise.resolve({ echoed: true });
      },
    }).call(JSON.stringify({ tool: 'datalog_query', arguments: { q: 1 } }));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ echoed: true });
    expect(seen).toEqual({ name: 'datalog_query', args: { q: 1 } });
  });

  it('defaults arguments to {} when omitted', async () => {
    let seenArgs: Record<string, unknown> | undefined;
    await bridgeWith({
      callTool: (_name, args) => {
        seenArgs = args;
        return Promise.resolve(null);
      },
    }).call({ tool: 'datalog_schema' });
    expect(seenArgs).toEqual({});
  });

  it('maps ToolNotAvailableError to 404', async () => {
    const res = await bridgeWith({
      callTool: (name) => Promise.reject(new ToolNotAvailableError(name)),
    }).call({ tool: 'datalog_reset' });
    expect(res.status).toBe(404);
  });

  it('maps an upstream failure to 502', async () => {
    const res = await bridgeWith({
      callTool: () => Promise.reject(new Error('upstream exploded')),
    }).call({ tool: 'datalog_query' });
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'upstream exploded' });
  });

  it('stringifies a non-Error rejection in the 502 body', async () => {
    const res = await bridgeWith({
      callTool: () => Promise.reject('plain string failure'),
    }).call({ tool: 'datalog_query' });
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'plain string failure' });
  });
});

describe('ActionsBridge construction', () => {
  it('defaults to a real McpProxy when none is injected', () => {
    expect(() => new ActionsBridge(config)).not.toThrow();
  });
});

describe('ActionsBridge.openapi', () => {
  it('rejects an invalid serverUrl', async () => {
    await expect(bridgeWith({}).openapi({ serverUrl: 'not-a-url' })).rejects.toThrow();
  });

  it('builds a document from the live tool catalog', async () => {
    const tools: McpTool[] = [{ name: 'datalog_query' }];
    const res = await bridgeWith({ listTools: () => Promise.resolve(tools) }).openapi({
      serverUrl: 'https://bridge.example.com',
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ openapi: '3.1.0' });
  });
});
