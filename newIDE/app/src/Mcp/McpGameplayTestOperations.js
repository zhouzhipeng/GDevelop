// @flow

import {
  getIsGameplayTestRunInProgress,
  getIsGameplayTestRunnerAvailable,
  makeGameplayTestResultReadableOutput,
  runProjectGameplayTests,
  type GameplayTestResult,
  type GameplayTestToRun,
} from '../GameplayTests/GameplayTestRunner';
import { encodeManagedName } from '../ProjectsStorage/MultiFileProjectFormat';

export type McpGameplayTestDescriptor = {|
  scope: 'project' | 'extension',
  extension?: string,
  name: string,
  file: string,
|};

type OperationStatus =
  | 'queued'
  | 'launching'
  | 'running'
  | 'completed'
  | 'failed';

type OperationRecord = {
  id: string,
  status: OperationStatus,
  selection: Object,
  project: Object,
  createdAt: string,
  createdAtMs: number,
  creationSequence: number,
  startedAt: string | null,
  finishedAt: string | null,
  finishedAtMs: number | null,
  progress: Object,
  summary: Object,
  results: Array<Object>,
  completedFiles: Set<string>,
  descriptors: Array<McpGameplayTestDescriptor>,
  operationError: ?string,
};

type RunGameplayTests = ({|
  project: gdProject,
  tests: Array<GameplayTestToRun>,
  options: Object,
|}) => Promise<Array<GameplayTestResult>>;

type Dependencies = {|
  runGameplayTests?: RunGameplayTests,
  isGameplayTestRunInProgress?: () => boolean,
  isGameplayTestRunnerAvailable?: () => boolean,
  beginPreviewLaunchSequence?: () => boolean,
  endPreviewLaunchSequence?: () => void,
  now?: () => number,
  createOperationId?: () => string,
  makeReadableResult?: GameplayTestResult => Object,
  retentionMs?: number,
  maxRetainedTerminalOperations?: number,
|};

export class McpGameplayTestOperationError extends Error {
  code: string;
  details: Object;

  constructor(code: string, message: string, details?: Object = {}) {
    super(message);
    this.name = 'McpGameplayTestOperationError';
    this.code = code;
    this.details = details;
  }
}

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const DEFAULT_RETENTION_MS = 30 * 60 * 1000;
const DEFAULT_MAX_RETAINED_TERMINAL_OPERATIONS = 10;
const MAX_OPERATION_ERROR_LENGTH = 2000;

// Keep operation identity available in browser, Electron renderer, and Jest
// without importing Three's untranspiled ESM source. This is the same compact
// RFC 4122 v4 generator already used for editor-local identities.
const generateOperationUuid = (placeholder?: number): string =>
  placeholder
    ? // eslint-disable-next-line no-bitwise
      (placeholder ^ ((Math.random() * 16) >> (placeholder / 4))).toString(16)
    : // $FlowFixMe[incompatible-type]
      // $FlowFixMe[unsafe-addition]
      ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(
        /[018]/g,
        generateOperationUuid
      );

const hasOwn = (value: Object, property: string): boolean =>
  Object.keys(value).indexOf(property) !== -1;

const validateArguments = (
  args: any,
  allowedProperties: Array<string>,
  errorCode: string
): Object => {
  if (args === undefined || args === null) return {};
  if (typeof args !== 'object' || Array.isArray(args)) {
    throw new McpGameplayTestOperationError(
      errorCode,
      'Arguments must be an object.'
    );
  }
  const unexpectedProperties = Object.keys(args).filter(
    property => allowedProperties.indexOf(property) === -1
  );
  if (unexpectedProperties.length) {
    throw new McpGameplayTestOperationError(
      errorCode,
      `Unexpected argument${
        unexpectedProperties.length === 1 ? '' : 's'
      }: ${unexpectedProperties.join(', ')}.`,
      { unexpected_properties: unexpectedProperties }
    );
  }
  return args;
};

const descriptorToTest = (
  descriptor: McpGameplayTestDescriptor
): GameplayTestToRun => ({
  scope:
    descriptor.scope === 'project'
      ? { type: 'project' }
      : { type: 'extension', extensionName: descriptor.extension || '' },
  testName: descriptor.name,
});

