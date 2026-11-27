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

function makeUtilityProcess({ deferExit = false } = {}) {
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
        if (!deferExit) child.emit('exit', 0);
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
  const release = launcher.retain(service.entry);
  await launcher.ensure(service);
  release();
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

test('routes concurrent IPC calls to the service without probing HTTP', async () => {
  const utility = makeUtilityProcess();
  const launcher = createPreviewDesktopServices(utility, {
    probe: async () => assert.fail('IPC must not probe HTTP'),
  });
  await launcher.ensure({
    cwd: service.cwd,
    entry: service.entry,
    transport: 'ipc',
  });
  const [child] = utility.children;
  const requests = [];
  child.postMessage = request => requests.push(request);
  const first = launcher.invoke(service.entry, 'get', { key: 'first' });
  const second = launcher.invoke(service.entry, 'get', { key: 'second' });
  assert.equal(requests.length, 0);
  child.emit('spawn');
  assert.deepEqual(requests[0], {
    type: 'gdevelop-desktop-service:request',
    id: 1,
    method: 'get',
    params: { key: 'first' },
  });
  child.emit('message', {
    type: 'gdevelop-desktop-service:response',
    id: requests[1].id,
    ok: false,
    error: 'Unknown key',
  });
  child.emit('message', {
    type: 'gdevelop-desktop-service:response',
    id: requests[0].id,
    ok: true,
    result: 'first result',
  });
  await assert.rejects(second, /Unknown key/);
  assert.equal(await first, 'first result');

  const interrupted = launcher.invoke(service.entry, 'get', {});
  launcher.stop();
  await assert.rejects(interrupted, /disconnected/);
  assert.throws(() => launcher.invoke(service.entry, 'get'), /unavailable/);
});

test('drops timed out requests before a service starts', async () => {
  const { createDesktopServiceIpc } = require('../app/DesktopServiceIpc');
  const child = new EventEmitter();
  child.postMessage = () => assert.fail('Timed out request was sent');
  const invoke = createDesktopServiceIpc(child, 5);
  await assert.rejects(invoke('get'), /timed out/);
  child.emit('spawn');
});

test('stops the service after its last preview closes and starts fresh on reopen', async () => {
  const utility = makeUtilityProcess({ deferExit: true });
  const launcher = createPreviewDesktopServices(utility);
  const ipcService = { ...service, transport: 'ipc' };
  const releaseFirst = launcher.retain(service.entry);
  const releaseSecond = launcher.retain(service.entry);
  await launcher.ensure(ipcService);
  const [child] = utility.children;

  releaseFirst();
  releaseFirst();
  assert.equal(child.killed, undefined);
  releaseSecond();
  assert.equal(child.killed, true);
  assert.throws(() => launcher.invoke(service.entry, 'get'), /unavailable/);

  const releaseReopened = launcher.retain(service.entry);
  const reopening = launcher.ensure(ipcService);
  assert.equal(utility.children.length, 1);
  child.emit('exit', 0);
  await reopening;
  assert.equal(utility.children.length, 2);
  releaseReopened();
  assert.equal(utility.children[1].killed, true);
  utility.children[1].emit('exit', 0);
});
