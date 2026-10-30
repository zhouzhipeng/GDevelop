// @noflow
import {
  SettingsDslError,
  MAX_SETTINGS_DEPTH,
  getSettingsStringLocation,
} from './Syntax';

export const variableJsonLocation = (item, offset, endOffset = offset + 1) => {
  const start = getSettingsStringLocation(item, offset);
  const end = getSettingsStringLocation(item, endOffset);
  return {
    ...start,
    endLine: end.line,
    endColumn: end.column,
    endOffset: end.offset,
  };
};

// Keep object members in an array: JSON.parse loses numeric-key source order
// and duplicate keys. This tree is data only, never a prototype-bearing map.
export const parseVariableJson = (item, fileUri, path = '', depth = 0) => {
  const source = item.value;
  let offset = 0;
  let nodes = 0;
  const fail = (message, at = offset) => {
    throw new SettingsDslError(
      'SETTINGS_INVALID_VARIABLE_JSON',
      message,
      fileUri,
      variableJsonLocation(item, at),
      path
    );
  };
  if (typeof source !== 'string' || item.expression)
    throw new SettingsDslError(
      'SETTINGS_INVALID_VARIABLE_JSON',
      'Variable JSON must be a string.',
      fileUri,
      item.location,
      path
    );
  const whitespace = () => {
    while (/[ \t\r\n]/.test(source[offset] || '\0')) offset++;
  };
  const string = () => {
    const start = offset++;
    while (offset < source.length) {
      const c = source[offset++];
      if (c === '"') {
        try {
          return JSON.parse(source.slice(start, offset));
        } catch (_) {
          fail('Invalid JSON string.', start);
        }
      }
      if (c === '\\') offset++;
      else if (c.charCodeAt(0) < 32)
        fail('Invalid JSON control character.', offset - 1);
    }
    fail('Unterminated JSON string.', start);
  };
  const read = level => {
    whitespace();
    const start = offset;
    if (level > MAX_SETTINGS_DEPTH)
      fail('Variable JSON nesting budget exceeded.');
    if (++nodes > 200000) fail('Variable JSON node budget exceeded.');
    const c = source[offset];
    let result;
    if (c === '{' || c === '[') {
      offset++;
      const structure = c === '{';
      const end = structure ? '}' : ']';
      const children = [];
      const keys = new Map();
      whitespace();
      if (source[offset] !== end) {
        for (;;) {
          whitespace();
          let name, keyOffset;
          if (structure) {
            keyOffset = offset;
            if (source[offset] !== '"')
              fail('Expected a quoted JSON object key.');
            name = string();
            if (!name)
              fail('Variable member names must not be empty.', keyOffset);
            if (keys.has(name))
              fail(
                `Duplicate JSON key ${JSON.stringify(
                  name
                )} (first at decoded offset ${keys.get(name)}).`,
                keyOffset
              );
            keys.set(name, keyOffset);
            whitespace();
            if (source[offset++] !== ':')
              fail('Expected : after JSON key.', offset - 1);
          }
          const child = read(level + 1);
          children.push({
            ...child,
            ...(structure ? { name, keyOffset } : {}),
          });
          whitespace();
          if (source[offset] !== ',') break;
          offset++;
        }
      }
      if (source[offset++] !== end)
        fail(`Expected ${end} in JSON.`, offset - 1);
      result = { type: structure ? 'structure' : 'array', children };
    } else if (c === '"') result = { type: 'string', value: string() };
    else if (
      source.startsWith('true', offset) ||
      source.startsWith('false', offset)
    ) {
      const value = source.startsWith('true', offset);
      offset += value ? 4 : 5;
      result = { type: 'boolean', value };
    } else {
      const number = source
        .slice(offset)
        .match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/);
      if (!number) fail('Expected a JSON value; null is not a variable value.');
      offset += number[0].length;
      const value = Number(number[0]);
      if (
        !Number.isFinite(value) ||
        (Number.isInteger(value) && !Number.isSafeInteger(value))
      )
        fail('JSON numbers must be finite and integers must be safe.', start);
      result = { type: 'number', value };
    }
    return { ...result, offset: start, endOffset: offset };
  };
  const result = read(depth);
  whitespace();
  if (offset !== source.length) fail('Unexpected content after JSON value.');
  return result;
};

export const printVariableJson = (node, depth = 0) => {
  if (!['structure', 'array'].includes(node.type))
    return JSON.stringify(node.value);
  const structure = node.type === 'structure';
  const [open, close] = structure ? ['{', '}'] : ['[', ']'];
  if (!node.children.length) return open + close;
  const indent = '  '.repeat(depth);
  return (
    open +
    '\n' +
    node.children
      .map(
        child =>
          indent +
          '  ' +
          (structure ? JSON.stringify(child.name) + ': ' : '') +
          printVariableJson(child, depth + 1)
      )
      .join(',\n') +
    '\n' +
    indent +
    close
  );
};

export const jsonPointerSegment = name =>
  String(name)
    .replace(/~/g, '~0')
    .replace(/\//g, '~1');
