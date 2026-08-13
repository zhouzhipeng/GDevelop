const assert = require('assert');
const configureKarma = require('./karma.conf');

let karmaOptions = null;

configureKarma({
  enableBenchmarks: false,
  set(options) {
    karmaOptions = options;
  },
});

assert(karmaOptions, 'Expected Karma configuration to be provided.');
assert.strictEqual(karmaOptions.hostname, '127.0.0.1');
assert.strictEqual(karmaOptions.listenAddress, '127.0.0.1');

