// @flow

// Presentation only: structuredContent remains the authoritative, complete
// receipt. Never compact internal workflow results before assertions run.
const compactToolNames = new Set([
  'generate-catalogs',
  'validate_project_files',
  'reload_project',
  'verify_project_change',
]);

const omittedKeys = new Set([
  'catalogs',
  'catalogFiles',
  'progressHistory',
  'lastRendererCatalogLog',
]);

const summarize = (value: any): any => {
  if (Array.isArray(value)) return value.map(summarize);
  if (!value || typeof value !== 'object') return value;
  const result: Object = {};
  Object.keys(value).forEach(key => {
    if (omittedKeys.has(key)) return;
    // These are repeated verbatim in the parent receipt. Preserve failures and
    // diagnostics from nested validation rather than silently dropping them.
    if (key === 'validation' || key === 'reload') {
      Object.keys(value[key] || {}).forEach(nestedKey => {
        if (!(nestedKey in value) && !omittedKeys.has(nestedKey))
          result[nestedKey] = summarize(value[key][nestedKey]);
      });
      return;
    }
    if (key === 'receipts' && Array.isArray(value[key])) {
      result[key] = value[key].map(entry => {
        const receipt = summarize(entry.receipt || {});
        const stage: Object = { stage: entry.stage, toolName: entry.toolName };
        [
          'success',
          'valid',
          'phase',
          'error',
          'code',
          'runtimeVerified',
          'completionReady',
          'filePath',
          'errors',
          'diagnostics',
        ].forEach(field => {
          if (receipt[field] !== undefined) stage[field] = receipt[field];
        });
        if (entry.assertions) stage.assertions = entry.assertions;
        return stage;
      });
      return;
    }
    result[key] = summarize(value[key]);
  });
  return result;
};

export const presentMcpToolResult = (
  toolName: string,
  detail: any,
  response: Object
): Object => {
  if (
    !compactToolNames.has(toolName) ||
    detail === 'full' ||
    !response.structuredContent
  )
    return response;

  const summary = {
    ...summarize(response.structuredContent),
    responseDetail: 'summary',
    fullDetails:
      'Complete receipt in structuredContent; detail="full" restores full text.',
  };
  return {
    ...response,
    content: (response.content || []).map(block =>
      block.type === 'text'
        ? { ...block, text: JSON.stringify(summary) }
        : block
    ),
  };
};

export const withMcpResponseDetail = (tool: Object): Object =>
  compactToolNames.has(tool.name)
    ? {
        ...tool,
        description:
          tool.description +
          ' Optional detail="full" returns full text; default text is compact. structuredContent always contains the complete receipt.',
        inputSchema: {
          ...tool.inputSchema,
          properties: {
            ...tool.inputSchema.properties,
            detail: {
              type: 'string',
              enum: ['summary', 'full'],
              description:
                'Text receipt detail (default: summary). Full structured data is always retained.',
            },
          },
        },
      }
    : tool;
