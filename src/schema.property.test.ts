import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CallRequestSchema, McpToolListSchema } from './types.js';

const argsArb = fc.dictionary(fc.string(), fc.jsonValue());

describe('CallRequestSchema — properties', () => {
  it('accepts any non-empty tool + preserves arguments verbatim', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), argsArb, (tool, args) => {
        const r = CallRequestSchema.safeParse({ tool, arguments: args });
        expect(r.success).toBe(true);
        if (r.success) expect(r.data.arguments).toEqual(args);
      }),
    );
  });

  it('defaults arguments to {} when omitted', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (tool) => {
        const r = CallRequestSchema.safeParse({ tool });
        expect(r.success).toBe(true);
        if (r.success) expect(r.data.arguments).toEqual({});
      }),
    );
  });

  it('rejects an empty / missing tool regardless of arguments', () => {
    fc.assert(
      fc.property(argsArb, (args) => {
        expect(CallRequestSchema.safeParse({ tool: '', arguments: args }).success).toBe(false);
        expect(CallRequestSchema.safeParse({ arguments: args }).success).toBe(false);
      }),
    );
  });
});

describe('McpToolListSchema — properties', () => {
  it('strips unknown keys but keeps name/description', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), fc.string(), (name, extra) => {
        const r = McpToolListSchema.parse([{ name, description: 'd', surprise: extra }]);
        expect(r[0]).toEqual({ name, description: 'd' });
      }),
    );
  });

  it('rejects a list whose item is missing a name', () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string(), fc.jsonValue()), (obj) => {
        const withoutName = { ...obj };
        delete (withoutName as Record<string, unknown>)['name'];
        expect(McpToolListSchema.safeParse([withoutName]).success).toBe(false);
      }),
    );
  });
});
