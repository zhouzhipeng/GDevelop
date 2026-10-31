import { callGdlSemanticsTool } from './McpGdlSemantics';
import { assembleInstructionCatalogFiles } from '../ProjectsStorage/SettingsDsl/InstructionCatalog';
jest.mock('../Utils/OptionalRequire', () => name =>
  name === 'path'
    ? require('path')
    : {
        statSync: () => ({ size: 2 }),
        readFileSync: () => '{}',
      }
);
jest.mock(
  '../ProjectsStorage/LocalFileStorageProvider/LocalMultiFileProject',
  () => ({
    readMultiFileSourceTree: async () => ({ projectRoot: '/game', files: {} }),
    resolveGameUriToPath: () => '',
  })
);
jest.mock('../ProjectsStorage/SettingsDsl/InstructionCatalog', () => ({
  ALL_INSTRUCTION_CATALOG_PATHS: ['catalog.json'],
  assembleInstructionCatalogFiles: jest.fn(),
}));
jest.mock('../EventsSemantics/ProjectContext', () => ({
  createCatalogSourceFingerprint: () => 'current',
}));
jest.mock('../EventsSemantics/AnalyzeEvents', () => ({
  createSourceSnapshot: () => ({}),
}));
jest.mock('../EventsSemantics/ProjectAnalysis', () => ({
  analyzeProjectGdl: jest.fn(),
}));
test('returns an unreviewed instruction without inventing evidence or throwing', async () => {
  const instruction = { type: 'IsCursorOnObject', dslName: 'isCursorOnObject' };
  assembleInstructionCatalogFiles.mockReturnValue({
    sourceFingerprint: 'current',
    conditions: [instruction],
    actions: [],
  });
  const result = await callGdlSemanticsTool(
    '/game/project.gdl',
    'get_gdl_instruction_semantics',
    { kind: 'condition', type: 'isCursorOnObject' }
  );
  expect(result.success).toBe(true);
  expect(result.instruction).toEqual(instruction);
  expect(result.evidence).toEqual({});
});
