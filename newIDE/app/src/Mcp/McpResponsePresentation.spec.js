// @flow
import {
  presentMcpToolResult,
  withMcpResponseDetail,
} from './McpResponsePresentation';

describe('MCP receipt presentation', () => {
  const diagnostic = {
    code: 'BAD_SOURCE',
    file: 'scene.gdl',
    line: 12,
    sourceExcerpt: ['bad'],
  };
  const payload = {
    success: false,
    valid: false,
    runtimeVerified: false,
    completionReady: false,
    catalogs: { large: 'x'.repeat(10000) },
    validation: { valid: false, errors: [diagnostic] },
    reloadOperation: {
      id: 'reload-1',
      status: 'running',
      progressHistory: ['noise'],
    },
    receipts: [
      {
        stage: 'validation',
        toolName: 'validate_project_files',
        receipt: {
          success: false,
          errors: [diagnostic],
          catalogs: { large: 'x'.repeat(10000) },
        },
      },
    ],
  };
  const response = {
    isError: true,
    structuredContent: payload,
    content: [
      { type: 'text', text: JSON.stringify(payload) },
      { type: 'image', data: 'image' },
    ],
  };

  it('removes duplicated catalog noise while preserving complete data, failures, and media', () => {
    const result = presentMcpToolResult(
      'verify_project_change',
      undefined,
      response
    );
    const summary = JSON.parse(result.content[0].text);
    expect(result.structuredContent).toBe(payload);
    expect(result.isError).toBe(true);
    expect(result.content[1]).toBe(response.content[1]);
    expect(summary.catalogs).toBeUndefined();
    expect(summary.errors).toEqual([diagnostic]);
    expect(summary.receipts[0].errors).toEqual([diagnostic]);
    expect(summary.reloadOperation).toEqual({
      id: 'reload-1',
      status: 'running',
    });
    expect(summary.runtimeVerified).toBe(false);
    expect(summary.completionReady).toBe(false);
    expect(result.content[0].text.length).toBeLessThan(
      response.content[0].text.length / 5
    );
  });

  it('restores exact legacy text with full detail and leaves other tools unchanged', () => {
    expect(
      presentMcpToolResult('verify_project_change', 'full', response)
    ).toBe(response);
    expect(presentMcpToolResult('run_frames', undefined, response)).toBe(
      response
    );
    expect(
      presentMcpToolResult('reload_project', undefined, { content: [] })
    ).toEqual({ content: [] });
  });

  it('advertises optional detail without changing existing schema constraints', () => {
    const tool = {
      name: 'validate_project_files',
      description: 'Validate.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    };
    const schema = withMcpResponseDetail(tool).inputSchema;
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.detail.enum).toEqual(['summary', 'full']);
    expect(tool.inputSchema.properties).toEqual({});
    expect(withMcpResponseDetail({ name: 'run_frames' })).toEqual({
      name: 'run_frames',
    });
  });
});