const descriptorMatchesTest = (
  descriptor: McpGameplayTestDescriptor,
  test: GameplayTestToRun
): boolean =>
  descriptor.name === test.testName &&
  ((descriptor.scope === 'project' && test.scope.type === 'project') ||
    (descriptor.scope === 'extension' &&
      test.scope.type === 'extension' &&
      descriptor.extension === test.scope.extensionName));

const makeInitialSummary = (total: number): Object => ({
  total,
  completed: 0,
  passed: 0,
  failed: 0,
  error: 0,
  stopped: 0,
  timeout: 0,
  all_passed: false,
});

const isTerminal = (status: OperationStatus): boolean =>
  status === 'completed' || status === 'failed';

const makeBoundedErrorMessage = (error: any): string => {
  const message =
    error && error.message
      ? String(error.message)
      : 'The gameplay-test operation failed unexpectedly.';
  return message.slice(0, MAX_OPERATION_ERROR_LENGTH);
};

// A canonical managed gameplay-test path is always a scheme-free, flat direct
// child of tests/. Membership in the descriptor projection is checked
// separately; this check only distinguishes malformed paths from unknown ones.
const isCanonicalGameplayTestPathShape = (file: string): boolean => {
  if (!file.startsWith('tests/') || !file.endsWith('.js')) return false;
  const basename = file.slice('tests/'.length, -'.js'.length);
  if (!basename || basename === '.' || basename === '..') return false;
  if (file.indexOf('\\') !== -1 || basename.indexOf('/') !== -1) return false;
  if (!/^(?:[A-Za-z0-9_.~-]|%[0-9A-F]{2})+$/.test(basename)) return false;
  const collisionSuffixMatch = /~[0-9a-f]{8}$/.exec(basename);
  const encodedName = collisionSuffixMatch
    ? basename.slice(0, -collisionSuffixMatch[0].length)
    : basename;
  if (!encodedName) return false;
  try {
    return encodeManagedName(decodeURIComponent(encodedName)) === encodedName;
  } catch (error) {
    return false;
  }
};

export class McpGameplayTestOperations {
  _runGameplayTests: ?RunGameplayTests;
  _isGameplayTestRunInProgress: () => boolean;
  _isGameplayTestRunnerAvailable: () => boolean;
  _beginPreviewLaunchSequence: ?() => boolean;
  _endPreviewLaunchSequence: ?() => void;
  _now: () => number;
  _createOperationId: () => string;
  _makeReadableResult: GameplayTestResult => Object;
  _retentionMs: number;
  _maxRetainedTerminalOperations: number;
  _operations: Map<string, OperationRecord>;
  _activeOperationId: ?string;
  _nextCreationSequence: number;

  constructor(dependencies?: Dependencies = {}) {
    this._runGameplayTests =
      dependencies.runGameplayTests === undefined
        ? runProjectGameplayTests
        : dependencies.runGameplayTests;
    this._isGameplayTestRunInProgress =
      dependencies.isGameplayTestRunInProgress ||
      getIsGameplayTestRunInProgress;
    this._isGameplayTestRunnerAvailable =
      dependencies.isGameplayTestRunnerAvailable ||
      (dependencies.runGameplayTests
        ? () => true
        : getIsGameplayTestRunnerAvailable);
    this._beginPreviewLaunchSequence = dependencies.beginPreviewLaunchSequence;
    this._endPreviewLaunchSequence = dependencies.endPreviewLaunchSequence;
    this._now = dependencies.now || (() => Date.now());
    this._createOperationId =
      dependencies.createOperationId ||
      (() => `gameplay-tests-${generateOperationUuid()}`);
    this._makeReadableResult =
      dependencies.makeReadableResult || makeGameplayTestResultReadableOutput;
    this._retentionMs =
      dependencies.retentionMs === undefined
        ? DEFAULT_RETENTION_MS
        : dependencies.retentionMs;
    this._maxRetainedTerminalOperations =
      dependencies.maxRetainedTerminalOperations === undefined
        ? DEFAULT_MAX_RETAINED_TERMINAL_OPERATIONS
        : dependencies.maxRetainedTerminalOperations;
    this._operations = new Map();
    this._activeOperationId = null;
    this._nextCreationSequence = 0;
  }

  hasActiveOperation(): boolean {
    const operation = this._activeOperationId
      ? this._operations.get(this._activeOperationId)
      : null;
    return !!operation && !isTerminal(operation.status);
  }

  getActiveOperationId(): ?string {
    return this.hasActiveOperation() ? this._activeOperationId : null;
  }

