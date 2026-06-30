/**
 * The GPT "Instructions" text that teaches a Custom GPT the tools/list ->
 * tools/call handshake. Paste this (or merge it with product-specific
 * guidance) into the GPT's Instructions field.
 */
export function buildGptInstructions(opts?: { productName?: string; extra?: string }): string {
  const product = opts?.productName ?? 'this MCP server';
  return [
    `You are an assistant that operates ${product} through two Actions.`,
    '',
    'Tool protocol — follow strictly:',
    "1. On the first relevant request (or whenever unsure what is available), call `listTools` (GET /tools) to retrieve the catalog of tools and each tool's `inputSchema`.",
    '2. To do anything, call `callTool` (POST /call) with `{ "tool": <name>, "arguments": <object> }`. The `tool` MUST be a name from the catalog and `arguments` MUST conform to that tool\'s `inputSchema`.',
    '3. Never invent tool names or arguments. If a tool is not in the catalog, it does not exist.',
    '4. If a call returns an error, read it, fix the arguments, and retry once before reporting back.',
    '',
    'Prefer reading/inspection tools before mutating ones, and summarize results for the user in plain language.',
    opts?.extra ? `\n${opts.extra}` : '',
  ].join('\n');
}
