// @noflow

export class SettingsDslError extends Error {
  constructor(code, message, fileUri, location, path) {
    super(message);
    this.name = 'SettingsDslError';
    this.code = code;
    this.fileUri = fileUri || '<memory>';
    const position = location || {};
    this.line = position.line || 1;
    this.column = position.column || 1;
    this.offset = position.offset || 0;
    this.endLine = position.endLine || this.line;
    this.endColumn = position.endColumn || this.column + 1;
    this.endOffset =
      position.endOffset === undefined ? this.offset + 1 : position.endOffset;
    this.path = path || '';
  }
}

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*/;
const NUMBER = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/;
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
export const MAX_SETTINGS_DEPTH = 100;
const MAX_TOKENS = 2000000;

// Keep newlines as tokens: indentation never controls nesting, but two
// assignments on the same line are deliberately not part of the language.
export const parseSettingsSyntax = (source, fileUri) => {
  let offset = 0;
  let line = 1;
  let column = 1;
  let count = 0;
  const comments = [];
  const error = (message, location) => {
    throw new SettingsDslError(
      'SETTINGS_SYNTAX',
      message,
      fileUri,
      location || { line, column, offset }
    );
  };
  if (typeof source !== 'string') error('Settings source must be UTF-8 text.');
  if (source.charCodeAt(0) === 0xfeff) error('UTF-8 BOM is forbidden.');
  const advance = () => {
    const character = source[offset++];
    if (character === '\r') {
      if (source[offset] === '\n') offset++;
      line++;
      column = 1;
    } else if (character === '\n') {
      line++;
      column = 1;
    } else column++;
    return character;
  };
  const readToken = () => {
    while (offset < source.length) {
      if (source[offset] === ' ' || source[offset] === '\t') {
        advance();
        continue;
      }
      if (source.slice(offset, offset + 2) === '//') {
        const start = offset;
        const commentLine = line;
        while (offset < source.length && !/[\r\n]/.test(source[offset]))
          advance();
        comments.push({ text: source.slice(start, offset), line: commentLine });
        continue;
      }
      break;
    }
    if (++count > MAX_TOKENS) error('Settings token budget exceeded.');
    const location = { line, column, offset };
    if (offset >= source.length) return { type: 'eof', location };
    const character = source[offset];
    if (/[\r\n]/.test(character)) {
      advance();
      return { type: 'newline', location };
    }
    if ('{}[]=,'.includes(character)) {
      advance();
      return { type: character, location };
    }
    if (character === '"') {
      const start = offset;
      advance();
      let closed = false;
      while (offset < source.length) {
        const c = source[offset];
        if (/[\r\n]/.test(c))
          error('Use JSON escapes for newlines inside strings.', location);
        advance();
        if (c === '"') {
          closed = true;
          break;
        }
        if (c === '\\') {
          if (offset >= source.length || /[\r\n]/.test(source[offset]))
            error('Invalid string escape.', location);
          advance();
        }
      }
      if (!closed) error('Unterminated string.', location);
      try {
        return {
          type: 'string',
          value: JSON.parse(source.slice(start, offset)),
          location,
        };
      } catch (_) {
        error('Invalid JSON string escape or control character.', location);
      }
    }
    const rest = source.slice(offset);
    const match = rest.match(NUMBER) || rest.match(IDENT);
    if (!match)
      error(
        'Expected a node, property, or value. Only Settings DSL is supported.'
      );
    for (let i = 0; i < match[0].length; i++) advance();
    const text = match[0];
    if (NUMBER.test(text)) {
      const value = Number(text);
      if (
        !Number.isFinite(value) ||
        (Number.isInteger(value) && !Number.isSafeInteger(value))
      )
        error(
          'Numbers must be finite and integers must be in the safe range.',
          location
        );
      return { type: 'number', value, location };
    }
    if (text === 'true' || text === 'false')
      return { type: 'boolean', value: text === 'true', location };
    return { type: 'ident', value: text, location };
  };
  const next = () => {
    const result = readToken();
    Object.assign(result.location, {
      endLine: line,
      endColumn: column,
      endOffset: offset,
    });
    return result;
  };
  let token = next();
  const consume = type => {
    if (token.type !== type)
      error(`Expected ${type}, found ${token.type}.`, token.location);
    const result = token;
    token = next();
    return result;
  };
  const newlines = () => {
    while (token.type === 'newline') consume('newline');
  };
  const boundary = () => {
    if (!['newline', 'eof'].includes(token.type))
      error('Expected a newline after the declaration.', token.location);
    newlines();
  };
  const value = depth => {
    if (depth > MAX_SETTINGS_DEPTH)
      error('Settings nesting budget exceeded.', token.location);
    if (['string', 'number', 'boolean'].includes(token.type)) {
      const result = token;
      token = next();
      return { value: result.value, location: result.location };
    }
    if (token.type === '{') {
      const start = consume('{').location;
      const entries = [];
      const result = Object.create(null);
      newlines();
      while (token.type !== '}') {
        if (!['ident', 'string'].includes(token.type))
          error('Expected a structure key.', token.location);
        const key = token;
        token = next();
        consume('=');
        if (own(result, key.value))
          error(`Duplicate structure key ${key.value}.`, key.location);
        const item = value(depth + 1);
        result[key.value] = item.value;
        entries.push({ key: key.value, keyLocation: key.location, ...item });
        if (token.type === '}') break;
        if (token.type === ',') {
          consume(',');
          newlines();
        } else if (token.type === 'newline') {
          newlines();
          if (token.type === ',') {
            consume(',');
            newlines();
          }
        } else
          error(
            'Expected a comma or newline between structure fields.',
            token.location
          );
      }
      const end = consume('}').location;
      return {
        value: result,
        entries,
        location: {
          ...start,
          endLine: end.endLine,
          endColumn: end.endColumn,
          endOffset: end.endOffset,
        },
      };
    }
    const start = consume('[').location;
    const items = [];
    newlines();
    while (token.type !== ']') {
      items.push(value(depth + 1));
      newlines();
      if (token.type !== ',') break;
      consume(',');
      newlines();
    }
    const end = consume(']').location;
    return {
      value: items.map(item => item.value),
      items,
      location: {
        ...start,
        endLine: end.endLine,
        endColumn: end.endColumn,
        endOffset: end.endOffset,
      },
    };
  };
  const node = (nameToken, depth) => {
    if (depth > MAX_SETTINGS_DEPTH)
      error('Settings nesting budget exceeded.', nameToken.location);
    consume('{');
    const result = {
      type: nameToken.value,
      properties: Object.create(null),
      children: [],
      location: nameToken.location,
    };
    const childNames = new Set();
    if (token.type !== '}') {
      consume('newline');
      newlines();
      while (token.type !== '}') {
        if (!['ident', 'string'].includes(token.type))
          error('Expected a property or child node.', token.location);
        const key = token;
        token = next();
        if (token.type === '{') {
          if (key.type !== 'ident')
            error('Node types must be identifiers.', key.location);
          if (own(result.properties, key.value))
            error(`Property/node collision: ${key.value}.`, key.location);
          childNames.add(key.value);
          result.children.push(node(key, depth + 1));
        } else {
          consume('=');
          if (own(result.properties, key.value) || childNames.has(key.value))
            error(
              `Duplicate property or property/node collision: ${key.value}.`,
              key.location
            );
          result.properties[key.value] = {
            ...value(depth + 1),
            keyLocation: key.location,
          };
          boundary();
        }
      }
    }
    const end = consume('}').location;
    result.location = {
      ...result.location,
      endLine: end.line,
      endColumn: end.column + 1,
      endOffset: end.offset + 1,
    };
    boundary();
    return result;
  };
  newlines();
  const root = node(consume('ident'), 0);
  consume('eof');
  return { root, comments, source, fileUri };
};

