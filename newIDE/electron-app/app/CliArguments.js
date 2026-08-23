const parseArgs = require('minimist');

const argsParserOptions = {
  boolean: [
    'dev-tools',
    'disable-update-check',
    'keep-open',
    'block-on-diagnostic-errors',
    'headless',
  ],
  string: ['_', 'run-command', 'cmd-args', 'mcp-port'],
};

// Drop switches Chromium may inject into argv (e.g. --allow-file-access-from-files)
// so they can't steal the value of our own -- flags during parsing.
const knownCliFlagNames = new Set(
  [...argsParserOptions.boolean, ...argsParserOptions.string].filter(
    name => name !== '_'
  )
);
const booleanFlagNames = new Set(argsParserOptions.boolean);

const parseGDevelopArgs = argv =>
  parseArgs(
    argv.filter(arg => {
      if (!arg.startsWith('--')) return true;
      const argName = arg.slice(2).split('=')[0];
      if (knownCliFlagNames.has(argName)) return true;
      // Allow --no-<known-bool-flag> (minimist negation syntax).
      return (
        argName.startsWith('no-') && booleanFlagNames.has(argName.slice(3))
      );
    }),
    argsParserOptions
  );

module.exports = {
  argsParserOptions,
  parseGDevelopArgs,
};
