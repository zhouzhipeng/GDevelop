// @noflow
import { analyzeGdlEvents } from '../EventsSemantics/AnalyzeEvents';

export const getSettingsEventSemanticsHover = (analysis, offset) => {
  const contains = source =>
    source && source.offset <= offset && offset < source.endOffset;
  const candidates = [];
  analysis.events.forEach(event => {
    if (contains(event.source)) {
      candidates.push({
        source: event.source,
        lines: [
          `Event: ${event.type}.`,
          ...event.explanation,
          ...(event.unknowns.length
            ? [`Unknown: ${event.unknowns.join(', ')}.`]
            : []),
        ],
      });
    }
    [...event.conditions, ...event.actions].forEach(step => {
      if (!contains(step.source)) return;
      candidates.push({
        source: step.source,
        lines: [
          `${step.instructionType}: ${step.invocation.unit}.`,
          ...(step.explanation ? [step.explanation] : []),
          ...step.targets.map(
            target =>
              `Target ${target.object}: ${target.selections
                .map(
                  value =>
                    `${value.origin}, ${value.cardinality.min}..${
                      value.cardinality.max === null
                        ? '?'
                        : value.cardinality.max
                    }`
                )
                .join('; ')}.`
          ),
          ...(step.unknowns.length
            ? [`Unknown: ${step.unknowns.join(', ')}.`]
            : []),
        ],
      });
    });
  });
  candidates.sort(
    (a, b) =>
      a.source.endOffset -
      a.source.offset -
      (b.source.endOffset - b.source.offset)
  );
  const candidate = candidates[0];
  return candidate
    ? {
        contents: [
          {
            value: `${candidate.lines.join(
              '\n\n'
            )}\n\nBuffer analysis; runtime behavior is not verified. Project bindings may be unknown.`,
          },
        ],
        range: {
          startLineNumber: candidate.source.line,
          startColumn: candidate.source.column,
          endLineNumber: candidate.source.endLine,
          endColumn: candidate.source.endColumn,
        },
      }
    : null;
};

const cache = new WeakMap();
export const analyzeSettingsBuffer = (model, catalog) => {
  if (!catalog) return null;
  const source = model.getValue();
  const previous = cache.get(model);
  if (previous && previous.source === source && previous.catalog === catalog)
    return previous.analysis;
  const analysis = analyzeGdlEvents({
    source,
    file: model.uri.toString(),
    catalog,
    maxEvents: 200,
    maxNodes: 1000,
  });
  cache.set(model, { source, catalog, analysis });
  return analysis;
};
