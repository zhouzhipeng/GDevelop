const assert = require('assert');

const {
  getElectronAppCommandLineArguments,
} = require('../app/Utils/AppArguments');
const { parseGDevelopArgs } = require('../app/CliArguments');

const run = () => {
  assert.deepStrictEqual(
    getElectronAppCommandLineArguments(['electron.exe', 'app'], {
      isDev: false,
      isDefaultApp: true,
    }),
    []
  );

  assert.deepStrictEqual(
    getElectronAppCommandLineArguments(
      ['electron.exe', '--force_high_performance_gpu', 'app'],
      {
        isDev: false,
        isDefaultApp: true,
      }
    ),
    []
  );

  assert.deepStrictEqual(
    getElectronAppCommandLineArguments(
      [
        'electron.exe',
        '--force_high_performance_gpu',
        'app',
        'C:\\Projects\\game.json',
      ],
      {
        isDev: false,
        isDefaultApp: true,
      }
    ),
    ['C:\\Projects\\game.json']
  );

  const headlessArgs = parseGDevelopArgs([
    '--headless',
    '--mcp-port=0',
    'C:\\Projects\\game.json',
  ]);
  assert.strictEqual(headlessArgs.headless, true);
  assert.strictEqual(headlessArgs['mcp-port'], '0');
  assert.deepStrictEqual(headlessArgs._, ['C:\\Projects\\game.json']);

  assert.deepStrictEqual(
    getElectronAppCommandLineArguments(
      ['electron.exe', 'app', 'C:\\Projects\\game.json'],
      {
        isDev: false,
        isDefaultApp: true,
      }
    ),
    ['C:\\Projects\\game.json']
  );

  assert.deepStrictEqual(
    getElectronAppCommandLineArguments(
      ['GDevelop.exe', 'C:\\Projects\\game.json'],
      {
        isDev: false,
        isDefaultApp: false,
      }
    ),
    ['C:\\Projects\\game.json']
  );

  assert.deepStrictEqual(
    getElectronAppCommandLineArguments(['GDevelop.exe'], {
      isDev: false,
      isDefaultApp: false,
    }),
    []
  );

  assert.deepStrictEqual(
    getElectronAppCommandLineArguments(
      ['electron.exe', 'app', 'C:\\Projects\\game.json'],
      {
        isDev: true,
        isDefaultApp: false,
      }
    ),
    ['C:\\Projects\\game.json']
  );
};

run();