  _prune(): void {
    const now = this._now();
    this._operations.forEach((operation, operationId) => {
      if (
        operationId !== this._activeOperationId &&
        isTerminal(operation.status) &&
        operation.finishedAtMs !== null &&
        now - operation.finishedAtMs >= this._retentionMs
      ) {
        this._operations.delete(operationId);
      }
    });

    const terminalOperations = Array.from(this._operations.values())
      .filter(
        operation =>
          operation.id !== this._activeOperationId &&
          isTerminal(operation.status)
      )
      .sort((left, right) => left.creationSequence - right.creationSequence);
    const excess =
      terminalOperations.length - this._maxRetainedTerminalOperations;
    for (let index = 0; index < excess; index++) {
      this._operations.delete(terminalOperations[index].id);
    }
  }

  _getSelectedDescriptors(
    descriptors: Array<McpGameplayTestDescriptor>,
    args: Object
  ): {| descriptors: Array<McpGameplayTestDescriptor>, selection: Object |} {
    const fileWasProvided = hasOwn(args, 'file');
    if (!fileWasProvided) {
      if (!descriptors.length) {
        throw new McpGameplayTestOperationError(
          'NO_GAMEPLAY_TESTS',
          'The active project does not contain any gameplay tests.'
        );
      }
      return {
        descriptors: [...descriptors],
        selection: { mode: 'all', test_count: descriptors.length },
      };
    }

    const file = args.file;
    if (
      typeof file !== 'string' ||
      file.length < 1 ||
      file.length > 1024 ||
      !isCanonicalGameplayTestPathShape(file)
    ) {
      throw new McpGameplayTestOperationError(
        'INVALID_GAMEPLAY_TEST_FILE',
        'file must be an exact scheme-free canonical flat tests/<Encoded name>.js path.'
      );
    }

    const descriptor = descriptors.find(candidate => candidate.file === file);
    if (!descriptor) {
      throw new McpGameplayTestOperationError(
        'GAMEPLAY_TEST_FILE_NOT_FOUND',
        `No authored gameplay test owns ${file}.`,
        { available_files: descriptors.slice(0, 100).map(item => item.file) }
      );
    }
    return {
      descriptors: [descriptor],
      selection: { mode: 'file', file, test_count: 1 },
    };
  }

  _getTimeoutMs(args: Object): number {
    if (!hasOwn(args, 'timeout_ms')) return DEFAULT_TIMEOUT_MS;
    const timeoutMs = args.timeout_ms;
    if (
      typeof timeoutMs !== 'number' ||
      !Number.isInteger(timeoutMs) ||
      timeoutMs < 1000 ||
      timeoutMs > 300000
    ) {
      throw new McpGameplayTestOperationError(
        'INVALID_GAMEPLAY_TEST_TIMEOUT',
        'timeout_ms must be an integer from 1000 to 300000.'
      );
    }
    return timeoutMs;
  }

