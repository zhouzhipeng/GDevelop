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

const decodedStringLines = new WeakMap();

// Map decoded string offsets back to raw GDL, including JSON escapes and CRLF.
export const getSettingsStringLocation = (item, decodedOffset = 0) => {
  const offset = Math.max(0, Math.min(decodedOffset, item.value.length));
  if (item.valueOffsets) {
    const originalOffset = item.valueOffsets[offset];
    return {
      line: item.location.line,
      column: item.location.column + originalOffset - item.location.offset,
      offset: originalOffset,
    };
  }
  let cached = decodedStringLines.get(item);
  if (!cached || cached.value !== item.value) {
    const starts = [0];
    for (let index = 0; index < item.value.length; index++)
      if (item.value[index] === '\n') starts.push(index + 1);
    cached = { value: item.value, starts };
    decodedStringLines.set(item, cached);
  }
  let low = 0;
  let high = cached.starts.length;
  while (low + 1 < high) {
    const middle = (low + high) >>> 1;
    if (cached.starts[middle] <= offset) low = middle;
    else high = middle;
  }
  const lineIndex = low;
  const column = offset - cached.starts[lineIndex] + 1;
  return {
    line: item.contentLocation.line + lineIndex,
    column,
    offset:
      (item.lineOffsets[lineIndex] ?? item.contentLocation.offset) + column - 1,
  };
};

