/**
 * @packageDocumentation
 * @module ThreeTSL
 *
 * TSL-enabled superset of the classic-script Three.js runtime used by GDJS.
 * Everything in this file is bundled from one pinned Three.js dependency
 * graph, so regular Three classes, node materials and TSL nodes share the same
 * core identity.
 */

export * from "three";

import {
  abs,
  bool,
  clamp,
  color,
  cos,
  cross,
  dot,
  float,
  fract,
  max,
  min,
  mix,
  normalLocal,
  normalView,
  normalWorld,
  normalize,
  oneMinus,
  positionLocal,
  positionView,
  positionWorld,
  pow,
  select,
  sin,
  smoothstep,
  step,
  texture,
  time,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import {
  MeshBasicNodeMaterial,
  MeshPhysicalNodeMaterial,
  MeshStandardNodeMaterial,
  NodeMaterial,
} from "three/webgpu";
import { WebGLNodesHandler } from "three/addons/tsl/WebGLNodesHandler.js";

/**
 * Reviewed runtime surface used by generated TSL material registry modules.
 * Do not expose the complete upstream TSL namespace: the editor declarations,
 * compiler allowlist and this object must evolve together.
 */
export const GDevelopTSL = Object.freeze({
  abs,
  bool,
  clamp,
  color,
  cos,
  cross,
  dot,
  float,
  fract,
  max,
  min,
  mix,
  normalLocal,
  normalView,
  normalWorld,
  normalize,
  oneMinus,
  positionLocal,
  positionView,
  positionWorld,
  pow,
  select,
  sin,
  smoothstep,
  step,
  texture,
  time,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
});

export {
  MeshBasicNodeMaterial,
  MeshPhysicalNodeMaterial,
  MeshStandardNodeMaterial,
  NodeMaterial,
  WebGLNodesHandler,
};

/** Exact identities checked by the runtime before installing the handler. */
export const GDEVELOP_TSL_RUNTIME = Object.freeze({
  threeRevision: "185",
  authoringApiVersion: "1",
  portableProfileVersion: "1",
  backend: "webgl2-node-compat",
});
