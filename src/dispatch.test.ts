import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const connect = vi.fn<() => Promise<void>>(() => Promise.resolve());
  const listTools = vi.fn();
  const callTool = vi.fn();
  const close = vi.fn<() => Promise<void>>(() => Promise.resolve());
  const ClientCtor = vi.fn(() => ({ connect, listTools, callTool, close }));
  const TransportCtor = vi.fn();
  return { connect, listTools, callTool, close, ClientCtor, TransportCtor };
});

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({ Client: mocks.ClientCtor }));
vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: mocks.TransportCtor,
}));

import { McpProxy, ToolNotAvailableError } from './dispatch.js';

interface TransportOptions {
  requestInit?: { headers?: { Authorization?: string } };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.connect.mockResolvedValue();
  mocks.close.mockResolvedValue();
});

describe('McpProxy.listTools', () => {
  it('returns the validated tool list and closes the client', async () => {
    mocks.listTools.mockResolvedValue({
      tools: [
        { name: 'datalog_query', description: 'q', extraneous: 'stripped' },
        { name: 'datalog_schema' },
      ],
    });
    const proxy = new McpProxy({ mcpServerUrl: 'https://mcp.example.com/mcp' });
    const tools = await proxy.listTools();
    expect(tools).toEqual([
      { name: 'datalog_query', description: 'q' },
      { name: 'datalog_schema' },
    ]);
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it('filters out excluded tools', async () => {
    mocks.listTools.mockResolvedValue({
      tools: [{ name: 'datalog_query' }, { name: 'datalog_reset' }],
    });
    const proxy = new McpProxy({
      mcpServerUrl: 'https://mcp.example.com/mcp',
      excludeTools: ['datalog_reset'],
    });
    expect(await proxy.listTools()).toEqual([{ name: 'datalog_query' }]);
  });

  it('rejects a malformed tools/list payload', async () => {
    mocks.listTools.mockResolvedValue({ tools: [{ description: 'no name' }] });
    const proxy = new McpProxy({ mcpServerUrl: 'https://mcp.example.com/mcp' });
    await expect(proxy.listTools()).rejects.toThrow();
  });
});

describe('McpProxy.callTool', () => {
  it('forwards name + arguments and returns the result', async () => {
    mocks.callTool.mockResolvedValue({ content: [] });
    const proxy = new McpProxy({ mcpServerUrl: 'https://mcp.example.com/mcp' });
    const result = await proxy.callTool('datalog_query', { q: 1 });
    expect(result).toEqual({ content: [] });
    expect(mocks.callTool).toHaveBeenCalledWith({ name: 'datalog_query', arguments: { q: 1 } });
  });

  it('short-circuits an excluded tool without connecting', async () => {
    const proxy = new McpProxy({
      mcpServerUrl: 'https://mcp.example.com/mcp',
      excludeTools: ['datalog_reset'],
    });
    await expect(proxy.callTool('datalog_reset', {})).rejects.toBeInstanceOf(ToolNotAvailableError);
    expect(mocks.connect).not.toHaveBeenCalled();
  });
});

describe('McpProxy token injection', () => {
  it('injects a static bearer token as an Authorization header', async () => {
    mocks.listTools.mockResolvedValue({ tools: [] });
    const proxy = new McpProxy({
      mcpServerUrl: 'https://mcp.example.com/mcp',
      token: 'secret-123',
    });
    await proxy.listTools();
    const opts = mocks.TransportCtor.mock.calls[0]?.[1] as TransportOptions | undefined;
    expect(opts?.requestInit?.headers?.Authorization).toBe('Bearer secret-123');
  });

  it('resolves a function token provider at call time', async () => {
    mocks.listTools.mockResolvedValue({ tools: [] });
    const proxy = new McpProxy({
      mcpServerUrl: 'https://mcp.example.com/mcp',
      token: () => Promise.resolve('rotated-token'),
    });
    await proxy.listTools();
    const opts = mocks.TransportCtor.mock.calls[0]?.[1] as TransportOptions | undefined;
    expect(opts?.requestInit?.headers?.Authorization).toBe('Bearer rotated-token');
  });

  it('sends no Authorization header when no token is configured', async () => {
    mocks.listTools.mockResolvedValue({ tools: [] });
    const proxy = new McpProxy({ mcpServerUrl: 'https://mcp.example.com/mcp' });
    await proxy.listTools();
    const opts = mocks.TransportCtor.mock.calls[0]?.[1] as TransportOptions | undefined;
    expect(opts?.requestInit?.headers?.Authorization).toBeUndefined();
  });
});
