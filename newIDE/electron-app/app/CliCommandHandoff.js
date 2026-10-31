const path = require('path');
const {
  normalizeFileIdentifier,
  readOpenProjectFileIdentifiers,
  getWindowFileIdentifier,
} = require('./OpenProjectsRegistry');
const { argsParserOptions, parseGDevelopArgs } = require('./CliArguments');
// The flags of a command forwarded with it to an already opened editor.
const forwardedCommandOptionNames = [
  'json',
  'dry-run',
  'read-only',
  'results-path',
];

// Electron reorders commandLine (switches first, values last) before forwarding
// to 'second-instance', breaking flag-to-value pairing on reparse. Prefer
// additionalData.args (parsed by the second instance itself) instead.
const parseSecondInstanceArgs = ({ commandLine, additionalData, isDev }) =>
  additionalData && additionalData.args
    ? additionalData.args
    : // In dev, electron is launched with an extra argument, so skip one more.
      parseGDevelopArgs(commandLine.slice(isDev ? 2 : 1));

// Inline JSON and "-" (stdin) are kept as is, anything else is a path.
const resolveCommandArgsPaths = commandArgs => {
  if (!commandArgs) return commandArgs;
  const values = Array.isArray(commandArgs) ? commandArgs : [commandArgs];
  return values.map(value => {
    const trimmedValue = value.trim();
    if (!trimmedValue || trimmedValue === '-' || /^[[{]/.test(trimmedValue))
      return value;
    return path.resolve(trimmedValue);
  });
};

const isCliProjectAlreadyOpenElsewhere = parsedArgs => {
  const fileIdentifier = normalizeFileIdentifier(parsedArgs._[0]);
  return (
    !!fileIdentifier &&
    readOpenProjectFileIdentifiers().includes(fileIdentifier)
  );
};

// Redirects the command to an already open editor instead of spawning a new window.
const routeCliCommandToLiveEditor = ({ parsedArgs, mainWindows }) => {
  const commandName = parsedArgs['run-command'];
  if (!commandName) return false;

  const fileIdentifier = normalizeFileIdentifier(parsedArgs._[0]);
  const targetWindow = Array.from(mainWindows).find(
    window => getWindowFileIdentifier(window.id) === fileIdentifier
  );
  if (!targetWindow) return false;

  const commandOptions = {};
  forwardedCommandOptionNames.forEach(name => {
    if (parsedArgs[name] !== undefined) commandOptions[name] = parsedArgs[name];
  });
  // Paths are resolved by the editor, which can run in another directory.
  if (commandOptions['results-path'])
    commandOptions['results-path'] = path.resolve(
      commandOptions['results-path']
    );

  targetWindow.webContents.send('run-cli-command', {
    commandName,
    commandArgs: resolveCommandArgsPaths(parsedArgs['cmd-args']),
    fileIdentifier,
    commandOptions,
  });
  targetWindow.focus();
  return true;
};

module.exports = {
  argsParserOptions,
  parseGDevelopArgs,
  parseSecondInstanceArgs,
  isCliProjectAlreadyOpenElsewhere,
  routeCliCommandToLiveEditor,
};
