// @noflow
import { MULTI_FILE_ENTRY_NAME } from '../ProjectsStorage/ProjectEntry';
import { SEMANTICS_RULE_EVIDENCE } from '../EventsSemantics/RuleEvidence';
import optionalRequire from '../Utils/OptionalRequire';
import {
  readMultiFileSourceTree,
  resolveGameUriToPath,
} from '../ProjectsStorage/LocalFileStorageProvider/LocalMultiFileProject';
import {
  ALL_INSTRUCTION_CATALOG_PATHS,
  assembleInstructionCatalogFiles,
} from '../ProjectsStorage/SettingsDsl/InstructionCatalog';
import { analyzeProjectGdl } from '../EventsSemantics/ProjectAnalysis';
import { createCatalogSourceFingerprint } from '../EventsSemantics/ProjectContext';
import { createSourceSnapshot } from '../EventsSemantics/AnalyzeEvents';

const fs = optionalRequire('fs');
const path = optionalRequire('path');
export const readGdlSemanticsCatalog = projectRoot => {
  return assembleInstructionCatalogFiles(
    Object.fromEntries(
      ALL_INSTRUCTION_CATALOG_PATHS.map(file => {
        const fullPath = path.join(projectRoot, file);
        if (fs.statSync(fullPath).size > 32 * 1024 * 1024)
          throw new Error(
            `Instruction catalog exceeds analysis size budget: ${file}`
          );
        return [file, JSON.parse(fs.readFileSync(fullPath, 'utf8'))];
      })
    )
  );
};

export const callGdlSemanticsTool = async (projectFile, toolName, args) => {
  if (
    !fs ||
    !path ||
    !projectFile ||
    path.basename(projectFile) !== MULTI_FILE_ENTRY_NAME
  )
    return {
      success: false,
      status: 'blocked',
      runtimeVerified: false,
      reason: 'A saved local project.gdl is required.',
    };
  let catalog;
  try {
    catalog = readGdlSemanticsCatalog(path.dirname(projectFile));
  } catch (error) {
    return {
      success: false,
      status: 'catalog-stale',
      runtimeVerified: false,
      reason: error.message,
      nextAction: 'Run generate-catalogs, then retry.',
    };
  }
  const { projectRoot, files } = await readMultiFileSourceTree(projectFile, {
    readOnly: true,
  });
  if (toolName === 'get_gdl_instruction_semantics') {
    const { kind, type } = args;
    if (!['action', 'condition'].includes(kind) || typeof type !== 'string')
      return {
        success: false,
        status: 'blocked',
        reason: 'Exact kind (action/condition) and type are required.',
      };
    // Use the same freshness gate as event analysis without analyzing a whole project.
    const snapshot = createSourceSnapshot(files, catalog, 'disk');
    if (catalog.sourceFingerprint !== createCatalogSourceFingerprint(files))
      return {
        success: false,
        status: 'catalog-stale',
        snapshot,
        reason: 'Catalog declarations changed. Run generate-catalogs.',
      };
    const instruction = (kind === 'action'
      ? catalog.actions
      : catalog.conditions
    ).find(entry => entry.dslName === type || entry.type === type);
    return instruction
      ? {
          success: true,
          snapshot,
          runtimeVerified: false,
          kind,
          instruction,
          evidence: Object.fromEntries(
            (
              (instruction.semantics && instruction.semantics.evidenceIds) ||
              []
            ).map(id => [id, SEMANTICS_RULE_EVIDENCE[id]])
          ),
        }
      : {
          success: false,
          status: 'blocked',
          snapshot,
          reason:
            'Exact instruction type is not in the current project catalog.',
        };
  }
  if (typeof args.file !== 'string' || !args.file)
    return {
      success: false,
      status: 'blocked',
      reason: 'A managed GDL file is required.',
    };
  const requestedPath = path.resolve(projectRoot, args.file);
  const file = Object.keys(files).find(
    uri => resolveGameUriToPath(projectRoot, uri) === requestedPath
  );
  if (!file || !file.endsWith('.gdl'))
    return {
      success: false,
      status: 'blocked',
      reason: 'File is not a managed GDL source in this project.',
    };
  return analyzeProjectGdl({ files, catalog, file, args });
};
