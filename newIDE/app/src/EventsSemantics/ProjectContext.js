// @noflow
import { sha256 } from 'js-sha256';
import { parseSettingsSyntax } from '../ProjectsStorage/SettingsDsl/Syntax';
import { getDeclaredVariableNames } from '../ProjectsStorage/SettingsDsl/Variables';
import { nodeValue } from './SourceMap';

// Catalog signatures depend on declarations, not on event bodies or source comments.
export const createCatalogSourceFingerprint = files => {
  const hash = sha256.create();
  Object.keys(files)
    .sort()
    .forEach(file => {
      if (!file.endsWith('.gdl') && file !== 'game://project.gdl') return;
      const root = parseSettingsSyntax(files[file], file).root;
      const declaration = node => ({
        type: node.type,
        properties: Object.fromEntries(
          Object.keys(node.properties)
            .sort()
            .map(key => [key, node.properties[key].value])
        ),
        children: node.children
          .filter(child => child.type !== 'events')
          .map(declaration),
      });
      hash.update(JSON.stringify([file, declaration(root)]));
    });
  return `sha256:${hash.hex()}`;
};

export const buildProjectContexts = files => {
  const roots = new Map();
  Object.entries(files).forEach(([file, source]) => {
    if (file.endsWith('.gdl') || file === 'game://project.gdl')
      roots.set(file, parseSettingsSyntax(source, file).root);
  });
  return file => {
    const root = roots.get(file);
    if (!root || !['function', 'fragment'].includes(root.type))
      throw new Error(
        'The selected managed source must be a function or fragment document.'
      );
    const segments = file.slice('game://'.length).split('/');
    const container = segments.slice(0, -2).join('/');
    const scene =
      segments[0] === 'scenes' ? decodeURIComponent(segments[1]) : null;
    const owner = {
      identity: `game://${container}`,
      kind:
        root.type === 'fragment'
          ? 'externalEvents'
          : scene
          ? 'scene'
          : 'extension',
      functionName:
        root.type === 'function' ? nodeValue(root, 'name', null) : null,
      sceneName: scene,
      variables: Object.create(null),
    };
    const symbols = Object.create(null);
    const addObjects = prefix => {
      roots.forEach((node, uri) => {
        if (
          node.type !== 'object' ||
          !uri.startsWith(prefix) ||
          uri.slice(prefix.length).includes('/')
        )
          return;
        const name = nodeValue(node, 'name', '');
        if (name) symbols[name] = { id: uri, origin: 'container' };
      });
    };
    addObjects('game://objects/');
    addObjects(`game://${container}/objects/`);
    const globalRoot = roots.get('game://project.gdl');
    const ownerRoot = roots.get(
      `game://${container}/${
        scene ? 'scene' : segments.includes('behaviors') ? 'behavior' : 'prefab'
      }.gdl`
    );
    [globalRoot, ownerRoot].forEach((node, index) => {
      if (!node) return;
      getDeclaredVariableNames(node).forEach(name => {
        owner.variables[name] = index ? (scene ? 'scene' : 'owner') : 'global';
      });
      const group = node.children.find(child => child.type === 'objectGroups');
      if (group)
        Object.entries(group.properties).forEach(([name, item]) => {
          const members = Array.isArray(item.value)
            ? item.value
                .map(name => symbols[name] && symbols[name].id)
                .filter(Boolean)
            : [];
          if (members.length === (item.value || []).length)
            symbols[name] = { id: `${owner.identity}:group:${name}`, members };
        });
    });
    (
      root.children.find(child => child.type === 'parameters')?.children || []
    ).forEach(parameter => {
      if (nodeValue(parameter, 'type', '') === 'object') {
        const name = parameter.type;
        symbols[name] = {
          id: `${file}:parameter:${name}`,
          origin: 'parameter',
        };
      }
    });
    return { owner, symbols };
  };
};