  start({
    project,
    descriptors,
    args,
  }: {|
    project: gdProject,
    descriptors: Array<McpGameplayTestDescriptor>,
    args?: Object,
  |}): Object {
    this._prune();
    const normalizedArgs = validateArguments(
      args,
      ['file', 'timeout_ms'],
      'INVALID_GAMEPLAY_TEST_ARGUMENTS'
    );
    if (this.hasActiveOperation() || this._isGameplayTestRunInProgress()) {
      throw new McpGameplayTestOperationError(
        'GAMEPLAY_TEST_RUN_IN_PROGRESS',
        'A gameplay-test batch is already running.',
        {
          active_operation_id: this.getActiveOperationId() || undefined,
        }
      );
    }
    if (!this._runGameplayTests || !this._isGameplayTestRunnerAvailable()) {
      throw new McpGameplayTestOperationError(
        'GAMEPLAY_TEST_RUNNER_UNAVAILABLE',
        'The editor did not register an available gameplay-test preview runner.'
      );
    }

    const timeoutMs = this._getTimeoutMs(normalizedArgs);
    const selected = this._getSelectedDescriptors(descriptors, normalizedArgs);
    const didReservePreviewLaunchSequence = !!this._beginPreviewLaunchSequence;
    if (this._beginPreviewLaunchSequence) {
      if (!this._beginPreviewLaunchSequence()) {
        throw new McpGameplayTestOperationError(
          'PREVIEW_LAUNCH_SEQUENCE_ALREADY_IN_PROGRESS',
          'Another MCP preview workflow is already in progress.'
        );
      }
    }

    try {
      const createdAtMs = this._now();
      const operationId = this._createOperationId();
      const operation: OperationRecord = {
        id: operationId,
        status: 'queued',
        selection: selected.selection,
        project: {
          name: project.getName(),
          file: project.getProjectFile() || '',
        },
        createdAt: new Date(createdAtMs).toISOString(),
        createdAtMs,
        creationSequence: ++this._nextCreationSequence,
        startedAt: null,
        finishedAt: null,
        finishedAtMs: null,
        progress: {
          current_index: 0,
          total: selected.descriptors.length,
          current_file: null,
          current_test: null,
          frame: 0,
        },
        summary: makeInitialSummary(selected.descriptors.length),
        results: [],
        completedFiles: new Set(),
        descriptors: selected.descriptors,
        operationError: null,
      };
      this._operations.set(operationId, operation);
      this._activeOperationId = operationId;

      // Deliberately detach execution from the request. The queued receipt is
      // returned before export, preview boot, or test execution begins.
      Promise.resolve()
        .then(() =>
          this._execute(
            operation,
            project,
            timeoutMs,
            didReservePreviewLaunchSequence
          )
        )
        .catch(() => {});

      return {
        success: true,
        operation_id: operationId,
        status: 'queued',
        selection: operation.selection,
        project: operation.project,
        created_at: operation.createdAt,
        next_action: 'Call get_gameplay_test_results with this operation_id.',
      };
    } catch (error) {
      if (didReservePreviewLaunchSequence && this._endPreviewLaunchSequence) {
        this._endPreviewLaunchSequence();
      }
      throw error;
    }
  }

  _findDescriptorForTest(
    operation: OperationRecord,
    test: GameplayTestToRun
  ): ?McpGameplayTestDescriptor {
    return operation.descriptors.find(descriptor =>
      descriptorMatchesTest(descriptor, test)
    );
  }

  _setCurrentTest(
    operation: OperationRecord,
    descriptor: McpGameplayTestDescriptor,
    frame: number
  ): void {
    operation.progress = {
      current_index: operation.descriptors.indexOf(descriptor) + 1,
      total: operation.descriptors.length,
      current_file: descriptor.file,
      current_test: descriptor.name,
      frame,
    };
  }

  _appendResult(
    operation: OperationRecord,
    descriptor: McpGameplayTestDescriptor,
    result: GameplayTestResult
  ): void {
    if (operation.completedFiles.has(descriptor.file)) return;
    operation.completedFiles.add(descriptor.file);
    this._setCurrentTest(operation, descriptor, result.framesExecuted || 0);
    const readable = this._makeReadableResult(result);
    const { testName, screenshots, ...details } = readable;
    operation.results.push({
      file: descriptor.file,
      scope: descriptor.scope,
      ...(descriptor.scope === 'extension'
        ? { extension: descriptor.extension }
        : undefined),
      name: descriptor.name,
      ...details,
      // Never retain screenshot bytes on the MCP operation surface, even if a
      // custom runner violates the screenshots:"off" request.
      screenshots: [],
    });
    operation.summary.completed++;
    const status = result.status;
    if (hasOwn(operation.summary, status)) operation.summary[status]++;
  }