export const printSettingsSyntax = (root, comments = []) => {
  const lines = [];
  let commentIndex = 0;
  const emitComments = (beforeLine, indent) => {
    while (
      commentIndex < comments.length &&
      comments[commentIndex].line <= beforeLine
    )
      lines.push(`${indent}${comments[commentIndex++].text}`);
  };
  const keyText = key =>
    IDENT.test(key) && key.match(IDENT)[0] === key ? key : JSON.stringify(key);
  const hasLiteralComment = item => {
    const next = comments[commentIndex];
    return !!(
      next &&
      item.location &&
      next.line >= item.location.line &&
      next.line < item.location.endLine
    );
  };
  const emitLiteral = (prefix, item, depth, suffix = '') => {
    const indent = '  '.repeat(depth);
    if (
      item.value &&
      typeof item.value === 'object' &&
      !Array.isArray(item.value)
    ) {
      const entries =
        item.entries ||
        Object.entries(item.value).map(([key, value]) => ({ key, value }));
      if (!entries.length && !hasLiteralComment(item)) {
        lines.push(`${prefix}{}${suffix}`);
        return;
      }
      lines.push(`${prefix}{`);
      entries.forEach(entry => {
        emitComments(
          entry.keyLocation ? entry.keyLocation.line : 0,
          `${indent}  `
        );
        emitLiteral(`${indent}  ${keyText(entry.key)} = `, entry, depth + 1);
      });
      emitComments(
        item.location ? item.location.endLine - 1 : 0,
        `${indent}  `
      );
      lines.push(`${indent}}${suffix}`);
    } else if (Array.isArray(item.value)) {
      const items = item.items || item.value.map(value => ({ value }));
      const multiline =
        items.some(entry => entry.value && typeof entry.value === 'object') ||
        hasLiteralComment(item);
      if (!multiline) {
        lines.push(
          `${prefix}[${items
            .map(entry => JSON.stringify(entry.value))
            .join(', ')}]${suffix}`
        );
        return;
      }
      lines.push(`${prefix}[`);
      items.forEach(entry => {
        emitComments(entry.location ? entry.location.line : 0, `${indent}  `);
        emitLiteral(`${indent}  `, entry, depth + 1, ',');
      });
      emitComments(
        item.location ? item.location.endLine - 1 : 0,
        `${indent}  `
      );
      lines.push(`${indent}]${suffix}`);
    } else lines.push(`${prefix}${JSON.stringify(item.value)}${suffix}`);
  };
  const emit = (node, depth) => {
    const indent = '  '.repeat(depth);
    emitComments(node.location ? node.location.line : 0, indent);
    lines.push(`${indent}${node.type} {`);
    Object.keys(node.properties).forEach(key => {
      const property = node.properties[key];
      emitComments(
        property.keyLocation ? property.keyLocation.line : 0,
        `${indent}  `
      );
      emitLiteral(`${indent}  ${keyText(key)} = `, property, depth + 1);
    });
    node.children.forEach(child => {
      lines.push('');
      emit(child, depth + 1);
    });
    emitComments(node.location ? node.location.endLine - 1 : 0, `${indent}  `);
    lines.push(`${indent}}`);
  };
  emit(root, 0);
  emitComments(Infinity, '');
  return `${lines.join('\n')}\n`;
};
