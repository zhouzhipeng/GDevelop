# Editor Flow Error Cleanup Specification

Status: proposed, awaiting implementation approval.

## Problem

`cd newIDE/app && npm run flow` currently reports 495 error groups. This makes
the editor's Flow check unusable as a regression gate and obscures new type
errors, including errors in otherwise unrelated changes.

A one-shot check on 2026-08-14 produced this baseline:

- 149 `incompatible-type` errors;
- 83 `missing-local-annot` errors;
- 55 `underconstrained-implicit-instantiation` errors;
- 47 `cannot-resolve-name` errors;
- 27 `prop-missing` errors;
- 26 `method-unbinding` errors;
- 22 `incompatible-use` errors;
- 20 `invalid-computed-prop` errors;
- 86 errors spread across smaller categories.

The errors are concentrated. `McpSceneTools.js`, `McpEventTools.js`, and
`McpEventKnowledge.js` account for 203 error groups. `PreviewState.spec.js`
and `McpEditorBridge.spec.js` account for another 71. Other clusters include
`MainFrame/index.js`, project source/catalog code, resource tooling, editor
tests, stories, and stale or incomplete API declarations.

Some diagnostics are likely cascading failures from missing names, modules,
or foundational annotations. The implementation must therefore reduce the
baseline in dependency order rather than treating all 495 messages as
independent defects.

## Goals

1. Make `npm run flow` pass with zero errors in `newIDE/app`.
2. Preserve editor, MCP, project-storage, resource, preview, and test behavior.
3. Replace implicit or incorrect types with useful domain types at ownership
   boundaries.
4. Keep Flow enabled for currently checked production files, tests, and
   stories.
5. Leave the repository with focused regression coverage for any runtime bug
   found while correcting a type mismatch.
6. Make the clean Flow result reproducible from a cold one-shot check, without
   relying on a previously initialized Flow server.

## Non-goals

- Migrating the editor from Flow to TypeScript.
- Redesigning MCP protocols, serialized project formats, or public editor
  APIs.
- Reformatting or modernizing unrelated code.
- Fixing diagnostics by broadly adding `any`, `$FlowFixMe`, `$FlowExpectedError`,
  `@noflow`, inexact object types, or unsafe casts.
- Updating generated bindings by hand.
- Requiring all pre-existing lint or test failures outside the touched seams to
  be fixed unless they prevent verification of the Flow cleanup.

## Current behavior

The editor is primarily Flow-typed JavaScript. Its domain boundaries include:

- generated `libGD` wrappers for the C++ authoring model;
- React component props and state;
- MCP request, response, scene, and event structures;
- multi-file project and source-catalog projections;
- preview/debugger orchestration;
- Jest mocks and Storybook fixtures.

Flow currently reports errors across each boundary. Representative failures
include unresolved names/modules, exact-object prop mismatches, unannotated
callbacks and empty collections, computed access on untyped objects, methods
passed without their receiver, Jest functions with unconstrained generics, and
generated declarations that do not match editor use sites.

## Proposed behavior

`npm run flow` and a cold `flow check --show-all-errors` complete with zero
errors. Types describe the existing runtime contracts, and tests retain their
current behavior. Suppressions are permitted only for a demonstrated external
library limitation, must be local to the expression, and must include a reason.

## Implementation strategy

### Phase 1: freeze and classify the baseline

- Capture machine-readable Flow output from `flow check --json
  --show-all-errors`.
- Group diagnostics by root cause, file, and code.
- Identify cascades so a missing import or declaration is repaired before its
  downstream errors.
- Record the baseline and per-phase counts in implementation notes or commit
  messages; do not commit generated diagnostic output.

Exit criterion: every diagnostic belongs to an owned cluster and the sum of
the clusters matches the baseline.

### Phase 2: repair foundational declarations and module resolution

Address `cannot-resolve-name`, `cannot-resolve-module`, `missing-export`,
`value-as-type`, `invalid-constructor`, and declaration-cycle errors first.

- Correct imports/exports and type/value import syntax.
- Reconcile editor declarations with authoritative generated `GDevelop.js`
  types. If the generated types are wrong, change the owning binding/type
  generator and regenerate them; do not hand-edit generated output.
- Add or correct narrow third-party library declarations where the installed
  runtime API is known.
- Remove accidental dependency cycles without changing public behavior.

Likely affected areas include `Mcp`, `MainFrame`, browser/webview integration,
resource tooling, and `GDevelop.js` declarations.

Exit criterion: no resolution, export, value/type, constructor, or declaration
cycle errors remain.

### Phase 3: type the MCP boundary

The MCP cluster is the largest production-code owner and should be handled as
one coherent boundary:

- define shared exact request/response and result types where structures cross
  `McpEditorBridge`, scene tools, event tools, and event knowledge;
- annotate callback parameters, accumulators, computed maps, tuples, and
  collection element types;
- bind or wrap object methods that require their receiver;
- model nullable lookups and validation failures explicitly;
- preserve existing JSON payload names and shapes;
- add focused tests for any validation or fallback behavior made explicit by
  the new types.

No MCP tool name, argument schema, response schema, or side effect may change
as part of this cleanup unless a separate compatibility specification is
approved.

Exit criterion: all MCP production files pass Flow and their focused tests
pass.

### Phase 4: repair editor orchestration and domain clusters

