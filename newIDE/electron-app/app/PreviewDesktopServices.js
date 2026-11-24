const http = require('node:http');
const path = require('node:path');
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
  let stopping = false;

  const start = async service => {
    if (await probe(service)) return;
    if (stopping) throw new Error('The editor is shutting down.');
    let child = children.get(service.entry);
    if (!child) {
      child = utilityProcess.fork(service.entry, [], {
        cwd: service.cwd,
        serviceName: 'GDevelop Preview Desktop Service',
      });
      children.set(service.entry, child);
      child.once('exit', () => {
        if (children.get(service.entry) === child)
          children.delete(service.entry);
      });
      child.on('error', error =>
        console.error('Preview desktop service:', error)
      );
    }

    try {
      const deadline = Date.now() + startupTimeout;
      while (Date.now() < deadline && !stopping) {
        if (await probe(service)) return;
        if (children.get(service.entry) !== child) {
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
      if (children.get(service.entry) === child) child.kill();
      throw error;
    }
  };

  return {
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
        !Number.isInteger(service.port) ||
        service.port < 1 ||
        service.port > 65535 ||
        typeof service.path !== 'string' ||
        !/^\/[^\s#]*$/.test(service.path) ||
        !['GET', 'OPTIONS'].includes(service.method)
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
    stop() {
      stopping = true;
      for (const child of children.values()) child.kill();
      children.clear();
    },
  };
};

module.exports = { createPreviewDesktopServices };
