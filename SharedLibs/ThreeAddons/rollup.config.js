//import pkg from "./package.json";
import resolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const expectedWebGLNodesHandlerSha256 =
  "0e7e1a4161793982748359e910434b304d3bfa518e8feafa6c6fe7f5b50c95a1";
const expectedThreeVersion = "0.185.1";
const expectedTSLRuntimeSha256 =
  "3b692dc6218fccf65db994205231f6108e47c0407abb8b3c5d9a5f5c9344eb2e";
const tslRuntimeBanner =
  "/*! three.js v0.185.1 | Copyright 2010-2026 three.js authors | MIT License */";
const requiredTSLRuntimeExports = [
  "GDEVELOP_TSL_RUNTIME",
  "GDevelopTSL",
  "Material",
  "MeshBasicNodeMaterial",
  "MeshPhysicalNodeMaterial",
  "MeshStandardNodeMaterial",
  "NodeMaterial",
  "REVISION",
  "WebGLNodesHandler",
  "WebGLRenderer",
];

// The package exports for three, three/tsl and three/webgpu point to
// independently pre-bundled entry files. Bundling those entry files together
// would retain multiple copies of Three's core constructors. Route every
// upstream import (including imports made by WebGLNodesHandler) to the source
// entry graph so classic and node materials share one identity.
const threeSourceEntryPaths = {
  three: fileURLToPath(
    new URL("./node_modules/three/src/Three.js", import.meta.url)
  ),
  "three/tsl": fileURLToPath(
    new URL("./node_modules/three/src/nodes/TSL.js", import.meta.url)
  ),
  "three/webgpu": fileURLToPath(
    new URL("./node_modules/three/src/Three.WebGPU.js", import.meta.url)
  ),
};

const forceSingleThreeSourceGraph = () => ({
  name: "gdevelop-force-single-three-source-graph",
  resolveId(source) {
    return threeSourceEntryPaths[source] || null;
  },
  buildEnd(error) {
    if (error) return;
    const threeModuleIds = Array.from(this.getModuleIds()).filter((id) =>
      /[\\/]node_modules[\\/]three[\\/]/.test(id)
    );
    const preBundledEntries = threeModuleIds.filter((id) =>
      /[\\/]three[\\/]build[\\/]three(?:\.module|\.webgpu|\.tsl)?\.js$/.test(id)
    );
    if (preBundledEntries.length) {
      this.error(
        "The TSL runtime included pre-bundled Three entries and may contain multiple core identities: " +
          preBundledEntries.join(", ")
      );
    }
    const coreEntries = threeModuleIds.filter((id) =>
      /[\\/]three[\\/]src[\\/]Three\.Core\.js$/.test(id)
    );
    if (coreEntries.length !== 1) {
      this.error(
        "Expected exactly one Three.Core.js module in the TSL runtime, found " +
          coreEntries.length +
          "."
      );
    }
  },
});

const verifyAndTrackNodesHandler = () => ({
  name: "gdevelop-verify-and-track-three-nodes-handler",
  buildStart() {
    const handlerPath = fileURLToPath(
      new URL(
        "./node_modules/three/examples/jsm/tsl/WebGLNodesHandler.js",
        import.meta.url
      )
    );
    const actualHash = createHash("sha256")
      .update(readFileSync(handlerPath))
      .digest("hex");
    if (actualHash !== expectedWebGLNodesHandlerSha256) {
      this.error(
        `Unexpected r185 WebGLNodesHandler source hash: ${actualHash}. Review the compatibility adapter before updating the pinned hash.`
      );
    }
  },
  transform(code, id) {
    if (!/[\\/]three[\\/]src[\\/]renderers[\\/]WebGLRenderer\.js$/.test(id)) {
      return null;
    }
    const assignment = "\t\t\t_nodesHandler = nodesHandler;";
    if (!code.includes(assignment)) {
      this.error(
        "Unable to instrument the pinned WebGLRenderer nodes-handler assignment."
      );
    }
    return {
      code: code.replace(
        assignment,
        `${assignment}\n\t\t\tthis.__gdevelopNodesHandler = nodesHandler;`
      ),
      map: null,
    };
  },
});

