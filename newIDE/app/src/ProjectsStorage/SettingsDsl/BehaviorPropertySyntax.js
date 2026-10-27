// @noflow
import { parseCatalogInstructionArguments } from './InstructionOperands';

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
      const owner = entry.owner && entry.owner.behaviorType;
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
    const lowered = { object: 'Object', behavior: 'Behavior', ...args };
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
        !['object="Object"', 'behavior="Behavior"', `${operator}="="`].includes(
          operand
        )
    );
    return `${
      kind === 'action' ? 'setProperty' : 'getProperty'
    } { name=${JSON.stringify(name)}${
      concise.length ? ` ${concise.join(' ')}` : ''
    } }`;
  };
  const lowerExpression = (source, fileUri) => {
    let output = '';
    let index = 0;
    while (index < source.length) {
      const start = index;
      if (source[index] === '"' || source[index] === "'") {
        const quote = source[index++];
        while (index < source.length) {
          if (source[index] === '\\') index += 2;
          else if (source[index++] === quote) break;
        }
      } else if (
        source.startsWith('getProperty', index) &&
        (index === 0 || !/[A-Za-z0-9_.:]/.test(source[index - 1])) &&
        !/[.:]\s*$/.test(source.slice(0, index)) &&
        /^getProperty\s*\(/.test(source.slice(index))
      ) {
        index += /^getProperty\s*\(/.exec(source.slice(index))[0].length;
        const argumentStart = index;
        let depth = 1;
        let quote = null;
        while (index < source.length && depth) {
          const c = source[index++];
          if (quote) {
            if (c === '\\') index++;
            else if (c === quote) quote = null;
          } else if (c === '"' || c === "'") quote = c;
          else if (c === '(') depth++;
          else if (c === ')') depth--;
        }
        if (depth)
          fail('GDL_PROPERTY_EXPRESSION', 'Unclosed getProperty expression.');
        const args = parseCatalogInstructionArguments(
          source.slice(argumentStart, index - 1)
        );
        if (Object.keys(args).some(key => key !== 'name'))
          fail(
            'GDL_PROPERTY_EXPRESSION',
            'getProperty expression accepts only name.'
          );
        const setter = find('action', args.name, fileUri);
        if (
          !setter.parameters.some(
            p => p.valueKind === 'number' || p.valueKind === 'text'
          )
        )
          fail(
            'GDL_PROPERTY_EXPRESSION',
            'Boolean properties use getProperty conditions, not expressions.',
            'name'
          );
        output += `Object.Behavior::Property${args.name}()`;
        continue;
      } else index++;
      output += source.slice(start, index);
    }
    return output;
  };
  const formatExpression = (source, fileUri) => {
    const owner = behaviorTypeFromFileUri(fileUri);
    if (!owner) return source;
    // Match only unquoted native calls on this behavior. Leave text literals,
    // other objects/behaviors, and ordinary user functions untouched.
    return source.replace(
      /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[A-Za-z0-9_.:]*Object\.Behavior::Property([A-Za-z_][A-Za-z0-9_]*)\(\)/g,
      (match, name) =>
        name &&
        match === `Object.Behavior::Property${name}()` &&
        entries.action.has(`${owner}\0${name}`)
          ? `getProperty(name=${JSON.stringify(name)})`
          : match
    );
  };
  return {
    lowerInstruction,
    formatInstruction,
    lowerExpression,
    formatExpression,
  };
};
