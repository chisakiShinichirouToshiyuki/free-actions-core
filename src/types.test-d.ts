import { expectTypeOf } from 'vitest';
import { ActionsBridge } from './handlers.js';
import type { BridgeResponse, CallRequest, McpTool, TokenProvider } from './types.js';

// McpTool: name is a required string; description is optional.
expectTypeOf<McpTool['name']>().toEqualTypeOf<string>();
expectTypeOf<McpTool['description']>().toEqualTypeOf<string | undefined>();
expectTypeOf<McpTool>().toMatchObjectType<{ name: string }>();

// CallRequest (post-parse): tool is a string, arguments is a populated record
// (zod .default({}) makes it required on the output type — narrowness check).
expectTypeOf<CallRequest['tool']>().toEqualTypeOf<string>();
expectTypeOf<CallRequest['arguments']>().toEqualTypeOf<Record<string, unknown>>();

// TokenProvider stays a tight union — neither side may widen to `any`.
expectTypeOf<TokenProvider>().toEqualTypeOf<string | (() => string | Promise<string>)>();

// The handlers always resolve to a BridgeResponse.
expectTypeOf(ActionsBridge.prototype.call).returns.resolves.toEqualTypeOf<BridgeResponse>();
expectTypeOf(ActionsBridge.prototype.listTools).returns.resolves.toEqualTypeOf<BridgeResponse>();
