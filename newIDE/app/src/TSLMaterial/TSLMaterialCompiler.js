// @flow

import { sha256 } from 'js-sha256';
import optionalRequire from '../Utils/OptionalRequire';
import {
  TSL_ALLOWED_MODULES,
  TSL_ALLOWED_SYMBOLS,
  TSL_AST_NODE_LIMIT,
  TSL_AUTHORING_API_VERSION,
  TSL_COMPILER_VERSION,
  TSL_CURRENT_TARGET,
  TSL_GRAPH_NODE_LIMIT,
  TSL_IMPORTED_SYMBOL_LIMIT,
  TSL_MATERIAL_FACADE_NODE_FIELDS,
  TSL_MATERIAL_FACADE_RENDER_STATE_FIELDS,
  TSL_PARAMETER_LIMIT,
  TSL_PORTABLE_PROFILE_VERSION,
  TSL_SOURCE_MAX_BYTES,
  TSL_THREE_REVISION,
  TSL_VALIDATOR_VERSION,
  buildTSLMaterialAuthoringArtifacts,
  stableStringifyTSLCatalog,
  verifyTSLMaterialAuthoringArtifacts,
} from '../ProjectsStorage/TSLMaterialAuthoring';

export type TSLValidationLevel = 'static' | 'graph' | 'backend' | 'model';

const MAX_SOURCE_EXCERPT_LENGTH = 240;
const MAX_COMPILATION_CACHE_ENTRIES = 64;
const compilationCache: Map<string, Object> = new Map();
const allowedMaterialFields = new Set([
  ...TSL_MATERIAL_FACADE_NODE_FIELDS,
  ...TSL_MATERIAL_FACADE_RENDER_STATE_FIELDS,
]);
const allowedManifestFields = new Set([
  'apiVersion',
  'label',
  'description',
  'base',
  'parameters',
  'build',
]);
const allowedParameterFields = new Set([
  'type',
  'default',
  'label',
  'min',
  'max',
  'step',
  'colorSpace',
]);
const forbiddenGlobalIdentifiers = new Set([
  'window',
  'document',
  'global',
  'globalThis',
  'self',
  'process',
  'require',
  'module',
  'exports',
  'eval',
  'Function',
  'Promise',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'Worker',
  'SharedWorker',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'setTimeout',
  'setInterval',
  'requestAnimationFrame',
  'navigator',
  'location',
  'performance',
  'crypto',
  'Atomics',
  'WebAssembly',
]);
const forbiddenPropertyNames = new Set([
  '__proto__',
  'prototype',
  'constructor',
  'call',
  'apply',
  'bind',
  'toString',
  'valueOf',
]);
const backendShaderPattern = /(?:\b(?:wgsl|glsl|gl_Position|gl_FragColor|shaderMaterial)\b|@(?:vertex|fragment|compute)\b|\bvoid\s+main\s*\()/i;
const parameterNamePattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

let cachedTypeScript = null;
const loadTypeScript = (): any => {
  if (cachedTypeScript) return cachedTypeScript;
  const typescript = optionalRequire('typescript');
  if (typescript) cachedTypeScript = typescript;
  return typescript;
};

const now = (): number => {
  if (typeof performance === 'undefined') return Date.now();
  return performance.now();
};

const normalizeSource = (source: string): string =>
  source.replace(/\r\n?/g, '\n');

const cloneCompilationResult = (result: Object, cacheHit: boolean): Object => ({
  ...result,
  diagnostics: (result.diagnostics || []).map(diagnostic => ({
    ...diagnostic,
  })),
  completedStages: [...(result.completedStages || [])],
  metrics: { ...(result.metrics || {}), compilation_cache_hit: cacheHit },
  receipt: result.receipt
    ? {
        ...result.receipt,
        importedSymbols: [...(result.receipt.importedSymbols || [])],
      }
    : result.receipt,
  importedSymbols: result.importedSymbols
    ? [...result.importedSymbols]
    : result.importedSymbols,
});

const storeCompilationCacheEntry = (key: string, result: Object): void => {
  if (compilationCache.has(key)) compilationCache.delete(key);
  compilationCache.set(key, result);
  while (compilationCache.size > MAX_COMPILATION_CACHE_ENTRIES) {
    const oldestKey = compilationCache.keys().next().value;
    if (typeof oldestKey !== 'string') break;
    compilationCache.delete(oldestKey);
  }
};

/** @internal Used by deterministic compiler tests and release upgrades. */
export const clearTSLMaterialCompilationCache = (): void => {
  compilationCache.clear();
};

const sourceBytes = (source: string): number => {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(source).length;
  }
  return unescape(encodeURIComponent(source)).length;
};

const getPropertyName = (typescript: any, node: any): ?string => {
  if (!node) return null;
  if (
    typescript.isIdentifier(node) ||
    typescript.isStringLiteral(node) ||
    typescript.isNumericLiteral(node)
  ) {
    return String(node.text);
  }
  return null;
};

const getSourcePosition = (
  sourceFile: any,
  node: any
): {| line: number, column: number, end_line: number, end_column: number |} => {
  const start =
    node && typeof node.getStart === 'function' ? node.getStart() : 0;
  const end = node && typeof node.getEnd === 'function' ? node.getEnd() : start;
  const startPosition = sourceFile.getLineAndCharacterOfPosition(start);
  const endPosition = sourceFile.getLineAndCharacterOfPosition(end);
  return {
    line: startPosition.line + 1,
    column: startPosition.character + 1,
    end_line: endPosition.line + 1,
    end_column: endPosition.character + 1,
  };
};

