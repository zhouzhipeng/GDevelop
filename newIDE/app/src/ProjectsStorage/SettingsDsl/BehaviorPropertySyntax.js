// @noflow

// These are authoring aliases, not new runtime instructions. Property accessors
// remain private to their behavior and use the existing catalog type checking.
export const behaviorTypeFromFileUri = fileUri => {
  if (!fileUri) return null;
  const match = /(?:^|\/)extensions\/([^/]+)\/behaviors\/([^/]+)\/functions\/[^/]+\.gdl$/.exec(
    fileUri.replace(/\\/g, '/')
  );
  if (!match) return null;
  return `${decodeURIComponent(match[1])}::${decodeURIComponent(match[2])}`;
};

export const createBehaviorPropertySyntax = (catalog, fail) => {
  const entries = { action: new Map(), condition: new Map() };
  for (const kind of ['action', 'condition']) {
    for (const entry of catalog[`${kind}s`]) {
      // Generated catalogs identify the behavior on the behavior parameter;
      // older in-memory catalogs may still carry an explicit owner.
      const owner = entry.owner?.behaviorType || entry.parameters[1]?.extraInfo;
      const prefix =
        owner && `${owner}::${kind === 'action' ? 'SetProperty' : 'Property'}`;
      if (!prefix || !entry.type.startsWith(prefix)) continue;
      if (
        entry.parameters[0]?.valueKind !== 'object' ||
        entry.parameters[1]?.valueKind !== 'behavior'
      )
        continue;
      entries[kind].set(`${owner}\0${entry.type.slice(prefix.length)}`, entry);
    }
  }
  const find = (kind, name, fileUri) => {
    const owner = behaviorTypeFromFileUri(fileUri);
    if (!owner)
      fail(
        'GDL_PROPERTY_CONTEXT',
        'Property aliases require a behavior function .gdl file.'
      );
    if (typeof name !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))
      fail(
        'GDL_PROPERTY_NAME',
        'Property name must be a literal identifier string.',
        'name'
      );
    const entry = entries[kind].get(`${owner}\0${name}`);
    if (!entry)
      fail(
        'GDL_PROPERTY_UNKNOWN',
        `Unknown ${kind} property ${name} in ${owner}.`,
        'name'
      );
    return entry;
  };
  const lowerInstruction = (kind, type, args, fileUri) => {
    if (type !== (kind === 'action' ? 'setProperty' : 'getProperty'))
      return null;
    const entry = find(kind, args.name, fileUri);
    const allowed = [
      'name',
      'object',
      'behavior',
      'value',
      kind === 'action' ? 'modification_sign' : 'comparison_sign',
    ];
    for (const name of Object.keys(args)) {
      if (!allowed.includes(name))
        fail(
          'GDL_CATALOG_UNKNOWN_PARAMETER',
          `Unknown property argument ${name}.`,
          name
        );
    }
    const lowered = {
      object: { __settingsReference: true, source: 'Object' },
      behavior: { __settingsReference: true, source: 'Behavior' },
      ...args,
    };
    delete lowered.name;
    const valueParameter = entry.parameters.find(
      p => p.valueKind === 'boolean'
    );
    if (valueParameter) {
      if (args.value === undefined)
        fail('GDL_PROPERTY_VALUE', 'setProperty requires value.', 'value');
      delete lowered.value;
      lowered[valueParameter.dslName] = args.value;
    } else if (entry.parameters.some(p => p.dslName === 'value')) {
      if (args.value === undefined)
        fail('GDL_PROPERTY_VALUE', `${type} requires value.`, 'value');
      const operator =
        kind === 'action' ? 'modification_sign' : 'comparison_sign';
      if (lowered[operator] === undefined) lowered[operator] = '=';
    }
    return { entry, args: lowered };
  };
  const formatInstruction = (kind, entry, operands, fileUri) => {
    const owner = behaviorTypeFromFileUri(fileUri);
    const prefix = `${owner}::${
      kind === 'action' ? 'SetProperty' : 'Property'
    }`;
    const name = entry.type.startsWith(prefix)
      ? entry.type.slice(prefix.length)
      : null;
    if (!name || entries[kind].get(`${owner}\0${name}`) !== entry) return null;
    const valueParameter = entry.parameters.find(
      p => p.valueKind === 'boolean'
    );
    if (
      !operands.some(o => o.startsWith('object=')) ||
      !operands.some(o => o.startsWith('behavior='))
    )
      return null;
    const operator =
      kind === 'action' ? 'modification_sign' : 'comparison_sign';
    if (
      entry.parameters.some(p => p.dslName === operator) &&
      !operands.some(o => o.startsWith(`${operator}=`))
    )
      return null;
    const mapped = operands.map(operand =>
      valueParameter && operand.startsWith(`${valueParameter.dslName}=`)
        ? `value=${operand.slice(valueParameter.dslName.length + 1)}`
        : operand
    );
    // Keep empty legacy slots lossless; the alias requires an explicit value.
    if (
      (valueParameter || entry.parameters.some(p => p.dslName === 'value')) &&
      !mapped.some(operand => operand.startsWith('value='))
    )
      return null;
    const concise = mapped.filter(
      operand =>
        !['object=Object', 'behavior=Behavior', `${operator}="="`].includes(
          operand
        )
    );
    return `${
      kind === 'action' ? 'setProperty' : 'getProperty'
    } {\nname=${JSON.stringify(name)}${
      concise.length ? `\n${concise.join('\n')}` : ''
    }\n}`;
  };
  // Native expression AST binding is shared with validation and refactoring.
  const lowerExpression = source => {
    const tokens =
      source.match(
        /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[A-Za-z_][A-Za-z0-9_]*|[^\s]/g
      ) || [];
    for (let i = 0; i < tokens.length; i++) {
      if (
        tokens[i] === 'getProperty' &&
        tokens[i + 1] === '(' &&
        tokens[i + 2] === 'name' &&
        tokens[i + 3] === '=' &&
        tokens[i - 1] !== '.' &&
        tokens[i - 1] !== ':'
      )
        fail(
          'GDL_PROPERTY_EXPRESSION',
          'getProperty(name=...) is no longer supported; reference the property name directly.'
        );
    }
    return source;
  };
  const formatExpression = source => source;
  return {
    lowerInstruction,
    formatInstruction,
    lowerExpression,
    formatExpression,
  };
};