Work through remaining production clusters in dependency order:

1. `MainFrame`, preview state, autosave, browser/webview, and preferences;
2. IfDo/project instruction catalogs and project-source catalogs;
3. resource lists, previews, editors, and project-files panels;
4. object, behavior, properties, and compact editor schemas;
5. remaining UI and utility files.

For each mismatch, confirm the runtime owner before choosing the type. Exact
object errors must be resolved by aligning the producer and consumer contract,
not by making all props inexact. Nullable values must be handled where absence
is legitimate. Unsafe arithmetic or computed access must receive validated
input types.

Exit criterion: all non-test editor sources pass Flow, with focused tests for
runtime behavior changes.

### Phase 5: type tests and stories

- Give Jest mocks explicit argument and return types where inference is
  underconstrained.
- Use typed fixture builders for repeated project, preview, MCP, resource, and
  editor structures.
- Keep test files Flow-checked when they are currently checked.
- Align Storybook fixtures with component contracts rather than weakening the
  production props.

Exit criterion: all tests and stories pass Flow without blanket suppression.

### Phase 6: final verification and cleanup

- Run a cold one-shot Flow check and the normal `npm run flow` command.
- Run editor lint and formatting checks.
- Run focused tests for every touched domain, then the full non-watch editor
  test suite if feasible.
- Inspect the final diff for accidental API, serialization, translation, or
  behavior changes.
- Start the required platform desktop build/launch in the background after the
  final code change, following `AGENT.md`.

Exit criterion: zero Flow errors, relevant checks pass, and any unrelated test
or infrastructure failure is reported precisely.

## Affected layers and likely files

Primary ownership is under `newIDE/app/src`, especially:

- `Mcp/McpSceneTools.js`, `McpEventTools.js`, `McpEventKnowledge.js`, and
  `McpEditorBridge.js` plus their specs;
- `MainFrame/index.js`, preview state/autosave specs, editor tabs, browser
  section, preferences, and sticky notes;
- `EventsSheet/IfDoEventsDsl/ProjectInstructionCatalog.js`;
- `ProjectsStorage` source-catalog and multi-file tests;
- `ResourcesList` and `ResourcesEditor` files and specs;
- object, behavior, instance, and properties editor schemas;
- affected Storybook fixtures and utility specs.

`GDevelop.js` binding declarations may be affected only when investigation
shows that generated declarations differ from the authoritative C++/IDL API.
Such a change must follow the binding regeneration workflow.

## Public API, data, and schema changes

None are intended. The cleanup must preserve:

- serialized project formats and keys;
- MCP tool names, parameters, JSON payloads, and results;
- editor component behavior and user-visible workflows;
- preview/export behavior;
- generated binding APIs.

If a genuine mismatch requires changing one of these contracts, stop that
cluster and prepare a separate compatibility proposal before implementation.

## Compatibility and migration

No project or user-data migration is expected. Type-only changes disappear at
build time. Runtime guards added to satisfy a legitimate nullable or unknown
input must accept every input currently supported and should improve error
reporting for invalid inputs without changing valid results.

## Performance

Type annotations have no runtime cost. Avoid introducing cloning, repeated
serialization, new per-frame allocations, or broad object normalization merely
to simplify a type. Any runtime guard on a hot path must be measured or kept to
constant-time checks already implied by the contract.

## Error handling

- Preserve current user-facing error behavior for valid and known-invalid
  inputs.
- At external boundaries, narrow `mixed`/unknown data through explicit
  validation rather than casting.
- Preserve thrown/rejected error types when callers depend on them.
- Do not convert a Flow error into a silent fallback unless that fallback is
  already part of the runtime contract.

## Testing

Minimum verification for each phase:

1. `flow check --show-all-errors` with the cluster's diagnostics removed;
2. focused Jest specs next to every production area whose executable code
   changes;
3. ESLint and Prettier for touched files;
4. final `npm run flow`, `npm run lint`, `npm run check-format`, and a
   non-watch editor test run;
5. binding build/tests if generated `GDevelop.js` declarations change;
6. required detached Windows or macOS app build/launch after final code edits.

Tests should demonstrate runtime behavior, not only that Flow accepts a cast.

## Rollout

Implement in small, reviewable commits matching the phases above. Each commit
must reduce or preserve the global error count and must not introduce new error
codes in untouched areas. Foundational declarations and shared types land
before dependent call-site fixes. Do not combine unrelated feature work with
the cleanup.

## Alternatives considered

### Add `@noflow` to failing files

Rejected because it removes coverage from the exact areas creating the noisy
baseline.

### Add broad `any` types or suppression comments

Rejected because it produces a nominally green check without restoring useful
contract checking.

### Fix diagnostics in displayed order

Rejected because missing declarations and shared boundary types cause many
downstream diagnostics. Dependency-ordered repair is smaller and safer.

### Migrate affected files to TypeScript

Rejected as a much larger architectural change unrelated to restoring the
existing Flow gate.

## Open questions for review

1. Should the cleanup include all Flow-checked stories and tests in the same
   implementation, as proposed, or should those be a separately reviewed
   follow-up after production sources reach zero?
2. If stale generated `GDevelop.js` declarations are found, is the repository's
   current Emscripten toolchain available to regenerate them during this work?
3. Is a temporary CI baseline ratchet desired during implementation so new
   errors cannot be added before the count reaches zero?

