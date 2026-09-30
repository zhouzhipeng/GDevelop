import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { patchUniformsGroups } from '../patch-uniforms-groups.mjs';

test('many groups reuse per-program slots without aliasing buffers', async () => {
  const source = patchUniformsGroups(readFileSync(new URL('../node_modules/three/src/renderers/webgl/WebGLUniformsGroups.js', import.meta.url), 'utf8'))
    .replace("import { error, warn } from '../../utils.js';", 'const { error, warn } = console;');
  const { WebGLUniformsGroups } = await import('data:text/javascript,' + encodeURIComponent(source));
  const bound = new Map(), deleted = new Set();
  let next = 0;
  const gl = {
    MAX_UNIFORM_BUFFER_BINDINGS: 1, UNIFORM_BUFFER: 2, INVALID_INDEX: 0xffffffff,
    getParameter: () => 2, createBuffer: () => ({ id: next++ }),
    bindBuffer() {}, bufferData() {}, bufferSubData() {},
    bindBufferBase(_, index, buffer) { assert.ok(index < 2); bound.set(index, buffer); },
    uniformBlockBinding(_, index, point) { assert.equal(index, point); },
    getUniformBlockIndex: (program, name) => program.indices[name] ?? 0xffffffff,
    deleteBuffer: buffer => deleted.add(buffer),
  };
  const info = { render: { frame: 0 } };
  const manager = WebGLUniformsGroups(gl, info, {}, {});
  const a = { program: { indices: { first: 0, second: 1 } } };
  const b = { program: { indices: { first: 1, second: 0 } } };
  const groups = Array.from({ length: 100 }, (_, id) => ({
    id, name: id % 2 ? 'second' : 'first', uniforms: [{ value: id }],
    addEventListener(_, listener) { this.dispose = () => listener({ target: this }); },
    removeEventListener() {},
  }));
  for (const program of [a, b, a]) {
    for (let i = 0; i < groups.length; i += 2) {
      for (const group of groups.slice(i, i + 2)) {
        manager.update(group, program); manager.bind(group, program);
        assert.equal(bound.get(program.program.indices[group.name]).id, group.id);
      }
      assert.notEqual(bound.get(0), bound.get(1));
    }
    info.render.frame++;
  }
  groups[0].dispose();
  assert.equal(deleted.size, 1);
  manager.dispose();
  assert.equal(deleted.size, 100);
});