const verifyTSLRuntimeContract = () => ({
  name: "gdevelop-verify-three-tsl-runtime-contract",
  buildStart() {
    const packageJson = JSON.parse(
      readFileSync(
        fileURLToPath(
          new URL("./node_modules/three/package.json", import.meta.url)
        ),
        "utf8"
      )
    );
    if (
      packageJson.version !== expectedThreeVersion ||
      packageJson.license !== "MIT"
    ) {
      this.error(
        `Expected Three ${expectedThreeVersion} under the MIT license, found ${packageJson.version} (${packageJson.license}).`
      );
    }
    const license = readFileSync(
      fileURLToPath(new URL("./node_modules/three/LICENSE", import.meta.url)),
      "utf8"
    );
    if (
      !license.includes("The MIT License") ||
      !license.includes("three.js authors")
    ) {
      this.error("The installed Three package has an unexpected license file.");
    }
  },
  generateBundle(outputOptions, bundle) {
    const entryChunks = Object.values(bundle).filter(
      (output) => output.type === "chunk" && output.isEntry
    );
    if (entryChunks.length !== 1) {
      this.error(
        `Expected one TSL runtime entry chunk, found ${entryChunks.length}.`
      );
    }
    const missingExports = requiredTSLRuntimeExports.filter(
      (name) => !entryChunks[0].exports.includes(name)
    );
    if (missingExports.length) {
      this.error(
        "The TSL runtime is missing required exports: " +
          missingExports.join(", ")
      );
    }
  },
  writeBundle(outputOptions) {
    if (
      !expectedTSLRuntimeSha256 ||
      !outputOptions.file ||
      !/[\\/]GDJS[\\/]Runtime[\\/]pixi-renderers[\\/]three-tsl\.js$/.test(
        outputOptions.file
      )
    ) {
      return;
    }
    const outputPath = fileURLToPath(
      new URL(outputOptions.file, import.meta.url)
    );
    const actualHash = createHash("sha256")
      .update(readFileSync(outputPath))
      .digest("hex");
    if (actualHash !== expectedTSLRuntimeSha256) {
      this.error(
        `The generated three-tsl.js hash is ${actualHash}, expected ${expectedTSLRuntimeSha256}. Review the bundle diff before updating the pinned hash.`
      );
    }
  },
});

export default [
  {
    // Bundle the whole Three.js library as a classic script exposing the
    // global `THREE` namespace (Three.js stopped providing such a build
    // after r160). The bundle is written directly to the game engine
    // ("Runtime") files, where it's expected to be a plain script setting
    // a global - like pixi.js and ThreeAddons.js.
    input: "./src/three.ts",
    output: [
      {
        name: "THREE",
        format: "umd",
        file: "./dist/three.js",
        sourcemap: true,
      },
      {
        name: "THREE",
        format: "umd",
        file: "../../GDJS/Runtime/pixi-renderers/three.js",
        sourcemap: false,
      },
    ],
    plugins: [
      resolve({
        extensions: [".js"],
      }),
      terser(),
    ],
  },
  {
    // TSL-enabled Three.js superset. This is intentionally a separate,
    // mutually-exclusive runtime file rather than an addon loaded next to
    // three.js: both ordinary and node-material classes must come from one
    // Rollup dependency graph and one global THREE identity.
    input: "./src/three-tsl.ts",
    output: [
      {
        name: "THREE",
        format: "umd",
        file: "./dist/three-tsl.js",
        sourcemap: true,
        banner: tslRuntimeBanner,
      },
      {
        name: "THREE",
        format: "umd",
        file: "../../GDJS/Runtime/pixi-renderers/three-tsl.js",
        sourcemap: false,
        banner: tslRuntimeBanner,
      },
    ],
    plugins: [
      forceSingleThreeSourceGraph(),
      verifyAndTrackNodesHandler(),
      verifyTSLRuntimeContract(),
      resolve({
        extensions: [".js"],
      }),
      terser(),
    ],
  },
  {
    input: "./src/index.ts",
    output: [
      {
        name: "THREE_ADDONS",
        format: "umd",
        file: "./dist/ThreeAddons.js",
        sourcemap: true,
        plugins: [],
        globals: {
          three: "THREE",
        },
      },
      {
        name: "THREE_ADDONS",
        format: "umd",
        file: "../../GDJS/Runtime/pixi-renderers/ThreeAddons.js",
        sourcemap: false,
        plugins: [],
        globals: {
          three: "THREE",
        },
      },
    ],
    external: ["three"],
    plugins: [
      resolve({
        extensions: [".js"],
      }),
      terser(),
    ],
  },
];
