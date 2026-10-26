// Run real generated Settings events in the built GDJS browser runtime.
// Requires newIDE/app and GDJS/tests dependencies and a built GDJS runtime.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const root = path.resolve(__dirname, "..");
const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), "gdevelop-unified-runtime-")
);
const fixture = path.join(directory, "generated.js");
const configFile = path.join(directory, "karma.conf.cjs");
const run = (command, args, options) => {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${command} failed with status ${result.status}`);
};
try {
  run(
    process.platform === "win32" ? "npm.cmd" : "npm",
    [
      "test",
      "--",
      "--watchAll=false",
      "--runInBand",
      "--silent",
      "src/ProjectsStorage/SettingsDsl/NativeEvents.spec.js"
    ],
    {
      cwd: path.join(root, "newIDE/app"),
      env: {
        ...process.env,
        CI: "true",
        GDEVELOP_UNIFIED_RUNTIME_FIXTURE: fixture
      }
    }
  );
  const originalConfig = path.join(root, "GDJS/tests/karma.conf.js");
  const test = path.join(
    root,
    "scripts/fixtures/unified-settings-runtime-test.js"
  );
  const plugins = ["karma-mocha", "karma-sinon", "karma-chrome-launcher"].map(
    name => path.join(root, "GDJS/tests/node_modules", name)
  );
  fs.writeFileSync(
    configFile,
    `module.exports = config => {
    let options;
    require(${JSON.stringify(
      originalConfig
    )})({set: value => { options = value; }});
    options.basePath = ${JSON.stringify(root)};
    options.files = options.files.filter(file => ![
      './Extensions/TweenBehavior/tests/CubicBezierEasingTestCases.js',
      './Extensions/**/tests/**.spec.js', './GDJS/tests/tests/**/*.js'
    ].includes(file)).concat([${JSON.stringify(fixture)}, ${JSON.stringify(
      test
    )}]);
    options.plugins = ${JSON.stringify(plugins)}.map(name => require(name));
    options.browsers = ['ChromeHeadlessNoSandbox'];
    options.singleRun = true;
    options.port = 9976;
    options.reporters = ['dots'];
    options.browserNoActivityTimeout = 60000;
    config.set(options);
  };\n`
  );
  const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  run(
    process.execPath,
    [
      path.join(root, "GDJS/tests/node_modules/karma/bin/karma"),
      "start",
      configFile,
      "--single-run"
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        ...(fs.existsSync(chrome) && !process.env.CHROME_BIN
          ? { CHROME_BIN: chrome }
          : {})
      }
    }
  );
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