// Tolerant lexical masking for completion in unfinished documents. Preserve
// offsets and newlines while hiding raw contents from the GDL scope scanners.
export const maskSettingsRawStrings = source => {
  const token = /\/\/[^\r\n]*|"{3,}|"(?:[^"\\]|\\.)*"/g;
  let match;
  const chunks = [];
  let cursor = 0;
  while ((match = token.exec(source))) {
    if (!/^"{3,}$/.test(match[0])) continue;
    const tail = source.slice(token.lastIndex).match(/^[ \t]*\r?\n/);
    if (!tail) continue;
    const bodyStart = token.lastIndex + tail[0].length;
    const closing = new RegExp(
      '^[ \\t]*' + match[0] + '[ \\t]*(?=\\r?$)',
      'gm'
    );
    closing.lastIndex = bodyStart;
    const end = closing.exec(source);
    const endOffset = end ? closing.lastIndex : source.length;
    chunks.push(
      source.slice(cursor, match.index),
      source.slice(match.index, endOffset).replace(/[^\r\n]/g, ' ')
    );
    cursor = token.lastIndex = endOffset;
    if (!end) return { source: chunks.join(''), inRawString: true };
  }
  return { source: chunks.join('') + source.slice(cursor), inRawString: false };
};

// A continuation wrapper belongs to GDL, not to the native expression source.
export const formatSettingsExpression = source =>
  /[\r\n]/.test(source) ? `(\n${source}\n)` : source;

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
  if (source.length > 16 * 1024 * 1024)
    error('Settings file size budget exceeded.');
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
  let readingAssignment = false;
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
        comments.push({
          text: source.slice(start, offset),
          line: commentLine,
          offset: start,
        });
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
    if (readingAssignment) {
      readingAssignment = false;
      if (
        character !== '[' &&
        character !== '{' &&
        !source.startsWith('"""', offset)
      ) {
        const start = offset;
        let cursor = offset;
        const stack = [];
        let outerEnd = -1;
        let quote = false;
        let escaped = false;
        while (cursor < source.length) {
          const c = source[cursor];
          if (quote) {
            if (escaped) escaped = false;
            else if (c === '\\') escaped = true;
            else if (c === '"') quote = false;
          } else if (c === '"') quote = true;
          else if (source.startsWith('//', cursor)) {
            if (!stack.length) break;
            error(
              'Comments inside multiline expressions are not supported.',
              location
            );
          } else if (/[\r\n]/.test(c) && !stack.length) break;
          else if (c === '(' || c === '[' || (c === '{' && stack.length))
            stack.push(c);
          else if (c === ')' || c === ']' || (c === '}' && stack.length)) {
            if (stack.pop() !== (c === ')' ? '(' : c === ']' ? '[' : '{'))
              error('Unmatched expression delimiter.', location);
            if (!stack.length && outerEnd === -1) outerEnd = cursor;
          } else if (c === '{' || c === '}') {
            error(
              'Expected a newline after the declaration; braces cannot delimit expressions.',
              location
            );
          } else if (c === '=' && !stack.length) {
            error('Expected a newline after the declaration.', location);
          }
          cursor++;
        }
        if (quote || stack.length) error('Unterminated expression.', location);
        let expression = source.slice(start, cursor).trim();
        let continuation = false;
        if (
          /^\(\r?\n/.test(expression) &&
          /\r?\n\)$/.test(expression) &&
          outerEnd === start + expression.length - 1
        ) {
          continuation = true;
          expression = expression
            .replace(/^\(\r?\n/, '')
            .replace(/\r?\n\)$/, '');
        }
        if (!expression.trim()) error('Expected a value.', location);
        if (/^expr\s*\(/.test(expression))
          error('The expr(...) wrapper is not supported.', location);
        let literal = false;
        try {
          const parsed = JSON.parse(expression);
          literal =
            ['string', 'number', 'boolean'].includes(typeof parsed) &&
            parsed !== null;
        } catch (_) {}
        if (continuation || !literal) {
          while (offset < cursor) advance();
          return { type: 'expression', value: { expression }, location };
        }
      }
    }
    if ('{}[]=,'.includes(character)) {
      advance();
      return { type: character, location };
    }
    if (source.startsWith('"""', offset)) {
      const delimiterStart = offset;
      while (source[offset] === '"') advance();
      const delimiterLength = offset - delimiterStart;
      while (source[offset] === ' ' || source[offset] === '\t') advance();
      if (!(source[offset] === '\n' || source.startsWith('\r\n', offset)))
        error(
          'A multiline raw string must start with a newline after its delimiter.',
          location
        );
      advance();
      const contentLocation = { line, column, offset };
      const bodyLines = [];
      const lineOffsets = [];
      while (offset < source.length) {
        const lineStart = offset;
        lineOffsets.push(lineStart);
        while (offset < source.length && !/[\r\n]/.test(source[offset])) {
          const c = source.charCodeAt(offset);
          if ((c < 32 && c !== 9) || c === 127)
            error('Invalid control character in multiline raw string.');
          advance();
        }
        const text = source.slice(lineStart, offset);
        const closing = text.match(/^[ \t]*("{3,})[ \t]*$/);
        if (closing && closing[1].length === delimiterLength) {
          lineOffsets.pop();
          const value = bodyLines.join('\n');
          const lastLine = bodyLines.length
            ? bodyLines[bodyLines.length - 1]
            : '';
          return {
            type: 'string',
            value,
            raw: true,
            delimiterLength,
            contentLocation: {
              ...contentLocation,
              endLine: contentLocation.line + Math.max(0, bodyLines.length - 1),
              endColumn: lastLine.length + 1,
              endOffset: bodyLines.length
                ? lineOffsets[lineOffsets.length - 1] + lastLine.length
                : contentLocation.offset,
            },
            lineOffsets,
            location,
          };
        }
        bodyLines.push(text);
        if (source[offset] === '\r' && source[offset + 1] !== '\n')
          error('Use LF or CRLF in multiline raw strings.');
        if (offset < source.length) advance();
      }
      error('Unterminated multiline raw string.', location);
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
          valueOffsets: (() => {
            const offsets = [];
            for (let cursor = start + 1; cursor < offset - 1; ) {
              offsets.push(cursor);
              cursor +=
                source[cursor] === '\\'
                  ? source[cursor + 1] === 'u'
                    ? 6
                    : 2
                  : 1;
            }
            offsets.push(offset - 1);
            return offsets;
          })(),
          contentLocation: {
            line,
            column: location.column + 1,
            offset: start + 1,
            endLine: line,
            endColumn: column - 1,
            endOffset: offset - 1,
          },
          location,
        };
      } catch (_) {
        error('Invalid JSON string escape or control character.', location);
      }
    }
    const rest = source.slice(offset);
    const match =
      rest.match(NUMBER) ||
      rest.match(/^[A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z_][A-Za-z0-9_]*)*/);
    if (!match)
      error(
        'Expected a node, property, or value. Only GDevelop Language (GDL) is supported.'
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
  const consume = (type, expressionAllowed = false) => {
    if (token.type !== type)
      error(`Expected ${type}, found ${token.type}.`, token.location);
    const result = token;
    if (type === '=') readingAssignment = expressionAllowed;
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
    if (['string', 'number', 'boolean', 'expression'].includes(token.type)) {
      const result = token;
      token = next();
      return {
        value: result.value,
        ...(result.type === 'expression' ? { expression: true } : {}),
        ...(result.valueOffsets
          ? {
              valueOffsets: result.valueOffsets,
              contentLocation: result.contentLocation,
            }
          : {}),
        ...(result.raw
          ? {
              raw: true,
              delimiterLength: result.delimiterLength,
              contentLocation: result.contentLocation,
              lineOffsets: result.lineOffsets,
            }
          : {}),
        location: result.location,
      };
    }
    if (token.type === '{')
      error(
        'Anonymous structure literals are not supported; use a named node.',
        token.location
      );
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
  const instruction = (head, depth) => {
    if (depth > MAX_SETTINGS_DEPTH)
      error('Settings nesting budget exceeded.', head.location);
    consume('{');
    const result = {
      type: head.value,
      instruction: true,
      arguments: Object.create(null),
      properties: Object.create(null),
      children: [],
      location: head.location,
    };
    const operands = [];
    if (token.type !== '}') {
      consume('newline');
      newlines();
    }
    let hasFlags = false;
    while (token.type !== '}') {
      if (!['ident', 'string'].includes(token.type))
        error(
          'Expected an instruction argument or child instruction.',
          token.location
        );
      const key = token;
      token = next();
      if (token.type === '=') {
        consume('=', true);
        if (own(result.arguments, key.value))
          error(`Duplicate argument ${key.value}.`, key.location);
        if (!['string', 'number', 'boolean', 'expression'].includes(token.type))
          error('Expected a semantic instruction operand.', token.location);
        const item = value(depth + 1);
        result.arguments[key.value] = { ...item, keyLocation: key.location };
        operands.push(
          `${key.value}=${source.slice(
            item.location.offset,
            item.location.endOffset
          )}`
        );
      } else if (key.value === 'flags') {
        if (hasFlags) error('Duplicate instruction flags.', key.location);
        hasFlags = true;
        consume('{');
        if (token.type !== '}') {
          consume('newline');
          newlines();
        }
        while (token.type !== '}') {
          const flag = consume('ident');
          consume('=');
          if (own(result.properties, flag.value))
            error(`Duplicate instruction flag ${flag.value}.`, flag.location);
          result.properties[flag.value] = {
            ...value(depth + 1),
            keyLocation: flag.location,
          };
          boundary();
        }
        consume('}');
      } else {
        result.children.push(instruction(key, depth + 1));
      }
      boundary();
    }
    const end = consume('}').location;
    result.location = {
      ...head.location,
      endLine: end.endLine,
      endColumn: end.endColumn,
      endOffset: end.endOffset,
    };
    // The resolver receives only catalog operands, excluding execution flags
    // and child instructions, which are decoded separately.
    const type =
      head.type === 'string' ? JSON.stringify(head.value) : head.value;
    result.source = operands.length
      ? `${type} {\n${operands.join('\n')}\n}`
      : `${type} {}`;
    return result;
  };
  const node = (nameToken, depth, named = false) => {
    if (depth > MAX_SETTINGS_DEPTH)
      error('Settings nesting budget exceeded.', nameToken.location);
    if (!named && nameToken.value === 'code')
      error(
        'Use code = """ followed by a multiline raw string; code {} is no longer supported.',
        nameToken.location
      );
    consume('{');
    const result = {
      type: nameToken.value,
      ...(named ? { named: true } : {}),
      properties: Object.create(null),
      children: [],
      location: nameToken.location,
      members: [],
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
        if (
          !result.named &&
          ['conditions', 'actions', 'while_conditions'].includes(result.type) &&
          token.type !== '='
        ) {
          const child = instruction(key, depth + 1);
          result.children.push(child);
          result.members.push({ child });
          boundary();
        } else if (token.type === '{') {
          const namedChild =
            [
              'parameters',
              'properties',
              'shared_properties',
              'variables',
              'global_variables',
              'scene_variables',
            ].includes(result.type) || result.named;
          if (key.type !== 'ident' && !namedChild)
            error(
              'Node types must be identifiers outside named collections.',
              key.location
            );
          if (own(result.properties, key.value))
            error(`Property/node collision: ${key.value}.`, key.location);
          childNames.add(key.value);
          const child = node(key, depth + 1, namedChild);
          result.children.push(child);
          result.members.push({ child });
        } else {
          consume(
            '=',
            !named &&
              ['repeat', 'for_each'].includes(result.type) &&
              ['count', 'order_by', 'limit', 'object'].includes(key.value)
          );
          if (own(result.properties, key.value) || childNames.has(key.value))
            error(
              `Duplicate property or property/node collision: ${key.value}.`,
              key.location
            );
          result.members.push({ key: key.value });
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
  // Event categories follow execution order. Preserve order within each list,
  // but reject declarations that would visually imply a different phase.
  const validateEventOrder = event => {
    if (
      ![
        'event',
        'else',
        'repeat',
        'while',
        'for_each',
        'for_each_child',
        'group',
        'comment',
        'link',
        'javascript',
      ].includes(event.type)
    )
      return;
    const phases = {
      variables: 1,
      while_conditions: 2,
      conditions: 3,
      actions: 4,
    };
    let phase = 0;
    for (const member of event.members) {
      const child = member.child;
      const nextPhase = child
        ? own(phases, child.type)
          ? phases[child.type]
          : 5
        : 0;
      if (nextPhase < phase) {
        const item = child || event.properties[member.key];
        throw new SettingsDslError(
          'SETTINGS_EVENT_ORDER',
          'Event members must appear in order: properties, variables, while_conditions, conditions, actions, child events.',
          fileUri,
          item.keyLocation || item.location,
          event.type
        );
      }
      phase = nextPhase;
      if (child && nextPhase === 5) validateEventOrder(child);
    }
  };
  if (['function', 'fragment'].includes(root.type))
    for (const container of root.children)
      if (container.type === 'events')
        for (const event of container.children) validateEventOrder(event);
  return { root, comments, source, fileUri };
};

export const printSettingsSyntax = (root, comments = [], options = {}) => {
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
    IDENT.test(key) &&
    key.match(IDENT)[0] === key &&
    !['true', 'false'].includes(key)
      ? key
      : JSON.stringify(key);
  const hasLiteralComment = item => {
    const next = comments[commentIndex];
    return !!(
      next &&
      item.location &&
      next.line >= item.location.line &&
      next.line < item.location.endLine
    );
  };
  const canPrintRawString = value => {
    for (let index = 0; index < value.length; index++) {
      const code = value.charCodeAt(index);
      if ((code < 32 && code !== 9 && code !== 10) || code === 127)
        return false;
    }
    return true;
  };
  const emitLiteral = (prefix, item, depth, suffix = '') => {
    const indent = '  '.repeat(depth);
    if (
      typeof item.value === 'string' &&
      (item.raw || item.value.includes('\n')) &&
      canPrintRawString(item.value)
    ) {
      // No indentation, escapes, interpolation, or whitespace trimming.
      if (suffix) {
        // Container punctuation belongs on a separate line after the delimiter.
        emitLiteral(prefix, item, depth);
        lines.push(`${indent}${suffix}`);
        return;
      }
      const runs = item.value.match(/"+/g) || [];
      const safeLength = runs.reduce(
        (max, run) => Math.max(max, run.length + 1),
        3
      );
      const delimiter = '"'.repeat(
        Math.max(safeLength, item.delimiterLength || 3)
      );
      lines.push(`${prefix}${delimiter}`);
      if (item.value) lines.push(item.value);
      lines.push(delimiter);
    } else if (item.expression === true) {
      const expression = formatSettingsExpression(item.value.expression);
      lines.push(`${prefix}${expression}${suffix}`);
    } else if (
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
        items.some(
          entry =>
            entry.raw ||
            (typeof entry.value === 'string' && entry.value.includes('\n')) ||
            (entry.value && typeof entry.value === 'object')
        ) || hasLiteralComment(item);
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
    if (node.instruction) {
      const type =
        !['true', 'false'].includes(node.type) &&
        !['true', 'false'].includes(node.type) &&
        /^[A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z_][A-Za-z0-9_]*)*$/.test(node.type)
          ? node.type
          : JSON.stringify(node.type);
      const args = Object.entries(node.arguments);
      const flags = Object.entries(node.properties);
      const nextComment = comments[commentIndex];
      const hasComments = !!(
        nextComment &&
        node.location &&
        nextComment.line < node.location.endLine
      );
      if (
        !args.length &&
        !flags.length &&
        !node.children.length &&
        !options.expandInstructions &&
        !hasComments
      ) {
        lines.push(`${indent}${type} {}`);
        return;
      }
      lines.push(`${indent}${type} {`);
      args.forEach(([key, item]) => {
        emitComments(
          item.keyLocation ? item.keyLocation.line : 0,
          `${indent}  `
        );
        emitLiteral(`${indent}  ${keyText(key)} = `, item, depth + 1);
      });
      if (flags.length) {
        lines.push(`${indent}  flags {`);
        flags.forEach(([key, item]) => {
          emitComments(
            item.keyLocation ? item.keyLocation.line : 0,
            `${indent}    `
          );
          emitLiteral(`${indent}    ${key} = `, item, depth + 2);
        });
        lines.push(`${indent}  }`);
      }
      node.children.forEach(child => emit(child, depth + 1));
      emitComments(
        node.location ? node.location.endLine - 0.5 : 0,
        `${indent}  `
      );
      lines.push(`${indent}}`);
      return;
    }
    lines.push(
      `${indent}${
        !['true', 'false'].includes(node.type) &&
        /^[A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z_][A-Za-z0-9_]*)*$/.test(node.type)
          ? node.type
          : JSON.stringify(node.type)
      } {`
    );
    const emitProperty = key => {
      const property = node.properties[key];
      emitComments(
        property.keyLocation ? property.keyLocation.line : 0,
        `${indent}  `
      );
      emitLiteral(`${indent}  ${keyText(key)} = `, property, depth + 1);
    };
    // Event ownership is explicit, so formatting preserves category placement.
    const preserveMembers = !!node.members;
    if (preserveMembers) {
      node.members.forEach(member => {
        if (member.key) emitProperty(member.key);
        else if (node.children.includes(member.child)) {
          lines.push('');
          emit(member.child, depth + 1);
        }
      });
      // Writer-added flags/children do not have an original source member.
      Object.keys(node.properties)
        .filter(key => !node.members.some(m => m.key === key))
        .forEach(emitProperty);
      node.children
        .filter(child => !node.members.some(m => m.child === child))
        .forEach(child => {
          lines.push('');
          emit(child, depth + 1);
        });
    } else {
      Object.keys(node.properties).forEach(emitProperty);
      node.children.forEach(child => {
        lines.push('');
        emit(child, depth + 1);
      });
    }
    emitComments(
      node.location ? node.location.endLine - 0.5 : 0,
      `${indent}  `
    );
    lines.push(`${indent}}`);
  };
  emit(root, 0);
  emitComments(Infinity, '');
  return `${lines.join('\n')}\n`;
};

// Preserve source-only comments when the engine rewrites model-backed data.
// Match named nodes/identities, otherwise their occurrence within a parent.
export const preserveSettingsSourceComments = (
  source,
  previousSource,
  fileUri
) => {
  const previous = parseSettingsSyntax(previousSource, fileUri);
  if (!previous.comments.length) return source;
  // Give each operand its own anchor and expand empty instructions so
  // restored comments remain inside their instruction blocks.
  const incoming = parseSettingsSyntax(source, fileUri);
  const current = parseSettingsSyntax(
    printSettingsSyntax(incoming.root, incoming.comments, {
      expandInstructions: true,
    }),
    fileUri
  );
  const index = syntax => {
    const nodes = new Map();
    const visit = (node, path) => {
      nodes.set(path, node);
      const counts = new Map();
      node.children.forEach(child => {
        const data = child.properties;
        const identity = ['aiGeneratedEventId', 'id', 'name', 'target']
          .map(key =>
            data[key] && data[key].value ? [key, data[key].value] : null
          )
          .find(Boolean);
        const base = JSON.stringify([child.type, identity || null]);
        const count = counts.get(base) || 0;
        counts.set(base, count + 1);
        visit(child, `${path}/${base}:${count}`);
      });
    };
    visit(syntax.root, 'root');
    return nodes;
  };
  const oldNodes = index(previous),
    newNodes = index(current);
  const pathsByNode = new Map(
    Array.from(oldNodes, ([path, node]) => [node, path])
  );
  const ordered = Array.from(oldNodes, ([path, node]) => ({ path, node })).sort(
    (a, b) =>
      a.node.location.line - b.node.location.line ||
      b.node.location.endLine - a.node.location.endLine
  );
  const stack = [],
    anchors = new Map();
  let cursor = 0;
  const comments = previous.comments
    .map(comment => {
      while (
        cursor < ordered.length &&
        ordered[cursor].node.location.line <= comment.line
      ) {
        const entry = ordered[cursor++];
        while (
          stack.length &&
          stack[stack.length - 1].node.location.endLine <=
            entry.node.location.line
        )
          stack.pop();
        stack.push(entry);
      }
      while (
        stack.length &&
        stack[stack.length - 1].node.location.endLine <= comment.line
      )
        stack.pop();
      const ownerEntry = stack[stack.length - 1] || {
        path: 'root',
        node: previous.root,
      };
      const ownerPath = ownerEntry.path,
        owner = ownerEntry.node;
      let targetPath = ownerPath;
      while (!newNodes.has(targetPath))
        targetPath = targetPath.slice(0, targetPath.lastIndexOf('/')) || 'root';
      const target = newNodes.get(targetPath);
      // A virtual position just before the closing brace also works for
      // empty two-line blocks, whose opening and last content line coincide.
      let beforeLine = target.location.endLine - 0.5;
      if (targetPath === ownerPath) {
        let following = anchors.get(ownerPath);
        if (!following) {
          following = [];
          Object.entries({ ...owner.arguments, ...owner.properties }).forEach(
            ([key, item]) => {
              const targetItem =
                (target.arguments && target.arguments[key]) ||
                target.properties[key];
              if (item.keyLocation && targetItem)
                following.push({
                  line: item.keyLocation.line,
                  target: targetItem.keyLocation.line,
                });
            }
          );
          owner.children.forEach(node => {
            const path = pathsByNode.get(node);
            if (newNodes.has(path))
              following.push({
                line: node.location.line,
                target: newNodes.get(path).location.line,
              });
          });
          following.sort((a, b) => a.line - b.line);
          anchors.set(ownerPath, following);
        }
        let low = 0,
          high = following.length;
        while (low < high) {
          const mid = (low + high) >>> 1;
          if (following[mid].line <= comment.line) low = mid + 1;
          else high = mid;
        }
        if (low < following.length) beforeLine = following[low].target;
      }
      return { text: comment.text, line: beforeLine };
    })
    .sort((a, b) => a.line - b.line);
  return printSettingsSyntax(current.root, comments);
};
