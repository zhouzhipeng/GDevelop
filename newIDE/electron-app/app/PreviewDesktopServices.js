const http = require('node:http');
const path = require('node:path');
const { createDesktopServiceIpc } = require('./DesktopServiceIpc');
const { setTimeout: delay } = require('node:timers/promises');

const isReady = service =>
  new Promise(resolve => {
    const request = http.request(
      {
        host: '127.0.0.1',
        port: service.port,
        path: service.path,
        method: service.method,
        agent: false,
        timeout: 500,
      },
      response => {
        response.resume();
        resolve(response.statusCode >= 200 && response.statusCode < 300);
      }
    );
    request.on('timeout', () => request.destroy());
    request.on('error', () => resolve(false));
    request.end();
  });

const createPreviewDesktopServices = (
  utilityProcess,
  { probe = isReady, startupTimeout = 10000, retryInterval = 150 } = {}
) => {
  const children = new Map();
  const starting = new Map();
  const users = new Map();
  let stopping = false;

  const start = async service => {
    const usesIpc = service.transport === 'ipc';
    const previous = children.get(service.entry);
    if (previous && previous.stopping) await previous.exited;
    if (!usesIpc && (await probe(service))) return;
    if (stopping) throw new Error('The editor is shutting down.');
    let running = children.get(service.entry);
    if (!running) {
      const child = utilityProcess.fork(service.entry, [], {
        cwd: service.cwd,
        serviceName: 'GDevelop Preview Desktop Service',
      });
      const exited = new Promise(resolve => {
        child.once('exit', () => {
          if (children.get(service.entry) === running)
            children.delete(service.entry);
          resolve();
        });
      });
      running = { child, exited, invoke: createDesktopServiceIpc(child) };
      children.set(service.entry, running);
      child.on('error', error =>
        console.error('Preview desktop service:', error)
      );
    }

    if (usesIpc) return;

    try {
      const deadline = Date.now() + startupTimeout;
      while (Date.now() < deadline && !stopping) {
        if (await probe(service)) return;
        if (children.get(service.entry) !== running) {
          throw new Error('The desktop service exited before it was ready.');
        }
        await delay(retryInterval);
      }
      throw new Error(
        'Desktop service did not become ready at 127.0.0.1:' +
          service.port +
          service.path +
          '.'
      );
    } catch (error) {
      if (children.get(service.entry) === running) stopChild(running);
      throw error;
    }
  };

  const stopChild = running => {
    if (running.stopping) return;
    running.stopping = true;
    running.child.kill();
  };

  return {
    retain(entry) {
      users.set(entry, (users.get(entry) || 0) + 1);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        const remaining = users.get(entry) - 1;
        if (remaining > 0) {
          users.set(entry, remaining);
          return;
        }
        users.delete(entry);
        const running = children.get(entry);
        if (running) stopChild(running);
      };
    },
    ensure(service) {
      if (stopping)
        return Promise.reject(new Error('The editor is shutting down.'));
      if (
        !service ||
        typeof service.entry !== 'string' ||
        typeof service.cwd !== 'string' ||
        !path.isAbsolute(service.entry) ||
        path.extname(service.entry) !== '.mjs' ||
        !path.isAbsolute(service.cwd) ||
        (service.transport !== 'ipc' &&
          (!Number.isInteger(service.port) ||
            service.port < 1 ||
            service.port > 65535 ||
            typeof service.path !== 'string' ||
            !/^\/[^\s#]*$/.test(service.path) ||
            !['GET', 'OPTIONS'].includes(service.method)))
      ) {
        return Promise.reject(
          new Error('Invalid preview desktop service entry.')
        );
      }
      const pending = starting.get(service.entry);
      if (pending) return pending;
      const operation = start(service).finally(() =>
        starting.delete(service.entry)
      );
      starting.set(service.entry, operation);
      return operation;
    },
    invoke(entry, method, params) {
      const running = children.get(entry);
      if (!running || running.stopping)
        throw new Error('Desktop service is unavailable.');
      return running.invoke(method, params);
    },
    stop() {
      stopping = true;
      for (const running of children.values()) stopChild(running);
      children.clear();
    },
  };
};

module.exports = { createPreviewDesktopServices };
