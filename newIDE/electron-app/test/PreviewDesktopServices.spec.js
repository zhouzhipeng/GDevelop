const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { test } = require('node:test');
const {
  createPreviewDesktopServices,
} = require('../app/PreviewDesktopServices');

const service = {
  cwd: '/project',
  entry: '/project/service.mjs',
  port: 18746,
  path: '/account',
  method: 'OPTIONS',
};

function makeUtilityProcess() {
  const children = [];
  return {
    children,
    fork(entry, args, options) {
      assert.equal(entry, service.entry);
      assert.deepEqual(args, []);
      assert.equal(options.cwd, service.cwd);
      const child = new EventEmitter();
      child.kill = () => {
        child.killed = true;
        child.emit('exit', 0);
      };
      children.push(child);
      return child;
    },
  };
}

test('reuses a ready service started outside the editor', async () => {
  const utility = makeUtilityProcess();
  const launcher = createPreviewDesktopServices(utility, {
    probe: async () => true,
  });
  await launcher.ensure(service);
  launcher.stop();
  assert.equal(utility.children.length, 0);
});

test('waits for readiness and shares concurrent startup attempts', async () => {
  const utility = makeUtilityProcess();
  let attempts = 0;
  const launcher = createPreviewDesktopServices(utility, {
    probe: async () => ++attempts === 3,
    retryInterval: 1,
  });
  const first = launcher.ensure(service);
  assert.equal(launcher.ensure(service), first);
  await first;
  assert.equal(attempts, 3);
  assert.equal(utility.children.length, 1);
  launcher.stop();
  assert.equal(utility.children[0].killed, true);
});

test('kills a service that never becomes ready and allows a retry', async () => {
  const utility = makeUtilityProcess();
  const launcher = createPreviewDesktopServices(utility, {
    probe: async () => false,
    startupTimeout: 10,
    retryInterval: 1,
  });
  await assert.rejects(launcher.ensure(service), /did not become ready/);
  assert.equal(utility.children[0].killed, true);
  await assert.rejects(launcher.ensure(service), /did not become ready/);
  assert.equal(utility.children.length, 2);
  launcher.stop();
});
