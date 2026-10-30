// @noflow
import { EVENT_NODE_TYPES } from '../ProjectsStorage/SettingsDsl/Events';
const eventTypes = new Set(EVENT_NODE_TYPES);
export const eventChildren = node =>
  node.children.filter(child => eventTypes.has(child.type));
export const nodeValue = (node, name, fallback) =>
  Object.prototype.hasOwnProperty.call(node.properties, name)
    ? node.properties[name].value
    : fallback;
export const sourceLocation = (node, file) => ({ file, ...node.location });

// Path indexes always count the original mixed author list, including comments.
export const buildEventSourceMap = (root, file) => {
  const entries = [];
  const add = (node, eventPath, extra = {}) => {
    entries.push({ eventPath, ...extra, source: sourceLocation(node, file) });
    Object.entries(node.properties || {}).forEach(([name, value]) => {
      entries.push({
        eventPath,
        ...extra,
        property: name,
        source: sourceLocation(value, file),
      });
    });
  };
  const instructions = (list, eventPath, listKind, prefix = []) => {
    list.children.forEach((node, index) => {
      const instructionPath = [...prefix, index];
      add(node, eventPath, { list: listKind, instructionPath });
      Object.entries(node.arguments).forEach(([name, argument]) => {
        entries.push({
          eventPath,
          list: listKind,
          instructionPath,
          parameter: name,
          source: sourceLocation(argument, file),
          keySource: { file, ...argument.keyLocation },
        });
      });
      instructions(node, eventPath, listKind, instructionPath);
    });
  };
  const dataNode = (node, eventPath, nodePath = []) => {
    add(node, eventPath, { kind: node.type, nodePath });
    if (node.type === 'code')
      entries.push({
        eventPath,
        kind: 'code-content',
        source: {
          file,
          ...node.contentLocation,
          endOffset: node.contentLocation.offset + node.code.length,
          endLine: node.location.endLine,
          endColumn: 1,
        },
      });
    node.children.forEach((child, index) =>
      dataNode(child, eventPath, [...nodePath, index])
    );
  };
  const visit = (node, eventPath) => {
    add(node, eventPath, { kind: node.type });
    node.children
      .filter(child => !eventTypes.has(child.type))
      .forEach((child, index) => {
        if (
          ['conditions', 'actions', 'while_conditions'].includes(child.type)
        ) {
          add(child, eventPath, { kind: child.type });
          instructions(child, eventPath, child.type);
        } else dataNode(child, eventPath, [index]);
      });
    eventChildren(node).forEach((child, index) =>
      visit(child, [...eventPath, index])
    );
  };
  const container = root.children.find(child => child.type === 'events');
  if (container)
    eventChildren(container).forEach((node, index) => visit(node, [index]));
  return entries;
};
