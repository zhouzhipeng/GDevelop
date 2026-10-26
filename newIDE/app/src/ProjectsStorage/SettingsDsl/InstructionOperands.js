// @noflow
import { parseSettingsSyntax } from './Syntax';
export const parseCatalogInstructionArguments = source => {
  const syntax = parseSettingsSyntax(
    `function {\n events {\n event {\n actions {\n Operand ${source}\n}\n}\n}\n}\n`
  );
  const instruction =
    syntax.root.children[0].children[0].children[0].children[0];
  return Object.fromEntries(
    Object.entries(instruction.arguments).map(([key, item]) => [
      key,
      item.expression === true
        ? { __settingsExpression: true, source: item.value.expression }
        : item.value,
    ])
  );
};