  async _execute(
    operation: OperationRecord,
    project: gdProject,
    timeoutMs: number,
    didReservePreviewLaunchSequence: boolean
  ): Promise<void> {
    try {
      const runGameplayTests = this._runGameplayTests;
      if (!runGameplayTests) {
        throw new Error('The gameplay-test runner became unavailable.');
      }
      const results = await runGameplayTests({
        project,
        tests: operation.descriptors.map(descriptorToTest),
        options: {
          timeoutMs,
          screenshots: 'off',
          onRunStarted: () => {
            operation.status = 'launching';
            const startedAtMs = this._now();
            operation.startedAt = new Date(startedAtMs).toISOString();
          },
          onTestStarted: test => {
            const descriptor = this._findDescriptorForTest(operation, test);
            if (!descriptor) return;
            operation.status = 'running';
            this._setCurrentTest(operation, descriptor, 0);
          },
          onProgress: (test, frame) => {
            const descriptor = this._findDescriptorForTest(operation, test);
            if (!descriptor) return;
            this._setCurrentTest(operation, descriptor, frame);
          },
          onTestFinished: (test, result) => {
            const descriptor = this._findDescriptorForTest(operation, test);
            if (!descriptor) return;
            this._appendResult(operation, descriptor, result);
          },
        },
      });

      // Keep the owner resilient to an injected/older runner that returns
      // results but omits a completion callback. The completed-file guard
      // preserves exactly-once storage for the shared runner.
      results.forEach((result, index) => {
        const descriptor = operation.descriptors[index];
        if (descriptor) this._appendResult(operation, descriptor, result);
      });
      operation.status = 'completed';
      operation.summary.all_passed =
        operation.summary.completed === operation.summary.total &&
        operation.summary.passed === operation.summary.total;
    } catch (error) {
      operation.status = 'failed';
      operation.summary.all_passed = false;
      operation.operationError = makeBoundedErrorMessage(error);
    } finally {
      const finishedAtMs = this._now();
      operation.finishedAtMs = finishedAtMs;
      operation.finishedAt = new Date(finishedAtMs).toISOString();
      if (this._activeOperationId === operation.id) {
        this._activeOperationId = null;
      }
      if (didReservePreviewLaunchSequence && this._endPreviewLaunchSequence) {
        this._endPreviewLaunchSequence();
      }
      this._prune();
    }
  }

  get(args?: Object = {}): Object {
    this._prune();
    const normalizedArgs = validateArguments(
      args,
      ['operation_id', 'offset', 'limit'],
      'INVALID_GAMEPLAY_TEST_QUERY'
    );
    let operationId;
    if (hasOwn(normalizedArgs, 'operation_id')) {
      operationId = normalizedArgs.operation_id;
      if (
        typeof operationId !== 'string' ||
        operationId.length < 1 ||
        operationId.length > 128
      ) {
        throw new McpGameplayTestOperationError(
          'INVALID_GAMEPLAY_TEST_OPERATION_ID',
          'operation_id must be a non-empty string of at most 128 characters.'
        );
      }
    } else if (this.getActiveOperationId()) {
      operationId = this.getActiveOperationId();
    } else {
      const retainedOperations = Array.from(this._operations.values()).sort(
        (left, right) => right.creationSequence - left.creationSequence
      );
      operationId = retainedOperations.length ? retainedOperations[0].id : null;
    }

    if (!operationId) {
      throw new McpGameplayTestOperationError(
        'NO_GAMEPLAY_TEST_OPERATION',
        'No active or retained gameplay-test operation is available.'
      );
    }
    const operation = this._operations.get(operationId);
    if (!operation) {
      throw new McpGameplayTestOperationError(
        'GAMEPLAY_TEST_OPERATION_NOT_FOUND',
        `Gameplay-test operation ${operationId} is unknown or expired.`,
        { operation_id: operationId }
      );
    }

    const offset = hasOwn(normalizedArgs, 'offset') ? normalizedArgs.offset : 0;
    const limit = hasOwn(normalizedArgs, 'limit')
      ? normalizedArgs.limit
      : DEFAULT_LIMIT;
    if (
      typeof offset !== 'number' ||
      !Number.isInteger(offset) ||
      offset < 0 ||
      typeof limit !== 'number' ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > MAX_LIMIT
    ) {
      throw new McpGameplayTestOperationError(
        'INVALID_GAMEPLAY_TEST_PAGINATION',
        'offset must be a non-negative integer and limit must be an integer from 1 to 100.'
      );
    }

    const results = operation.results.slice(offset, offset + limit);
    const available = operation.results.length;
    const nextOffset = offset + results.length;
    const hasMore = nextOffset < available;
    return {
      success: true,
      operation_id: operation.id,
      status: operation.status,
      selection: operation.selection,
      project: operation.project,
      created_at: operation.createdAt,
      started_at: operation.startedAt,
      finished_at: operation.finishedAt,
      progress: operation.progress,
      summary: operation.summary,
      results,
      page: {
        offset,
        limit,
        returned: results.length,
        available,
        has_more: hasMore,
        next_offset: hasMore ? nextOffset : null,
      },
      ...(operation.operationError
        ? { operation_error: operation.operationError }
        : undefined),
    };
  }
}

export const createMcpGameplayTestOperations = (
  dependencies?: Dependencies
): McpGameplayTestOperations => new McpGameplayTestOperations(dependencies);