const getSourceExcerpt = (source: string, line: number): string => {
  const sourceLine = (source.split('\n')[Math.max(0, line - 1)] || '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '') // eslint-disable-line no-control-regex
    .trim();
  return sourceLine.length <= MAX_SOURCE_EXCERPT_LENGTH
    ? sourceLine
    : `${sourceLine.slice(0, MAX_SOURCE_EXCERPT_LENGTH - 1)}…`;
};

const diagnosticForNode = ({
  code,
  stage,
  message,
  suggestion,
  filePath,
  source,
  sourceFile,
  node,
  severity = 'error',
}: Object): Object => {
  const position = getSourcePosition(sourceFile, node);
  return {
    code,
    severity,
    stage,
    message,
    file_path: filePath,
    ...position,
    source_excerpt: getSourceExcerpt(source, position.line),
    ...(suggestion ? { suggestion } : {}),
  };
};

const isNodeInsidePropertyName = (typescript: any, node: any): boolean => {
  const parent = node.parent;
  return !!(
    parent &&
    ((typescript.isPropertyAccessExpression(parent) && parent.name === node) ||
      ((typescript.isPropertyAssignment(parent) ||
        typescript.isMethodDeclaration(parent) ||
        typescript.isPropertyDeclaration(parent)) &&
        parent.name === node))
  );
};

const collectBindingIdentifiers = (
  typescript: any,
  bindingName: any,
  identifiers: Set<string>
): void => {
  if (!bindingName) return;
  if (typescript.isIdentifier(bindingName)) {
    identifiers.add(bindingName.text);
    return;
  }
  if (
    typescript.isObjectBindingPattern(bindingName) ||
    typescript.isArrayBindingPattern(bindingName)
  ) {
    bindingName.elements.forEach(element => {
      if (typescript.isBindingElement(element)) {
        collectBindingIdentifiers(typescript, element.name, identifiers);
      }
    });
  }
};

const isIdentifierDeclarationOrTypeUse = (
  typescript: any,
  node: any
): boolean => {
  const parent = node.parent;
  if (!parent) return false;
  if (
    (typescript.isVariableDeclaration(parent) && parent.name === node) ||
    (typescript.isParameter(parent) && parent.name === node) ||
    ((typescript.isFunctionDeclaration(parent) ||
      typescript.isFunctionExpression(parent) ||
      typescript.isClassDeclaration(parent) ||
      typescript.isClassExpression(parent)) &&
      parent.name === node) ||
    (typescript.isBindingElement(parent) &&
      (parent.name === node || parent.propertyName === node)) ||
    typescript.isImportSpecifier(parent) ||
    typescript.isImportClause(parent) ||
    typescript.isNamespaceImport(parent) ||
    typescript.isExportSpecifier(parent) ||
    (typescript.isPropertyAccessExpression(parent) && parent.name === node) ||
    ((typescript.isPropertyAssignment(parent) ||
      typescript.isMethodDeclaration(parent) ||
      typescript.isPropertyDeclaration(parent) ||
      typescript.isGetAccessorDeclaration(parent) ||
      typescript.isSetAccessorDeclaration(parent)) &&
      parent.name === node) ||
    (typescript.isLabeledStatement(parent) && parent.label === node) ||
    (typescript.isBreakOrContinueStatement(parent) && parent.label === node)
  ) {
    return true;
  }
  let current = parent;
  while (current) {
    if (
      typeof typescript.isTypeNode === 'function' &&
      typescript.isTypeNode(current)
    ) {
      return true;
    }
    if (
      typescript.isExpressionStatement(current) ||
      typescript.isStatement(current) ||
      typescript.isSourceFile(current)
    ) {
      break;
    }
    current = current.parent;
  }
  return false;
};

const isFunctionIdentifierDeclaration = (
  typescript: any,
  node: any
): boolean => {
  const parent = node.parent;
  return !!(
    parent &&
    (((typescript.isFunctionDeclaration(parent) ||
      typescript.isFunctionExpression(parent)) &&
      parent.name === node) ||
      (typescript.isVariableDeclaration(parent) && parent.name === node))
  );
};

const hasModifier = (
  typescript: any,
  node: any,
  modifierKind: number
): boolean =>
  !!node.modifiers &&
  node.modifiers.some(modifier => modifier.kind === modifierKind);

const isAssignmentOperator = (typescript: any, kind: number): boolean =>
  kind >= typescript.SyntaxKind.FirstAssignment &&
  kind <= typescript.SyntaxKind.LastAssignment;

const getBuildMethod = (typescript: any, definitionObject: any): ?any =>
  definitionObject.properties.find(property => {
    const name = getPropertyName(typescript, property.name);
    return (
      name === 'build' &&
      (typescript.isMethodDeclaration(property) ||
        (typescript.isPropertyAssignment(property) &&
          (typescript.isArrowFunction(property.initializer) ||
            typescript.isFunctionExpression(property.initializer))))
    );
  }) || null;

const getBuildFunctionLike = (typescript: any, buildProperty: any): ?any => {
  if (!buildProperty) return null;
  if (typescript.isMethodDeclaration(buildProperty)) return buildProperty;
  if (typescript.isPropertyAssignment(buildProperty)) {
    return buildProperty.initializer;
  }
  return null;
};

const collectBuildContextNames = (
  typescript: any,
  buildFunction: any
): {| materialNames: Set<string>, parameterNames: Set<string> |} => {
  const materialNames = new Set<string>();
  const parameterNames = new Set<string>();
  const parameter = buildFunction && buildFunction.parameters[0];
  if (!parameter || !typescript.isObjectBindingPattern(parameter.name)) {
    return { materialNames, parameterNames };
  }
  parameter.name.elements.forEach(element => {
    const sourceName = getPropertyName(
      typescript,
      element.propertyName || element.name
    );
    const localName = getPropertyName(typescript, element.name);
    if (sourceName === 'material' && localName) materialNames.add(localName);
    if (sourceName === 'parameters' && localName) parameterNames.add(localName);
  });
  return { materialNames, parameterNames };
};

const expressionReferencesOneOf = (
  typescript: any,
  expression: any,
  names: Set<string>
): boolean => {
  let found = false;
  const visit = (node: any) => {
    if (found) return;
    if (
      typescript.isIdentifier(node) &&
      names.has(node.text) &&
      !isNodeInsidePropertyName(typescript, node)
    ) {
      found = true;
      return;
    }
    typescript.forEachChild(node, visit);
  };
  visit(expression);
  return found;
};

const isLiteralOnlyExpression = (typescript: any, node: any): boolean => {
  if (
    typescript.isStringLiteral(node) ||
    typescript.isNumericLiteral(node) ||
    node.kind === typescript.SyntaxKind.TrueKeyword ||
    node.kind === typescript.SyntaxKind.FalseKeyword ||
    node.kind === typescript.SyntaxKind.NullKeyword
  ) {
    return true;
  }
  if (typescript.isPrefixUnaryExpression(node)) {
    return (
      (node.operator === typescript.SyntaxKind.MinusToken ||
        node.operator === typescript.SyntaxKind.PlusToken) &&
      typescript.isNumericLiteral(node.operand)
    );
  }
  if (typescript.isParenthesizedExpression(node)) {
    return isLiteralOnlyExpression(typescript, node.expression);
  }
  if (typescript.isArrayLiteralExpression(node)) {
    return node.elements.every(element =>
      isLiteralOnlyExpression(typescript, element)
    );
  }
  if (typescript.isObjectLiteralExpression(node)) {
    return node.properties.every(
      property =>
        typescript.isPropertyAssignment(property) &&
        !!getPropertyName(typescript, property.name) &&
        isLiteralOnlyExpression(typescript, property.initializer)
    );
  }
  return false;
};

const extractLiteral = (typescript: any, node: any): any => {
  if (typescript.isStringLiteral(node)) return node.text;
  if (typescript.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === typescript.SyntaxKind.TrueKeyword) return true;
  if (node.kind === typescript.SyntaxKind.FalseKeyword) return false;
  if (node.kind === typescript.SyntaxKind.NullKeyword) return null;
  if (typescript.isPrefixUnaryExpression(node)) {
    const value = extractLiteral(typescript, node.operand);
    if (typeof value !== 'number') return undefined;
    if (node.operator === typescript.SyntaxKind.MinusToken) return -value;
    if (node.operator === typescript.SyntaxKind.PlusToken) return value;
    return undefined;
  }
  if (typescript.isParenthesizedExpression(node)) {
    return extractLiteral(typescript, node.expression);
  }
  if (typescript.isArrayLiteralExpression(node)) {
    const result: Array<any> = [];
    for (const element of node.elements) {
      const value = extractLiteral(typescript, element);
      if (value === undefined) return undefined;
      result.push(value);
    }
    return result;
  }
  if (typescript.isObjectLiteralExpression(node)) {
    const result: { [string]: any } = {};
    for (const property of node.properties) {
      if (!typescript.isPropertyAssignment(property)) return undefined;
      const name = getPropertyName(typescript, property.name);
      if (!name || name in result) {
        return undefined;
      }
      const value = extractLiteral(typescript, property.initializer);
      if (value === undefined) return undefined;
      result[name] = value;
    }
    return result;
  }
  return undefined;
};

const findDefinition = (typescript: any, sourceFile: any): Object => {
  const imports: Array<any> = [];
  const exportAssignments: Array<any> = [];
  sourceFile.statements.forEach(statement => {
    if (typescript.isImportDeclaration(statement)) imports.push(statement);
    if (typescript.isExportAssignment(statement))
      exportAssignments.push(statement);
  });
  const exportAssignment =
    exportAssignments.length === 1 ? exportAssignments[0] : null;
  const call =
    exportAssignment && typescript.isCallExpression(exportAssignment.expression)
      ? exportAssignment.expression
      : null;
  const definitionObject =
    call &&
    call.arguments.length === 1 &&
    typescript.isObjectLiteralExpression(call.arguments[0])
      ? call.arguments[0]
      : null;
  return {
    imports,
    exportAssignments,
    exportAssignment,
    call,
    definitionObject,
  };
};

const validateImportsAndPolicy = ({
  typescript,
  sourceFile,
  source,
  filePath,
  definition,
}: Object): Object => {
  const diagnostics: Array<Object> = [];
  const importedSymbols: Array<string> = [];
  const importBindings: Array<Object> = [];
  let defineMaterialLocalName: ?string = null;

  definition.imports.forEach(importDeclaration => {
    const moduleName = typescript.isStringLiteral(
      importDeclaration.moduleSpecifier
    )
      ? importDeclaration.moduleSpecifier.text
      : '';
    if (!TSL_ALLOWED_MODULES.includes(moduleName)) {
      diagnostics.push(
        diagnosticForNode({
          code: 'TSL-SRC-003',
          stage: 'policy',
          message: `Import from "${moduleName}" is not allowed.`,
          suggestion: 'Import only from "@gdevelop/tsl" or "three/tsl".',
          filePath,
          source,
          sourceFile,
          node: importDeclaration,
        })
      );
      return;
    }
    const importClause = importDeclaration.importClause;
    if (
      !importClause ||
      importClause.name ||
      !importClause.namedBindings ||
      !typescript.isNamedImports(importClause.namedBindings)
    ) {
      diagnostics.push(
        diagnosticForNode({
          code: 'TSL-SRC-003',
          stage: 'policy',
          message: 'Only named static imports are allowed.',
          suggestion: `Use import { symbol } from "${moduleName}".`,
          filePath,
          source,
          sourceFile,
          node: importDeclaration,
        })
      );
      return;
    }
    importClause.namedBindings.elements.forEach(specifier => {
      const importedName = (specifier.propertyName || specifier.name).text;
      const localName = specifier.name.text;
      if (moduleName === '@gdevelop/tsl') {
        if (importedName !== 'defineMaterial' && !specifier.isTypeOnly) {
          diagnostics.push(
            diagnosticForNode({
              code: 'TSL-SRC-005',
              stage: 'policy',
              message: `"${importedName}" is not an executable @gdevelop/tsl export.`,
              suggestion: 'Import defineMaterial, or use a type-only import.',
              filePath,
              source,
              sourceFile,
              node: specifier,
            })
          );
          return;
        }
        if (importedName === 'defineMaterial' && !specifier.isTypeOnly) {
          if (
            defineMaterialLocalName &&
            defineMaterialLocalName !== localName
          ) {
            diagnostics.push(
              diagnosticForNode({
                code: 'TSL-SRC-003',
                stage: 'policy',
                message: 'defineMaterial may be imported only once.',
                filePath,
                source,
                sourceFile,
                node: specifier,
              })
            );
          }
          defineMaterialLocalName = localName;
          importBindings.push({ moduleName, importedName, localName });
        }
        return;
      }
      if (!TSL_ALLOWED_SYMBOLS.includes(importedName)) {
        diagnostics.push(
          diagnosticForNode({
            code: 'TSL-SRC-005',
            stage: 'policy',
            message: `TSL symbol "${importedName}" is outside the reviewed portable profile.`,
            suggestion: 'Choose a symbol listed in .gdevelop/tsl-catalog.json.',
            filePath,
            source,
            sourceFile,
            node: specifier,
          })
        );
        return;
      }
      importedSymbols.push(importedName);
      importBindings.push({ moduleName, importedName, localName });
    });
  });

  if (importedSymbols.length > TSL_IMPORTED_SYMBOL_LIMIT) {
    diagnostics.push(
      diagnosticForNode({
        code: 'TSL-LIMIT-001',
        stage: 'policy',
        message: `The source imports ${
          importedSymbols.length
        } TSL symbols; the limit is ${TSL_IMPORTED_SYMBOL_LIMIT}.`,
        filePath,
        source,
        sourceFile,
        node: sourceFile,
      })
    );
  }

  if (
    !definition.exportAssignment ||
    definition.exportAssignments.length !== 1 ||
    definition.exportAssignment.isExportEquals ||
    !definition.call ||
    !typescript.isIdentifier(definition.call.expression) ||
    definition.call.expression.text !== defineMaterialLocalName ||
    !definition.definitionObject
  ) {
    diagnostics.push(
      diagnosticForNode({
        code: 'TSL-MAN-001',
        stage: 'policy',
        message:
          'The module must have exactly one default export that directly calls defineMaterial with one literal object.',
        suggestion:
          'Use export default defineMaterial({ apiVersion: 1, ... }).',
        filePath,
        source,
        sourceFile,
        node: definition.exportAssignment || sourceFile,
      })
    );
  }

  sourceFile.statements.forEach(statement => {
    if (
      typescript.isImportDeclaration(statement) ||
      typescript.isExportAssignment(statement) ||
      typescript.isFunctionDeclaration(statement)
    ) {
      return;
    }
    if (typescript.isVariableStatement(statement)) {
      const isConst =
        (statement.declarationList.flags & typescript.NodeFlags.Const) !== 0;
      const allLiteral = statement.declarationList.declarations.every(
        declaration =>
          typescript.isIdentifier(declaration.name) &&
          !!declaration.initializer &&
          isLiteralOnlyExpression(typescript, declaration.initializer)
      );
      if (isConst && allLiteral) return;
    }
    diagnostics.push(
      diagnosticForNode({
        code: 'TSL-SRC-004',
        stage: 'policy',
        message:
          'Top-level code is limited to imports, immutable literal constants, pure helper functions, and the default definition.',
        filePath,
        source,
        sourceFile,
        node: statement,
      })
    );
  });

  const buildProperty = definition.definitionObject
    ? getBuildMethod(typescript, definition.definitionObject)
    : null;
  const buildFunction = getBuildFunctionLike(typescript, buildProperty);
  const { materialNames, parameterNames } = collectBuildContextNames(
    typescript,
    buildFunction
  );
  if (
    buildFunction &&
    (buildFunction.parameters.length !== 1 ||
      !typescript.isObjectBindingPattern(buildFunction.parameters[0].name))
  ) {
    diagnostics.push(
      diagnosticForNode({
        code: 'TSL-MAN-001',
        stage: 'policy',
        message:
          'build must accept exactly one object-destructured context parameter.',
        filePath,
        source,
        sourceFile,
        node: buildFunction,
      })
    );
  }

  let astNodeCount = 0;
  const helperFunctions = new Map<string, any>();
  const callableFunctions = new Map<string, any>();
  const declaredRuntimeIdentifiers = new Set<string>(['undefined']);
  sourceFile.statements.forEach(statement => {
    if (typescript.isFunctionDeclaration(statement) && statement.name) {
      helperFunctions.set(statement.name.text, statement);
    }
  });
  const collectDeclarations = (node: any) => {
    if (typescript.isImportSpecifier(node)) {
      declaredRuntimeIdentifiers.add(node.name.text);
    } else if (typescript.isImportClause(node) && node.name) {
      declaredRuntimeIdentifiers.add(node.name.text);
    } else if (typescript.isNamespaceImport(node)) {
      declaredRuntimeIdentifiers.add(node.name.text);
    } else if (typescript.isVariableDeclaration(node)) {
      collectBindingIdentifiers(
        typescript,
        node.name,
        declaredRuntimeIdentifiers
      );
      if (
        typescript.isIdentifier(node.name) &&
        node.initializer &&
        (typescript.isArrowFunction(node.initializer) ||
          typescript.isFunctionExpression(node.initializer))
      ) {
        callableFunctions.set(node.name.text, node.initializer);
      }
    } else if (
      (typescript.isFunctionDeclaration(node) ||
        typescript.isFunctionExpression(node)) &&
      node.name
    ) {
      declaredRuntimeIdentifiers.add(node.name.text);
      callableFunctions.set(node.name.text, node);
    }
    if (
      typescript.isFunctionDeclaration(node) ||
      typescript.isFunctionExpression(node) ||
      typescript.isArrowFunction(node) ||
      typescript.isMethodDeclaration(node)
    ) {
      node.parameters.forEach(parameter =>
        collectBindingIdentifiers(
          typescript,
          parameter.name,
          declaredRuntimeIdentifiers
        )
      );
    }
    typescript.forEachChild(node, collectDeclarations);
  };
  collectDeclarations(sourceFile);

  const addForbiddenDiagnostic = (
    node: any,
    message: string,
    suggestion?: string
  ) => {
    diagnostics.push(
      diagnosticForNode({
        code: 'TSL-SRC-004',
        stage: 'policy',
        message,
        suggestion,
        filePath,
        source,
        sourceFile,
        node,
      })
    );
  };

  const visit = (node: any) => {
    astNodeCount++;
    if (astNodeCount > TSL_AST_NODE_LIMIT) return;

    if (
      typescript.isClassDeclaration(node) ||
      typescript.isClassExpression(node) ||
      typescript.isNewExpression(node) ||
      typescript.isAwaitExpression(node) ||
      typescript.isYieldExpression(node) ||
      typescript.isTryStatement(node) ||
      typescript.isThrowStatement(node) ||
      typescript.isWithStatement(node) ||
      typescript.isDebuggerStatement(node) ||
      typescript.isForStatement(node) ||
      typescript.isForInStatement(node) ||
      typescript.isForOfStatement(node) ||
      typescript.isWhileStatement(node) ||
      typescript.isDoStatement(node) ||
      typescript.isSwitchStatement(node) ||
      typescript.isEnumDeclaration(node) ||
      typescript.isModuleDeclaration(node) ||
      typescript.isGetAccessorDeclaration(node) ||
      typescript.isSetAccessorDeclaration(node)
    ) {
      addForbiddenDiagnostic(
        node,
        `The ${
          typescript.SyntaxKind[node.kind]
        } construct is not allowed in a TSL material.`,
        'Use finite TSL graph composition without host-language loops, classes, async work, or exceptions.'
      );
    }

    if (
      node.kind === typescript.SyntaxKind.ThisKeyword ||
      node.kind === typescript.SyntaxKind.SuperKeyword ||
      typescript.isMetaProperty(node)
    ) {
      addForbiddenDiagnostic(
        node,
        'Implicit receiver and meta-property access are not available to material source.',
        'Use only the explicit destructured build context and approved imports.'
      );
    }

    if (
      typescript.isVariableDeclarationList(node) &&
      (node.flags & typescript.NodeFlags.Const) === 0
    ) {
      addForbiddenDiagnostic(
        node,
        'Mutable let and var declarations are not allowed.',
        'Use const declarations and construct an immutable graph.'
      );
    }

    if (
      ((typescript.isFunctionDeclaration(node) ||
        typescript.isFunctionExpression(node) ||
        typescript.isArrowFunction(node) ||
        typescript.isMethodDeclaration(node)) &&
        (node.asteriskToken ||
          hasModifier(typescript, node, typescript.SyntaxKind.AsyncKeyword))) ||
      typescript.isImportTypeNode(node)
    ) {
      addForbiddenDiagnostic(
        node,
        'Async, generator, or dynamic module constructs are not allowed.',
        'Keep graph construction synchronous and closed-world.'
      );
    }

    if (typescript.isCallExpression(node)) {
      if (node.expression.kind === typescript.SyntaxKind.ImportKeyword) {
        addForbiddenDiagnostic(
          node,
          'Dynamic import() is not allowed.',
          'Use only the two approved static virtual modules.'
        );
      }
      if (
        typescript.isIdentifier(node.expression) &&
        forbiddenGlobalIdentifiers.has(node.expression.text)
      ) {
        addForbiddenDiagnostic(
          node,
          `Call to ${node.expression.text} is not allowed.`,
          'Use only imported TSL functions and local pure helpers.'
        );
      }
    }

    if (
      typescript.isIdentifier(node) &&
      forbiddenGlobalIdentifiers.has(node.text) &&
      !isNodeInsidePropertyName(typescript, node) &&
      !(node.parent && typescript.isImportSpecifier(node.parent))
    ) {
      addForbiddenDiagnostic(
        node,
        `Global identifier ${node.text} is not available to material source.`,
        'Use only build context values, literal constants, local helpers, and approved TSL imports.'
      );
    }

    if (
      typescript.isIdentifier(node) &&
      !isIdentifierDeclarationOrTypeUse(typescript, node) &&
      !declaredRuntimeIdentifiers.has(node.text)
    ) {
      addForbiddenDiagnostic(
        node,
        `Unresolved or ambient identifier ${
          node.text
        } is not available to material source.`,
        'Declare a local const/helper or use an approved named import.'
      );
    }

    if (
      typescript.isIdentifier(node) &&
      callableFunctions.has(node.text) &&
      !isFunctionIdentifierDeclaration(typescript, node) &&
      !(
        node.parent &&
        typescript.isCallExpression(node.parent) &&
        node.parent.expression === node
      )
    ) {
      addForbiddenDiagnostic(
        node,
        `Helper function "${node.text}" may only be called directly.`,
        'Do not pass, return, store, or dynamically invoke helper functions.'
      );
    }

    if (typescript.isElementAccessExpression(node)) {
      addForbiddenDiagnostic(
        node,
        'Computed property access is not allowed on the closed material API.',
        'Use a documented, statically named property.'
      );
    }

    if (
      (typescript.isPropertyAssignment(node) ||
        typescript.isShorthandPropertyAssignment(node) ||
        typescript.isMethodDeclaration(node)) &&
      forbiddenPropertyNames.has(getPropertyName(typescript, node.name) || '')
    ) {
      addForbiddenDiagnostic(
        node,
        'Prototype, reflection, and function meta-properties are not allowed.',
        'Use plain data properties from the documented facades.'
      );
    }

    if (
      typescript.isPropertyAccessExpression(node) &&
      (node.name.text === 'value' ||
        node.name.text.startsWith('_') ||
        forbiddenPropertyNames.has(node.name.text))
    ) {
      addForbiddenDiagnostic(
        node,
        `Private or mutable node property "${node.name.text}" is not allowed.`,
        'Compose nodes through the reviewed public TSL methods.'
      );
    }

    if (
      typescript.isBinaryExpression(node) &&
      isAssignmentOperator(typescript, node.operatorToken.kind)
    ) {
      const left = node.left;
      const isAllowedMaterialAssignment =
        node.operatorToken.kind === typescript.SyntaxKind.EqualsToken &&
        typescript.isPropertyAccessExpression(left) &&
        typescript.isIdentifier(left.expression) &&
        materialNames.has(left.expression.text) &&
        allowedMaterialFields.has(left.name.text);
      if (!isAllowedMaterialAssignment) {
        addForbiddenDiagnostic(
          node,
          'Assignments are allowed only to documented fields of the owned material facade.',
          'Use const for local values and assign graph nodes only to material fields.'
        );
      }
    }

    if (
      typescript.isBinaryExpression(node) &&
      !isAssignmentOperator(typescript, node.operatorToken.kind) &&
      ![
        typescript.SyntaxKind.PlusToken,
        typescript.SyntaxKind.MinusToken,
        typescript.SyntaxKind.AsteriskToken,
        typescript.SyntaxKind.SlashToken,
        typescript.SyntaxKind.PercentToken,
      ].includes(node.operatorToken.kind)
    ) {
      addForbiddenDiagnostic(
        node,
        'Only ordinary host-number arithmetic operators are allowed in JavaScript expressions.',
        'Use approved TSL node methods for comparisons, logic, and shader control flow.'
      );
    }

    if (
      typescript.isPrefixUnaryExpression(node) &&
      node.operator !== typescript.SyntaxKind.PlusToken &&
      node.operator !== typescript.SyntaxKind.MinusToken
    ) {
      addForbiddenDiagnostic(
        node,
        'Only unary plus and minus on host numbers are allowed.',
        'Use approved TSL node methods instead of JavaScript coercion or mutation.'
      );
    }
    if (typescript.isPostfixUnaryExpression(node)) {
      addForbiddenDiagnostic(node, 'Mutation operators are not allowed.');
    }

    if (
      (typescript.isIfStatement(node) ||
        typescript.isConditionalExpression(node)) &&
      expressionReferencesOneOf(
        typescript,
        typescript.isIfStatement(node) ? node.expression : node.condition,
        parameterNames
      )
    ) {
      addForbiddenDiagnostic(
        node,
        'A GPU parameter node cannot control JavaScript branching.',
        'Use select(condition, whenTrue, whenFalse) or condition.select(...).'
      );
    } else if (
      typescript.isIfStatement(node) ||
      typescript.isConditionalExpression(node)
    ) {
      addForbiddenDiagnostic(
        node,
        'Host-language branching is outside the version-one material subset.',
        'Express dynamic shader selection with an approved TSL node.'
      );
    }

    if (
      typescript.isAsExpression(node) ||
      typescript.isTypeAssertionExpression(node) ||
      node.kind === typescript.SyntaxKind.AnyKeyword
    ) {
      addForbiddenDiagnostic(
        node,
        'Type assertions and any escapes are not allowed.',
        'Fix the expression against the generated TSL declarations.'
      );
    }

    if (
      (typescript.isStringLiteral(node) ||
        typescript.isNoSubstitutionTemplateLiteral(node) ||
        typescript.isTemplateExpression(node)) &&
      backendShaderPattern.test(node.getText(sourceFile))
    ) {
      addForbiddenDiagnostic(
        node,
        'Backend-native shader source is not allowed.',
        'Build the graph with portable TSL nodes.'
      );
    }

    if (
      typescript.isTemplateExpression(node) ||
      typescript.isTaggedTemplateExpression(node) ||
      typescript.isSpreadElement(node) ||
      typescript.isSpreadAssignment(node) ||
      typescript.isRegularExpressionLiteral(node)
    ) {
      addForbiddenDiagnostic(
        node,
        `The ${
          typescript.SyntaxKind[node.kind]
        } construct is outside the closed material subset.`,
        'Use finite literals, destructuring, and approved graph composition.'
      );
    }

    if (
      (typescript.isArrowFunction(node) ||
        typescript.isFunctionExpression(node)) &&
      !(
        (node.parent &&
          typescript.isVariableDeclaration(node.parent) &&
          node.parent.initializer === node) ||
        (buildProperty &&
          typescript.isPropertyAssignment(buildProperty) &&
          buildProperty.initializer === node)
      )
    ) {
      addForbiddenDiagnostic(
        node,
        'Anonymous callbacks and immediately invoked functions are not allowed.',
        'Declare a named const helper and call it directly.'
      );
    }

    if (typescript.isMethodDeclaration(node) && node !== buildProperty) {
      addForbiddenDiagnostic(
        node,
        'Object methods are not allowed outside the material build method.',
        'Declare a local pure helper function instead.'
      );
    }

    if (
      buildFunction &&
      typescript.isReturnStatement(node) &&
      node.expression &&
      !(
        typescript.isIdentifier(node.expression) &&
        node.expression.text === 'undefined'
      ) &&
      node.pos >= buildFunction.pos &&
      node.end <= buildFunction.end
    ) {
      addForbiddenDiagnostic(
        node,
        'The build function must return undefined.',
        'Assign the owned material fields and omit a return value.'
      );
    }

    typescript.forEachChild(node, visit);
  };
  visit(sourceFile);

  if (astNodeCount > TSL_AST_NODE_LIMIT) {
    diagnostics.push(
      diagnosticForNode({
        code: 'TSL-LIMIT-001',
        stage: 'policy',
        message: `The parsed source exceeds the ${TSL_AST_NODE_LIMIT}-node AST limit.`,
        filePath,
        source,
        sourceFile,
        node: sourceFile,
      })
    );
  }

  const callGraph = new Map<string, Set<string>>();
  callableFunctions.forEach((functionNode, name) => {
    const calls = new Set<string>();
    const collectCalls = (node: any) => {
      if (
        typescript.isCallExpression(node) &&
        typescript.isIdentifier(node.expression) &&
        callableFunctions.has(node.expression.text)
      ) {
        calls.add(node.expression.text);
      }
      typescript.forEachChild(node, collectCalls);
    };
    collectCalls(functionNode);
    callGraph.set(name, calls);
  });
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const findCycle = (name: string): ?string => {
    if (visiting.has(name)) return name;
    if (visited.has(name)) return null;
    visiting.add(name);
    for (const calledName of callGraph.get(name) || []) {
      const cycle = findCycle(calledName);
      if (cycle) return cycle;
    }
    visiting.delete(name);
    visited.add(name);
    return null;
  };
  for (const name of callableFunctions.keys()) {
    const cycle = findCycle(name);
    if (cycle) {
      diagnostics.push(
        diagnosticForNode({
          code: 'TSL-SRC-004',
          stage: 'policy',
          message: `Recursive helper call graph detected at "${cycle}".`,
          suggestion: 'Use finite, acyclic helper composition.',
          filePath,
          source,
          sourceFile,
          node: callableFunctions.get(cycle),
        })
      );
      break;
    }
  }

  return {
    diagnostics,
    importedSymbols: Array.from(new Set(importedSymbols)).sort(),
    importBindings,
    defineMaterialLocalName,
    astNodeCount,
    buildProperty,
    buildFunction,
    helperFunctions,
  };
};

const validateAndExtractManifest = ({
  typescript,
  definitionObject,
  sourceFile,
  source,
  filePath,
}: Object): Object => {
  const diagnostics: Array<Object> = [];
  if (!definitionObject) return { diagnostics, manifest: null };

  const propertiesByName = new Map<string, any>();
  definitionObject.properties.forEach(property => {
    const name = getPropertyName(typescript, property.name);
    if (!name || !allowedManifestFields.has(name)) {
      diagnostics.push(
        diagnosticForNode({
          code: 'TSL-MAN-001',
          stage: 'manifest',
          message: `Unknown or computed material manifest field${
            name ? ` "${name}"` : ''
          }.`,
          filePath,
          source,
          sourceFile,
          node: property,
        })
      );
      return;
    }
    if (propertiesByName.has(name)) {
      diagnostics.push(
        diagnosticForNode({
          code: 'TSL-MAN-001',
          stage: 'manifest',
          message: `Duplicate material manifest field "${name}".`,
          filePath,
          source,
          sourceFile,
          node: property,
        })
      );
    }
    propertiesByName.set(name, property);
  });

  const literalProperty = (name: string): any => {
    const property = propertiesByName.get(name);
    return property && typescript.isPropertyAssignment(property)
      ? extractLiteral(typescript, property.initializer)
      : undefined;
  };
  const apiVersion = literalProperty('apiVersion');
  const base = literalProperty('base') || 'inherit';
  const label = literalProperty('label');
  const description = literalProperty('description');
  if (apiVersion !== 1) {
    diagnostics.push(
      diagnosticForNode({
        code: 'TSL-MAN-001',
        stage: 'manifest',
        message: 'apiVersion must be the literal number 1.',
        filePath,
        source,
        sourceFile,
        node: propertiesByName.get('apiVersion') || definitionObject,
      })
    );
  }
  if (!['inherit', 'basic', 'standard', 'physical', 'custom'].includes(base)) {
    diagnostics.push(
      diagnosticForNode({
        code: 'TSL-MAN-001',
        stage: 'manifest',
        message: `Unsupported material base "${String(base)}".`,
        filePath,
        source,
        sourceFile,
        node: propertiesByName.get('base') || definitionObject,
      })
    );
  }
  if (label !== undefined && typeof label !== 'string') {
    diagnostics.push(
      diagnosticForNode({
        code: 'TSL-MAN-001',
        stage: 'manifest',
        message: 'label must be a literal string.',
        filePath,
        source,
        sourceFile,
        node: propertiesByName.get('label'),
      })
    );
  }
  if (description !== undefined && typeof description !== 'string') {
    diagnostics.push(
      diagnosticForNode({
        code: 'TSL-MAN-001',
        stage: 'manifest',
        message: 'description must be a literal string.',
        filePath,
        source,
        sourceFile,
        node: propertiesByName.get('description'),
      })
    );
  }

  const buildProperty = propertiesByName.get('build');
  const buildFunction = getBuildFunctionLike(typescript, buildProperty);
  if (
    !buildFunction ||
    hasModifier(typescript, buildFunction, typescript.SyntaxKind.AsyncKeyword)
  ) {
    diagnostics.push(
      diagnosticForNode({
        code: 'TSL-MAN-001',
        stage: 'manifest',
        message:
          'The definition must contain exactly one synchronous build function.',
        filePath,
        source,
        sourceFile,
        node: buildProperty || definitionObject,
      })
    );
  }

  const parameterSchema: { [string]: any } = {};
  const parametersProperty = propertiesByName.get('parameters');
  let parametersObject = null;
  if (parametersProperty) {
    if (
      typescript.isPropertyAssignment(parametersProperty) &&
      typescript.isObjectLiteralExpression(parametersProperty.initializer)
    ) {
      parametersObject = parametersProperty.initializer;
    } else {
      diagnostics.push(
        diagnosticForNode({
          code: 'TSL-MAN-002',
          stage: 'manifest',
          message: 'parameters must be a literal object.',
          filePath,
          source,
          sourceFile,
          node: parametersProperty,
        })
      );
    }
  }

  if (
    parametersObject &&
    parametersObject.properties.length > TSL_PARAMETER_LIMIT
  ) {
    diagnostics.push(
      diagnosticForNode({
        code: 'TSL-LIMIT-001',
        stage: 'manifest',
        message: `The definition declares ${
          parametersObject.properties.length
        } parameters; the limit is ${TSL_PARAMETER_LIMIT}.`,
        filePath,
        source,
        sourceFile,
        node: parametersObject,
      })
    );
  }

  if (parametersObject) {
    parametersObject.properties.forEach(parameterProperty => {
      const name = getPropertyName(typescript, parameterProperty.name);
      if (
        !name ||
        !parameterNamePattern.test(name) ||
        name.startsWith('__') ||
        name in parameterSchema
      ) {
        diagnostics.push(
          diagnosticForNode({
            code: 'TSL-MAN-002',
            stage: 'manifest',
            message: `Invalid or duplicate parameter name "${name ||
              '<computed>'}".`,
            suggestion:
              'Use a unique JavaScript identifier that does not begin with __.',
            filePath,
            source,
            sourceFile,
            node: parameterProperty,
          })
        );
        return;
      }
      if (
        !typescript.isPropertyAssignment(parameterProperty) ||
        !typescript.isObjectLiteralExpression(parameterProperty.initializer)
      ) {
        diagnostics.push(
          diagnosticForNode({
            code: 'TSL-MAN-002',
            stage: 'manifest',
            message: `Parameter "${name}" must use a literal definition object.`,
            filePath,
            source,
            sourceFile,
            node: parameterProperty,
          })
        );
        return;
      }
      const definition: { [string]: any } = {};
      let invalid = false;
      parameterProperty.initializer.properties.forEach(field => {
        const fieldName = getPropertyName(typescript, field.name);
        if (
          !fieldName ||
          !allowedParameterFields.has(fieldName) ||
          fieldName in definition ||
          !typescript.isPropertyAssignment(field)
        ) {
          invalid = true;
          diagnostics.push(
            diagnosticForNode({
              code: 'TSL-MAN-002',
              stage: 'manifest',
              message: `Parameter "${name}" contains an unknown, duplicate, or non-literal field.`,
              filePath,
              source,
              sourceFile,
              node: field,
            })
          );
          return;
        }
        const value = extractLiteral(typescript, field.initializer);
        if (value === undefined) invalid = true;
        definition[fieldName] = value;
      });
      const type = definition.type;
      const value = definition.default;
      const vectorLength =
        type === 'vec2' ? 2 : type === 'vec3' ? 3 : type === 'vec4' ? 4 : 0;
      const validDefault =
        (type === 'number' &&
          typeof value === 'number' &&
          Number.isFinite(value)) ||
        (type === 'boolean' && typeof value === 'boolean') ||
        (type === 'color' &&
          typeof value === 'string' &&
          /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(value)) ||
        (vectorLength > 0 &&
          Array.isArray(value) &&
          value.length === vectorLength &&
          value.every(
            component =>
              typeof component === 'number' && Number.isFinite(component)
          )) ||
        (type === 'texture' && typeof value === 'string' && !!value);
      const validNumberOptions = ['min', 'max', 'step'].every(fieldName =>
        definition[fieldName] === undefined
          ? true
          : type === 'number' &&
            typeof definition[fieldName] === 'number' &&
            Number.isFinite(definition[fieldName])
      );
      const validLabel =
        definition.label === undefined || typeof definition.label === 'string';
      const validColorSpace =
        definition.colorSpace === undefined ||
        (type === 'texture' &&
          ['srgb', 'linear', 'normal'].includes(definition.colorSpace));
      if (
        invalid ||
        !validDefault ||
        !validNumberOptions ||
        !validLabel ||
        !validColorSpace ||
        (type === 'number' &&
          definition.min !== undefined &&
          definition.max !== undefined &&
          definition.min > definition.max) ||
        (type === 'number' &&
          definition.step !== undefined &&
          definition.step <= 0) ||
        (type === 'number' &&
          definition.min !== undefined &&
          value < definition.min) ||
        (type === 'number' &&
          definition.max !== undefined &&
          value > definition.max)
      ) {
        diagnostics.push(
          diagnosticForNode({
            code: 'TSL-MAN-002',
            stage: 'manifest',
            message: `Parameter "${name}" has an invalid type, default, or option.`,
            suggestion:
              'Use a supported parameter type with a mandatory finite literal default.',
            filePath,
            source,
            sourceFile,
            node: parameterProperty,
          })
        );
        return;
      }
      parameterSchema[name] = definition;
    });
  }

  const assignedMaterialFields = new Set<string>();
  if (buildFunction) {
    const names = collectBuildContextNames(typescript, buildFunction)
      .materialNames;
    const collectAssignments = (node: any) => {
      if (
        typescript.isBinaryExpression(node) &&
        node.operatorToken.kind === typescript.SyntaxKind.EqualsToken &&
        typescript.isPropertyAccessExpression(node.left) &&
        typescript.isIdentifier(node.left.expression) &&
        names.has(node.left.expression.text)
      ) {
        assignedMaterialFields.add(node.left.name.text);
      }
      typescript.forEachChild(node, collectAssignments);
    };
    collectAssignments(buildFunction);
  }
  if (
    base === 'custom' &&
    !assignedMaterialFields.has('fragmentNode') &&
    !assignedMaterialFields.has('outputNode')
  ) {
    diagnostics.push(
      diagnosticForNode({
        code: 'TSL-MAN-001',
        stage: 'manifest',
        message:
          'A custom material must assign fragmentNode or outputNode in build.',
        filePath,
        source,
        sourceFile,
        node: buildProperty || definitionObject,
      })
    );
  }

  const manifest: { [string]: any } = {
    apiVersion: 1,
    base,
    parameters: parameterSchema,
    assignedMaterialFields: Array.from(assignedMaterialFields).sort(),
  };
  if (typeof label === 'string') manifest.label = label;
  if (typeof description === 'string') manifest.description = description;
  return { diagnostics, manifest, buildFunction };
};

const typeCheckSource = ({
  typescript,
  source,
  filePath,
  tslApiDeclaration,
  projectApiDeclaration,
}: Object): Array<Object> => {
  const sourceName = '/material.tsl.ts';
  const tslApiName = '/tsl-api.d.ts';
  const projectApiName = '/project-api.d.ts';
  const compilerOptions = {
    target: typescript.ScriptTarget.ES2020,
    module: typescript.ModuleKind.ESNext,
    moduleResolution: typescript.ModuleResolutionKind.NodeJs,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    noImplicitAny: true,
    noImplicitReturns: true,
    noFallthroughCasesInSwitch: true,
    types: [],
  };
  const virtualFiles: Map<string, string> = new Map([
    [sourceName, source],
    [tslApiName, tslApiDeclaration],
    [projectApiName, projectApiDeclaration || ''],
  ]);
  const host = typescript.createCompilerHost(compilerOptions, true);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  const originalReadFile = host.readFile.bind(host);
  const originalFileExists = host.fileExists.bind(host);
  host.fileExists = name => virtualFiles.has(name) || originalFileExists(name);
  host.readFile = name =>
    virtualFiles.has(name) ? virtualFiles.get(name) : originalReadFile(name);
  host.getSourceFile = (name, languageVersion, onError) => {
    if (virtualFiles.has(name)) {
      return typescript.createSourceFile(
        name,
        virtualFiles.get(name),
        languageVersion,
        true,
        typescript.ScriptKind.TS
      );
    }
    return originalGetSourceFile(name, languageVersion, onError);
  };
  host.writeFile = () => {};
  const program = typescript.createProgram(
    [sourceName, tslApiName, projectApiName],
    compilerOptions,
    host
  );
  const diagnostics: Array<Object> = typescript
    .getPreEmitDiagnostics(program)
    .filter(
      diagnostic => diagnostic.file && diagnostic.file.fileName === sourceName
    )
    .map(diagnostic => {
      const start = diagnostic.start || 0;
      const length = diagnostic.length || 1;
      const startPosition = diagnostic.file.getLineAndCharacterOfPosition(
        start
      );
      const endPosition = diagnostic.file.getLineAndCharacterOfPosition(
        start + length
      );
      return {
        code: 'TSL-SRC-002',
        severity: 'error',
        stage: 'types',
        message: typescript.flattenDiagnosticMessageText(
          diagnostic.messageText,
          '\n'
        ),
        file_path: filePath,
        line: startPosition.line + 1,
        column: startPosition.character + 1,
        end_line: endPosition.line + 1,
        end_column: endPosition.character + 1,
        source_excerpt: getSourceExcerpt(source, startPosition.line + 1),
        suggestion: 'Use the exact declarations in .gdevelop/tsl-api.d.ts.',
        typescript_code: diagnostic.code,
      };
    });
  const checkedSourceFile = program.getSourceFile(sourceName);
  if (checkedSourceFile) {
    const checker = program.getTypeChecker();
    const isHostNumberType = (type: any): boolean => {
      if (type.isUnion && type.isUnion()) {
        return type.types.every(unionType => isHostNumberType(unionType));
      }
      return !!(type.flags & typescript.TypeFlags.NumberLike);
    };
    const visitArithmetic = (node: any) => {
      if (
        typescript.isBinaryExpression(node) &&
        [
          typescript.SyntaxKind.PlusToken,
          typescript.SyntaxKind.MinusToken,
          typescript.SyntaxKind.AsteriskToken,
          typescript.SyntaxKind.SlashToken,
          typescript.SyntaxKind.PercentToken,
        ].includes(node.operatorToken.kind)
      ) {
        const leftType = checker.getTypeAtLocation(node.left);
        const rightType = checker.getTypeAtLocation(node.right);
        if (!isHostNumberType(leftType) || !isHostNumberType(rightType)) {
          diagnostics.push(
            diagnosticForNode({
              code: 'TSL-SRC-004',
              stage: 'types',
              message:
                'JavaScript arithmetic is allowed only when both operands are proven host numbers.',
              suggestion:
                'Use TSL node methods such as .add(), .mul(), or .div() for graph values.',
              filePath,
              source,
              sourceFile: checkedSourceFile,
              node,
            })
          );
        }
      }
      if (
        typescript.isPrefixUnaryExpression(node) &&
        (node.operator === typescript.SyntaxKind.PlusToken ||
          node.operator === typescript.SyntaxKind.MinusToken)
      ) {
        const operandType = checker.getTypeAtLocation(node.operand);
        if (!isHostNumberType(operandType)) {
          diagnostics.push(
            diagnosticForNode({
              code: 'TSL-SRC-004',
              stage: 'types',
              message:
                'JavaScript numeric coercion is allowed only for a proven host number.',
              suggestion:
                'Use an approved TSL node operation for graph values.',
              filePath,
              source,
              sourceFile: checkedSourceFile,
              node,
            })
          );
        }
      }
      typescript.forEachChild(node, visitArithmetic);
    };
    visitArithmetic(checkedSourceFile);
  }
  return diagnostics;
};

const makeCompilationReceipt = ({
  resourceName,
  filePath,
  sourceHash,
  emittedHash,
  projectApiHash,
  tslApiHash,
  tslCatalogHash,
  optionsHash,
  parameterSchemaHash,
  importedSymbols,
}: Object): Object => ({
  apiVersion: 1,
  resourceName,
  normalizedSourcePath: filePath.replace(/\\/g, '/'),
  sourceSha256: sourceHash,
  emittedSha256: emittedHash,
  compilerVersion: TSL_COMPILER_VERSION,
  authoringApiVersion: TSL_AUTHORING_API_VERSION,
  threeRevision: TSL_THREE_REVISION,
  portableProfileVersion: TSL_PORTABLE_PROFILE_VERSION,
  projectApiSha256: projectApiHash,
  tslApiSha256: tslApiHash,
  tslCatalogSha256: tslCatalogHash,
  optionsSha256: optionsHash,
  parameterSchemaSha256: parameterSchemaHash,
  importedSymbols,
});

const emitRegistryArtifact = ({
  typescript,
  source,
  sourceFile,
  definition,
  policy,
  manifest,
  resourceName,
  filePath,
  sourceHash,
}: Object): Object => {
  const helperStatements = sourceFile.statements
    .filter(
      statement =>
        !typescript.isImportDeclaration(statement) &&
        !typescript.isExportAssignment(statement)
    )
    .map(statement => statement.getText(sourceFile))
    .join('\n\n');
  const adapterBindings = policy.importBindings
    .filter(binding => binding.moduleName === 'three/tsl')
    .map(
      binding => `${JSON.stringify(binding.importedName)}: ${binding.localName}`
    )
    .join(', ');
  const defineMaterialBinding = policy.defineMaterialLocalName
    ? `const ${
        policy.defineMaterialLocalName
      } = gdjs.__tslMaterialRuntime.defineMaterial;`
    : '';
  const tslBinding = adapterBindings
    ? `const { ${adapterBindings} } = gdjs.__tslMaterialRuntime.tsl;`
    : '';
  const definitionExpression = definition.exportAssignment.expression.getText(
    sourceFile
  );
  const parameterSchema = stableStringifyTSLCatalog(manifest.parameters).trim();
  const preTranspile = `${defineMaterialBinding}
${tslBinding}
${helperStatements}
const __gdevelopDefinition = ${definitionExpression};
const __gdevelopEntry = Object.freeze({
  apiVersion: 1,
  authoringApiVersion: "${TSL_AUTHORING_API_VERSION}",
  compilerVersion: "${TSL_COMPILER_VERSION}",
  threeRevision: "${TSL_THREE_REVISION}",
  portableProfileVersion: "${TSL_PORTABLE_PROFILE_VERSION}",
  sourceHash: ${JSON.stringify(sourceHash)},
  base: __gdevelopDefinition.base || "inherit",
  label: __gdevelopDefinition.label || ${JSON.stringify(resourceName)},
  description: __gdevelopDefinition.description || "",
  parameterSchema: Object.freeze(${parameterSchema}),
  importedSymbols: Object.freeze(${JSON.stringify(policy.importedSymbols)}),
  build: __gdevelopDefinition.build
});
gdjs.__tslMaterialRegistry.register(${JSON.stringify(
    resourceName
  )}, __gdevelopEntry);
`;
  const transpiled = typescript.transpileModule(preTranspile, {
    compilerOptions: {
      target: typescript.ScriptTarget.ES2019,
      module: typescript.ModuleKind.None,
      removeComments: false,
      sourceMap: true,
      inlineSources: false,
    },
    fileName: filePath.replace(/\\/g, '/'),
  });
  const emitted = `// Generated by GDevelop TSL material compiler v${TSL_COMPILER_VERSION}. Do not edit.\n(function () {\n  "use strict";\n${transpiled.outputText
    .replace(/^/gm, '  ')
    .replace(/\n\s*\/\/# sourceMappingURL=.*$/m, '')}\n})();\n`;
  return {
    emitted,
    sourceMap: transpiled.sourceMapText || '',
  };
};

const createInstrumentedNodeFactory = (limit: number): Object => {
  let count = 0;
  const createNode = (kind: string = 'node'): any => {
    count++;
    if (count > limit) {
      const error: any = new Error(
        `The material graph exceeds the ${limit}-node limit.`
      );
      error.code = 'TSL-LIMIT-001';
      throw error;
    }
    const target = Object.freeze({ __gdevelopTSLNode: true, kind });
    const proxy = new Proxy(target, {
      get(nodeTarget, property) {
        if (property === '__gdevelopTSLNode') return true;
        if (property === 'kind') return nodeTarget.kind;
        if (property === 'then') return undefined;
        if (property === 'valueOf') {
          return () => {
            throw new Error('A TSL node cannot be coerced in JavaScript.');
          };
        }
        if (property === 'toString') return () => `[TSL ${nodeTarget.kind}]`;
        if (
          ['x', 'y', 'z', 'w', 'r', 'g', 'b', 'a'].includes(String(property))
        ) {
          return createNode('float');
        }
        return (...args) => {
          args.forEach(argument => {
            if (argument && typeof argument.then === 'function') {
              throw new Error('Promises are not valid TSL node inputs.');
            }
          });
          if (
            [
              'greaterThan',
              'greaterThanEqual',
              'lessThan',
              'lessThanEqual',
              'equal',
              'and',
              'or',
              'not',
            ].includes(String(property))
          ) {
            return createNode('bool');
          }
          if (property === 'select') return args[0] || createNode(kind);
          return createNode(kind);
        };
      },
    });
    return proxy;
  };
  const tsl: { [string]: any } = {};
  TSL_ALLOWED_SYMBOLS.forEach(symbol => {
    if (
      [
        'time',
        'positionLocal',
        'positionView',
        'positionWorld',
        'normalLocal',
        'normalView',
        'normalWorld',
      ].includes(symbol)
    ) {
      tsl[symbol] = createNode(symbol === 'time' ? 'float' : 'vec3');
    } else {
      tsl[symbol] = (...args) => {
        const firstNode = args.find(
          argument => argument && argument.__gdevelopTSLNode
        );
        return createNode(firstNode ? firstNode.kind : symbol);
      };
    }
  });
  return { tsl, createNode, getCount: () => count };
};

const assignBinding = (
  typescript: any,
  bindingName: any,
  value: any,
  env: Map<string, any>
): void => {
  if (typescript.isIdentifier(bindingName)) {
    env.set(bindingName.text, value);
    return;
  }
  if (typescript.isObjectBindingPattern(bindingName)) {
    bindingName.elements.forEach(element => {
      const sourceName = getPropertyName(
        typescript,
        element.propertyName || element.name
      );
      assignBinding(
        typescript,
        element.name,
        sourceName && value ? value[sourceName] : undefined,
        env
      );
    });
    return;
  }
  if (typescript.isArrayBindingPattern(bindingName)) {
    bindingName.elements.forEach((element, index) => {
      if (typescript.isBindingElement(element)) {
        assignBinding(typescript, element.name, value[index], env);
      }
    });
    return;
  }
  throw new Error('Unsupported binding pattern in graph interpreter.');
};

const executeBuildWithInterpreter = ({
  typescript,
  sourceFile,
  policy,
  manifest,
  tslAdapter,
  context,
}: Object): Object => {
  const env = new Map<string, any>();
  policy.importBindings.forEach(binding => {
    if (binding.moduleName === 'three/tsl') {
      env.set(binding.localName, tslAdapter[binding.importedName]);
    }
  });

  const evaluateExpression: (any, Map<string, any>) => any = (
    node: any,
    localEnv: Map<string, any>
  ): any => {
    if (typescript.isStringLiteral(node)) return node.text;
    if (typescript.isNumericLiteral(node)) return Number(node.text);
    if (node.kind === typescript.SyntaxKind.TrueKeyword) return true;
    if (node.kind === typescript.SyntaxKind.FalseKeyword) return false;
    if (node.kind === typescript.SyntaxKind.NullKeyword) return null;
    if (node.kind === typescript.SyntaxKind.UndefinedKeyword) return undefined;
    if (typescript.isIdentifier(node)) {
      if (!localEnv.has(node.text)) {
        throw new Error(
          `Unresolved identifier "${node.text}" in graph interpreter.`
        );
      }
      return localEnv.get(node.text);
    }
    if (typescript.isParenthesizedExpression(node)) {
      return evaluateExpression(node.expression, localEnv);
    }
    if (typescript.isPrefixUnaryExpression(node)) {
      const value = evaluateExpression(node.operand, localEnv);
      if (node.operator === typescript.SyntaxKind.MinusToken) return -value;
      if (node.operator === typescript.SyntaxKind.PlusToken) return +value;
      if (node.operator === typescript.SyntaxKind.ExclamationToken)
        return !value;
      throw new Error('Unsupported unary operator in graph interpreter.');
    }
    if (typescript.isArrayLiteralExpression(node)) {
      return node.elements.map(element =>
        evaluateExpression(element, localEnv)
      );
    }
    if (typescript.isObjectLiteralExpression(node)) {
      const result: { [string]: any } = {};
      node.properties.forEach(property => {
        if (typescript.isPropertyAssignment(property)) {
          const name = getPropertyName(typescript, property.name);
          if (!name)
            throw new Error('Computed object property is not supported.');
          result[name] = evaluateExpression(property.initializer, localEnv);
        } else if (typescript.isShorthandPropertyAssignment(property)) {
          result[property.name.text] = localEnv.get(property.name.text);
        } else {
          throw new Error('Unsupported object member in graph interpreter.');
        }
      });
      return result;
    }
    if (typescript.isPropertyAccessExpression(node)) {
      const owner = evaluateExpression(node.expression, localEnv);
      if (owner === null || owner === undefined) {
        throw new Error(`Cannot read ${node.name.text} from an empty value.`);
      }
      return owner[node.name.text];
    }
    if (typescript.isCallExpression(node)) {
      const args = node.arguments.map(argument =>
        evaluateExpression(argument, localEnv)
      );
      if (typescript.isPropertyAccessExpression(node.expression)) {
        const owner = evaluateExpression(node.expression.expression, localEnv);
        const callable = owner[node.expression.name.text];
        if (typeof callable !== 'function') {
          throw new Error(`${node.expression.name.text} is not callable.`);
        }
        return callable.apply(owner, args);
      }
      const callable = evaluateExpression(node.expression, localEnv);
      if (typeof callable !== 'function')
        throw new Error('Value is not callable.');
      return callable(...args);
    }
    if (typescript.isBinaryExpression(node)) {
      if (node.operatorToken.kind === typescript.SyntaxKind.EqualsToken) {
        if (!typescript.isPropertyAccessExpression(node.left)) {
          throw new Error('Only material field assignment is supported.');
        }
        const owner = evaluateExpression(node.left.expression, localEnv);
        const value = evaluateExpression(node.right, localEnv);
        owner[node.left.name.text] = value;
        return value;
      }
      const left = evaluateExpression(node.left, localEnv);
      const right = evaluateExpression(node.right, localEnv);
      if (typeof left !== 'number' || typeof right !== 'number') {
        throw new Error(
          'Host arithmetic is allowed only for literal host numbers.'
        );
      }
      switch (node.operatorToken.kind) {
        case typescript.SyntaxKind.PlusToken:
          return left + right;
        case typescript.SyntaxKind.MinusToken:
          return left - right;
        case typescript.SyntaxKind.AsteriskToken:
          return left * right;
        case typescript.SyntaxKind.SlashToken:
          return left / right;
        case typescript.SyntaxKind.PercentToken:
          return left % right;
        default:
          throw new Error('Unsupported host arithmetic operator.');
      }
    }
    if (
      typescript.isArrowFunction(node) ||
      typescript.isFunctionExpression(node)
    ) {
      return createInterpretedFunction(node, localEnv);
    }
    if (
      typescript.isAsExpression(node) ||
      typescript.isNonNullExpression(node)
    ) {
      return evaluateExpression(node.expression, localEnv);
    }
    throw new Error(
      `Unsupported ${
        typescript.SyntaxKind[node.kind]
      } expression in graph interpreter.`
    );
  };

  const executeStatements: (Array<any>, Map<string, any>) => Object = (
    statements: Array<any>,
    localEnv: Map<string, any>
  ): Object => {
    for (const statement of statements) {
      if (typescript.isVariableStatement(statement)) {
        statement.declarationList.declarations.forEach(declaration => {
          const value = declaration.initializer
            ? evaluateExpression(declaration.initializer, localEnv)
            : undefined;
          assignBinding(typescript, declaration.name, value, localEnv);
        });
      } else if (typescript.isExpressionStatement(statement)) {
        evaluateExpression(statement.expression, localEnv);
      } else if (typescript.isReturnStatement(statement)) {
        return {
          returned: true,
          value: statement.expression
            ? evaluateExpression(statement.expression, localEnv)
            : undefined,
        };
      } else if (typescript.isBlock(statement)) {
        const result = executeStatements(
          statement.statements,
          new Map(localEnv)
        );
        if (result.returned) return result;
      } else if (
        typescript.isFunctionDeclaration(statement) &&
        statement.name
      ) {
        localEnv.set(
          statement.name.text,
          createInterpretedFunction(statement, localEnv)
        );
      } else {
        throw new Error(
          `Unsupported ${
            typescript.SyntaxKind[statement.kind]
          } statement in graph interpreter.`
        );
      }
    }
    return { returned: false, value: undefined };
  };

  const createInterpretedFunction: (
    any,
    Map<string, any>
  ) => (...args: Array<any>) => any = (
    functionNode: any,
    closureEnv: Map<string, any>
  ) => (...args: Array<any>): any => {
    const localEnv = new Map(closureEnv);
    functionNode.parameters.forEach((parameter, index) => {
      assignBinding(typescript, parameter.name, args[index], localEnv);
    });
    if (typescript.isBlock(functionNode.body)) {
      return executeStatements(functionNode.body.statements, localEnv).value;
    }
    return evaluateExpression(functionNode.body, localEnv);
  };

  sourceFile.statements.forEach(statement => {
    if (typescript.isVariableStatement(statement)) {
      statement.declarationList.declarations.forEach(declaration => {
        env.set(
          declaration.name.text,
          extractLiteral(typescript, declaration.initializer)
        );
      });
    }
  });
  policy.helperFunctions.forEach((functionNode, name) => {
    env.set(name, (...args) => {
      const callable = createInterpretedFunction(functionNode, env);
      return callable(...args);
    });
  });
  const build = createInterpretedFunction(policy.buildFunction, env);
  const returnValue = build(context);
  if (returnValue !== undefined) {
    throw new Error(
      'The build function returned a value instead of undefined.'
    );
  }
  return { material: context.material };
};

const createGraphContext = ({ manifest, nodeFactory }: Object): Object => {
  const parameters: { [string]: any } = {};
  Object.keys(manifest.parameters).forEach(name => {
    parameters[name] = nodeFactory.createNode(manifest.parameters[name].type);
  });
  const materialTarget: { [string]: any } = {
    colorNode: null,
    opacityNode: null,
    emissiveNode: null,
    roughnessNode: null,
    metalnessNode: null,
    normalNode: null,
    positionNode: null,
    fragmentNode: null,
    outputNode: null,
    transparent: false,
    depthWrite: true,
    depthTest: true,
    side: 'front',
    alphaTest: 0,
  };
  const material = new Proxy(materialTarget, {
    set(target, property, value) {
      if (!allowedMaterialFields.has(String(property))) {
        throw new Error(
          `Material field "${String(property)}" is not writable.`
        );
      }
      if (
        TSL_MATERIAL_FACADE_NODE_FIELDS.includes(String(property)) &&
        value !== null &&
        !(value && value.__gdevelopTSLNode)
      ) {
        throw new Error(
          `Material node field "${String(property)}" requires a TSL node.`
        );
      }
      target[property] = value;
      return true;
    },
  });
  return {
    material,
    inputs: {
      baseColor: nodeFactory.createNode('color'),
      opacity: nodeFactory.createNode('float'),
      emissive: nodeFactory.createNode('color'),
      roughness: nodeFactory.createNode('float'),
      metalness: nodeFactory.createNode('float'),
      normal: nodeFactory.createNode('vec3'),
    },
    parameters,
    source: Object.freeze({
      name: 'Validation material',
      kind: 'standard',
      hasColorMap: false,
      hasNormalMap: false,
      hasSkinning: false,
      hasMorphTargets: false,
    }),
  };
};

export const compileTSLMaterialSource = ({
  source,
  resourceName,
  filePath,
  projectApiDeclaration = '',
  tslApiDeclaration,
  tslCatalogJson,
  options = {},
}: Object): Object => {
  const normalizedSource = normalizeSource(source || '');
  const normalizedFilePath = (
    filePath || `${resourceName || 'Material'}.tsl.ts`
  ).replace(/\\/g, '/');
  const normalizedResourceName = resourceName || '';
  const diagnostics: Array<Object> = [];
  const metrics = {
    source_bytes: sourceBytes(normalizedSource),
    ast_node_count: 0,
    parse_milliseconds: 0,
  };
  const typescript = loadTypeScript();
  if (!typescript) {
    return {
      success: false,
      valid: false,
      infrastructureCode: 'TSL-MCP-VALIDATOR-UNAVAILABLE',
      diagnostics: [],
      metrics,
    };
  }
  if (metrics.source_bytes > TSL_SOURCE_MAX_BYTES) {
    diagnostics.push({
      code: 'TSL-LIMIT-001',
      severity: 'error',
      stage: 'parse',
      message: `The source is ${
        metrics.source_bytes
      } bytes; the limit is ${TSL_SOURCE_MAX_BYTES}.`,
      file_path: normalizedFilePath,
      line: 1,
      column: 1,
      end_line: 1,
      end_column: 1,
      source_excerpt: getSourceExcerpt(normalizedSource, 1),
    });
    return {
      success: true,
      valid: false,
      diagnostics,
      completedStages: ['parse'],
      metrics,
    };
  }

  let apiDeclaration = tslApiDeclaration;
  let catalogJson = tslCatalogJson;
  if (!apiDeclaration || !catalogJson) {
    const generated = buildTSLMaterialAuthoringArtifacts(projectApiDeclaration);
    apiDeclaration = generated.tslApi;
    catalogJson = generated.tslCatalog;
  }
  const catalogVerification = verifyTSLMaterialAuthoringArtifacts({
    projectApiDeclaration,
    tslApiDeclaration: apiDeclaration,
    tslCatalogJson: catalogJson,
  });
  if (!catalogVerification.valid) {
    return {
      success: false,
      valid: false,
      infrastructureCode: catalogVerification.code,
      infrastructureMessage: catalogVerification.message,
      diagnostics: [],
      metrics,
    };
  }

  const compilationCacheKey = sha256(
    stableStringifyTSLCatalog({
      compilerVersion: TSL_COMPILER_VERSION,
      authoringApiVersion: TSL_AUTHORING_API_VERSION,
      threeRevision: TSL_THREE_REVISION,
      portableProfileVersion: TSL_PORTABLE_PROFILE_VERSION,
      resourceName: normalizedResourceName,
      normalizedSourcePath: normalizedFilePath,
      sourceSha256: sha256(normalizedSource),
      projectApiSha256: catalogVerification.hashes.projectApi,
      tslApiSha256: catalogVerification.hashes.tslApi,
      tslCatalogSha256: catalogVerification.hashes.tslCatalog,
      options,
    })
  );
  const cachedCompilation = compilationCache.get(compilationCacheKey);
  if (cachedCompilation) {
    // Refresh insertion order so the bounded map behaves as an LRU cache.
    compilationCache.delete(compilationCacheKey);
    compilationCache.set(compilationCacheKey, cachedCompilation);
    return cloneCompilationResult(cachedCompilation, true);
  }

  const parseStartedAt = now();
  const sourceFile = typescript.createSourceFile(
    normalizedFilePath,
    normalizedSource,
    typescript.ScriptTarget.Latest,
    true,
    typescript.ScriptKind.TS
  );
  metrics.parse_milliseconds = now() - parseStartedAt;
  const parseDiagnostics = sourceFile.parseDiagnostics || [];
  parseDiagnostics.forEach(parseDiagnostic => {
    const start = parseDiagnostic.start || 0;
    const end = start + (parseDiagnostic.length || 1);
    const startPosition = sourceFile.getLineAndCharacterOfPosition(start);
    const endPosition = sourceFile.getLineAndCharacterOfPosition(end);
    diagnostics.push({
      code: 'TSL-SRC-001',
      severity: 'error',
      stage: 'parse',
      message: typescript.flattenDiagnosticMessageText(
        parseDiagnostic.messageText,
        '\n'
      ),
      file_path: normalizedFilePath,
      line: startPosition.line + 1,
      column: startPosition.character + 1,
      end_line: endPosition.line + 1,
      end_column: endPosition.character + 1,
      source_excerpt: getSourceExcerpt(
        normalizedSource,
        startPosition.line + 1
      ),
    });
  });
  if (diagnostics.length) {
    return {
      success: true,
      valid: false,
      diagnostics,
      completedStages: ['parse'],
      metrics,
      sourceHash: sha256(normalizedSource),
    };
  }

  const definition = findDefinition(typescript, sourceFile);
  const policy = validateImportsAndPolicy({
    typescript,
    sourceFile,
    source: normalizedSource,
    filePath: normalizedFilePath,
    definition,
  });
  metrics.ast_node_count = policy.astNodeCount;
  diagnostics.push(...policy.diagnostics);
  if (policy.diagnostics.length) {
    return {
      success: true,
      valid: false,
      diagnostics,
      completedStages: ['parse', 'policy'],
      metrics,
      sourceHash: sha256(normalizedSource),
    };
  }

  const typeDiagnostics = typeCheckSource({
    typescript,
    source: normalizedSource,
    filePath: normalizedFilePath,
    tslApiDeclaration: apiDeclaration,
    projectApiDeclaration,
  });
  diagnostics.push(...typeDiagnostics);
  if (typeDiagnostics.length) {
    return {
      success: true,
      valid: false,
      diagnostics,
      completedStages: ['parse', 'policy', 'types'],
      metrics,
      sourceHash: sha256(normalizedSource),
    };
  }

  const manifestResult = validateAndExtractManifest({
    typescript,
    definitionObject: definition.definitionObject,
    sourceFile,
    source: normalizedSource,
    filePath: normalizedFilePath,
  });
  diagnostics.push(...manifestResult.diagnostics);
  if (manifestResult.diagnostics.length || !manifestResult.manifest) {
    return {
      success: true,
      valid: false,
      diagnostics,
      completedStages: ['parse', 'policy', 'types', 'manifest'],
      metrics,
      sourceHash: sha256(normalizedSource),
    };
  }

  const sourceHash = sha256(normalizedSource);
  const emission = emitRegistryArtifact({
    typescript,
    source: normalizedSource,
    sourceFile,
    definition,
    policy,
    manifest: manifestResult.manifest,
    resourceName: normalizedResourceName,
    filePath: normalizedFilePath,
    sourceHash,
  });
  const emittedHash = sha256(emission.emitted);
  const optionsHash = sha256(stableStringifyTSLCatalog(options));
  const parameterSchemaHash = sha256(
    stableStringifyTSLCatalog(manifestResult.manifest.parameters)
  );
  const receipt = makeCompilationReceipt({
    resourceName: normalizedResourceName,
    filePath: normalizedFilePath,
    sourceHash,
    emittedHash,
    projectApiHash: catalogVerification.hashes.projectApi,
    tslApiHash: catalogVerification.hashes.tslApi,
    tslCatalogHash: catalogVerification.hashes.tslCatalog,
    optionsHash,
    parameterSchemaHash,
    importedSymbols: policy.importedSymbols,
  });

  const result = {
    success: true,
    valid: true,
    diagnostics,
    completedStages: ['parse', 'policy', 'types', 'manifest'],
    sourceHash,
    emitted: emission.emitted,
    sourceMap: emission.sourceMap,
    emittedHash,
    receipt,
    manifest: manifestResult.manifest,
    importedSymbols: policy.importedSymbols,
    metrics,
    internal: {
      typescript,
      sourceFile,
      policy: {
        ...policy,
        helperFunctions: policy.helperFunctions,
      },
    },
  };
  storeCompilationCacheEntry(compilationCacheKey, result);
  return cloneCompilationResult(result, false);
};

let backendValidator = null;

export const setTSLMaterialBackendValidator = (validator: ?Function): void => {
  backendValidator = validator;
};

export const validateTSLMaterialSource = async ({
  validationLevel = 'backend',
  target = TSL_CURRENT_TARGET,
  fixture = {},
  ...compileOptions
}: Object): Promise<Object> => {
  const compiled = compileTSLMaterialSource(compileOptions);
  if (!compiled.success || !compiled.valid || validationLevel === 'static') {
    return {
      ...compiled,
      validationLevel,
      target,
      structurallyValid: !!compiled.valid,
      graphValidated: false,
      nodeBuilderValidated: false,
      gpuValidated: false,
      modelValidated: false,
      activationReady: false,
    };
  }

  const graphStartedAt = now();
  try {
    const nodeFactory = createInstrumentedNodeFactory(TSL_GRAPH_NODE_LIMIT);
    const graphContext = createGraphContext({
      manifest: compiled.manifest,
      nodeFactory,
    });
    executeBuildWithInterpreter({
      typescript: compiled.internal.typescript,
      sourceFile: compiled.internal.sourceFile,
      policy: compiled.internal.policy,
      manifest: compiled.manifest,
      tslAdapter: nodeFactory.tsl,
      context: graphContext,
    });
    compiled.metrics.tsl_node_count = nodeFactory.getCount();
    compiled.metrics.graph_build_milliseconds = now() - graphStartedAt;
  } catch (error) {
    const code =
      error && error.code === 'TSL-LIMIT-001' ? error.code : 'TSL-VAL-001';
    return {
      ...compiled,
      valid: false,
      diagnostics: [
        ...compiled.diagnostics,
        {
          code,
          severity: 'error',
          stage: 'graph',
          message:
            error && error.message
              ? error.message
              : 'The isolated TSL graph build failed.',
          file_path: compileOptions.filePath,
        },
      ],
      completedStages: [...compiled.completedStages, 'graph'],
      validationLevel,
      target,
      structurallyValid: true,
      graphValidated: false,
      nodeBuilderValidated: false,
      gpuValidated: false,
      modelValidated: false,
      activationReady: false,
    };
  }

  if (validationLevel === 'graph') {
    return {
      ...compiled,
      completedStages: [...compiled.completedStages, 'graph'],
      validationLevel,
      target,
      structurallyValid: true,
      graphValidated: true,
      nodeBuilderValidated: false,
      gpuValidated: false,
      modelValidated: false,
      activationReady: false,
    };
  }

  if (!backendValidator) {
    return {
      ...compiled,
      success: false,
      valid: false,
      infrastructureCode: 'TSL-MCP-GPU-UNAVAILABLE',
      infrastructureMessage:
        'No matching TSL renderer validation service is registered.',
      diagnostics: [
        ...compiled.diagnostics,
        {
          code: 'TSL-VAL-004',
          severity: 'info',
          stage: 'gpu',
          message:
            'Structural and graph checks passed, but no graphics context was available.',
          file_path: compileOptions.filePath,
        },
      ],
      completedStages: [...compiled.completedStages, 'graph'],
      validationLevel,
      target,
      structurallyValid: true,
      graphValidated: true,
      nodeBuilderValidated: false,
      gpuValidated: false,
      modelValidated: false,
      activationReady: false,
    };
  }

  try {
    const backendResult = await backendValidator({
      compiled,
      fixture,
      validationLevel,
      target,
      executeBuildWithInterpreter: ({ tslAdapter, context }) =>
        executeBuildWithInterpreter({
          typescript: compiled.internal.typescript,
          sourceFile: compiled.internal.sourceFile,
          policy: compiled.internal.policy,
          manifest: compiled.manifest,
          tslAdapter,
          context,
        }),
    });
    if (backendResult && backendResult.infrastructureCode) {
      return {
        ...compiled,
        success: false,
        valid: false,
        infrastructureCode: backendResult.infrastructureCode,
        infrastructureMessage:
          backendResult.infrastructureMessage ||
          'The TSL backend validator is unavailable.',
        diagnostics: [
          ...compiled.diagnostics,
          ...(backendResult.diagnostics || []),
        ],
        completedStages: [...compiled.completedStages, 'graph'],
        validationLevel,
        target,
        structurallyValid: true,
        graphValidated: true,
        nodeBuilderValidated: false,
        gpuValidated: false,
        modelValidated: false,
        activationReady: false,
      };
    }
    const nodeBuilderValidated = !!backendResult.nodeBuilderValidated;
    const gpuValidated = !!backendResult.gpuValidated;
    const modelValidated =
      validationLevel === 'model' ? !!backendResult.modelValidated : false;
    const backendCompletedStages = Array.isArray(backendResult.completedStages)
      ? backendResult.completedStages.filter(stage =>
          ['nodeBuilder', 'gpu', 'model'].includes(stage)
        )
      : [
          'nodeBuilder',
          ...(nodeBuilderValidated ? ['gpu'] : []),
          ...(validationLevel === 'model' && modelValidated ? ['model'] : []),
        ];
    const valid =
      nodeBuilderValidated &&
      gpuValidated &&
      (validationLevel !== 'model' || modelValidated);
    return {
      ...compiled,
      valid,
      diagnostics: [
        ...compiled.diagnostics,
        ...(backendResult.diagnostics || []),
      ],
      metrics: { ...compiled.metrics, ...(backendResult.metrics || {}) },
      completedStages: [
        ...compiled.completedStages,
        'graph',
        ...backendCompletedStages,
      ],
      validationLevel,
      target,
      structurallyValid: true,
      graphValidated: true,
      nodeBuilderValidated,
      gpuValidated,
      modelValidated,
      previewDataUrl: backendResult.previewDataUrl || '',
      previewRenderStats: backendResult.previewRenderStats || null,
      referencePreviewDataUrl: backendResult.referencePreviewDataUrl || '',
      referenceRenderStats: backendResult.referenceRenderStats || null,
      activationReady: valid,
    };
  } catch (error) {
    if (
      error &&
      typeof error.code === 'string' &&
      error.code.startsWith('TSL-MCP-')
    ) {
      return {
        ...compiled,
        success: false,
        valid: false,
        infrastructureCode: error.code,
        infrastructureMessage:
          error && error.message
            ? error.message
            : 'The TSL backend validator is unavailable.',
        diagnostics: compiled.diagnostics,
        completedStages: [...compiled.completedStages, 'graph'],
        validationLevel,
        target,
        structurallyValid: true,
        graphValidated: true,
        nodeBuilderValidated: false,
        gpuValidated: false,
        modelValidated: false,
        activationReady: false,
      };
    }
    return {
      ...compiled,
      valid: false,
      diagnostics: [
        ...compiled.diagnostics,
        {
          code: 'TSL-VAL-003',
          severity: 'error',
          stage: 'gpu',
          message:
            error && error.message
              ? error.message
              : 'The validation draw failed.',
          file_path: compileOptions.filePath,
        },
      ],
      completedStages: [
        ...compiled.completedStages,
        'graph',
        'nodeBuilder',
        'gpu',
      ],
      validationLevel,
      target,
      structurallyValid: true,
      graphValidated: true,
      nodeBuilderValidated: false,
      gpuValidated: false,
      modelValidated: false,
      activationReady: false,
    };
  }
};

export const createTSLValidationId = ({
  result,
  target,
  validationLevel,
  fixture,
  modelHash,
}: Object): string =>
  sha256(
    stableStringifyTSLCatalog({
      validatorVersion: TSL_VALIDATOR_VERSION,
      compilerVersion: TSL_COMPILER_VERSION,
      authoringApiVersion: TSL_AUTHORING_API_VERSION,
      threeRevision: TSL_THREE_REVISION,
      portableProfileVersion: TSL_PORTABLE_PROFILE_VERSION,
      sourceHash: result.sourceHash || '',
      emittedHash: result.emittedHash || '',
      receipt: result.receipt || null,
      target,
      validationLevel,
      fixture,
      modelHash: modelHash || null,
      valid: !!result.valid,
      completedStages: result.completedStages || [],
    })
  );
