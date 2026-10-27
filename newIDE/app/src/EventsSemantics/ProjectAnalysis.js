// @noflow
import { analyzeGdlEvents, createSourceSnapshot } from './AnalyzeEvents';
import {
  buildProjectContexts,
  createCatalogSourceFingerprint,
} from './ProjectContext';
import { SEMANTICS_VERSION } from './InstructionSemanticsRegistry';

export const analyzeProjectGdl = ({ files, catalog, file, args = {} }) => {
  const snapshot = createSourceSnapshot(files, catalog, 'disk');
  if (args.expected_snapshot && args.expected_snapshot !== snapshot)
    return {
      success: false,
      status: 'stale',
      snapshot,
      runtimeVerified: false,
      reason: 'source-snapshot-changed',
    };
  if (
    !catalog.sourceFingerprint ||
    catalog.sourceFingerprint !== createCatalogSourceFingerprint(files)
  )
    return {
      success: false,
      status: 'catalog-stale',
      snapshot,
      runtimeVerified: false,
      reason: 'catalog-declarations-changed-or-fingerprint-missing',
      nextAction:
        'Run generate-catalogs, then retry. Analysis does not regenerate files.',
    };
  const context = buildProjectContexts(files);
  if (file)
    return analyzeGdlEvents({
      source: files[file],
      file,
      catalog,
      ...context(file),
      sourceKind: 'disk',
      snapshot,
      eventPath: args.event_path,
      detail: args.detail,
      maxEvents: args.max_events,
      disabledRules: args.disabled_rules || [],
    });
  const result = {
    status: 'complete',
    snapshot,
    semanticsVersion: SEMANTICS_VERSION,
    runtimeVerified: false,
    coverage: {
      analyzedEvents: 0,
      knownInstructions: 0,
      partialInstructions: 0,
      unknownInstructions: 0,
    },
    diagnostics: [],
    unknownReasons: [],
    analyzedFiles: 0,
    visitedInstructions: 0,
    truncated: false,
  };
  for (const uri of Object.keys(files).sort()) {
    if (!/\/(functions|external-events)\/[^/]+\.gdl$/.test(uri)) continue;
    const analyzed = analyzeGdlEvents({
      source: files[uri],
      file: uri,
      catalog,
      ...context(uri),
      sourceKind: 'disk',
      snapshot,
      maxEvents: 1,
      maxNodes: Math.max(1, 10000 - result.coverage.analyzedEvents),
      maxInstructions: Math.max(1, 50000 - result.visitedInstructions),
    });
    result.analyzedFiles++;
    result.visitedInstructions += analyzed.coverage.visitedInstructions || 0;
    if (analyzed.analysisTruncated) {
      result.status = 'partial';
      result.truncated = true;
    }
    for (const key of Object.keys(result.coverage))
      result.coverage[key] += analyzed.coverage[key] || 0;
    // maxEvents only bounds returned event explanations; the validation result does not include them.
    if (analyzed.unknownReasons.length || analyzed.status === 'blocked')
      result.status = 'partial';
    result.diagnostics.push(
      ...analyzed.diagnostics.slice(
        0,
        Math.max(0, 200 - result.diagnostics.length)
      )
    );
    analyzed.unknownReasons.forEach(item => {
      const previous = result.unknownReasons.find(
        existing => existing.reason === item.reason
      );
      if (previous) previous.count += item.count;
      else if (result.unknownReasons.length < 100)
        result.unknownReasons.push(item);
      else result.truncated = true;
    });
    if (
      result.coverage.analyzedEvents >= 10000 ||
      result.visitedInstructions >= 50000
    ) {
      result.truncated = true;
      result.status = 'partial';
      break;
    }
  }
  return result;
};
