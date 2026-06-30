import { describe, expect, it } from 'vitest';
import { buildGptInstructions } from './instructions.js';

describe('buildGptInstructions', () => {
  it('teaches the listTools -> callTool handshake', () => {
    const text = buildGptInstructions();
    expect(text).toContain('listTools');
    expect(text).toContain('callTool');
    expect(text).toMatch(/inputSchema/);
  });

  it('injects the product name', () => {
    const text = buildGptInstructions({ productName: 'the audit engine' });
    expect(text).toContain('the audit engine');
  });

  it('appends extra guidance when provided', () => {
    const text = buildGptInstructions({ extra: 'CUSTOM_RULE_XYZ' });
    expect(text).toContain('CUSTOM_RULE_XYZ');
  });
});
