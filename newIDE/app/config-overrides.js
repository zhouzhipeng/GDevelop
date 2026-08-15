// This file customizes webpack configuration for react-app-rewired.
const ModuleScopePlugin = require('react-dev-utils/ModuleScopePlugin');
const path = require('path');

module.exports = {
  webpack: function override(config, env) {
    config.module.rules.push({
      test: /\.worker\.js$/,
      use: {
        loader: 'worker-loader',
        options: {
          filename: '[name].[contenthash].worker.js',
        },
      },
    });

    // A lot of packages we use in node_modules trigger source map warnings
    // but it is not a blocking issue, so we ignore them.
    config.ignoreWarnings = [/Failed to parse source map/];

    config.resolve.plugins = config.resolve.plugins.filter(
      plugin => !(plugin instanceof ModuleScopePlugin)
    );
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      // Keep editor-side TSL validation on one Three source graph. The package
      // exports for three, three/tsl and three/webgpu are separate pre-bundled
      // entry files and cannot be mixed without duplicating core constructors.
      three$: path.resolve(__dirname, 'node_modules/three/src/Three.js'),
      'three/tsl$': path.resolve(
        __dirname,
        'node_modules/three/src/nodes/TSL.js'
      ),
      'three/webgpu$': path.resolve(
        __dirname,
        'node_modules/three/src/Three.WebGPU.js'
      ),
    };

    return config;
  },

  jest: function(config) {
    config.transformIgnorePatterns = [
      '<rootDir>/node_modules/(?!react-markdown|vfile|unist-.*|unified|bail|trough|character-entities|remark-parse|mdast-util-.*|micromark|decode-named-character-reference|remark-rehype|property-information|hast-util-.*|space-separated-tokens|comma-separated-tokens|ccount|escape-string-regexp|trim-lines|hast-util-whitespace|remark-gfm|mdast-util-gfm|mdast-util-find-and-replace|mdast-util-to-markdown|markdown-table|is-plain-obj)',
    ];

    // This suite downloads and converts the complete GDevelop examples
    // repository. Keep it out of normal unit-test discovery; the dedicated
    // npm script opts in explicitly before this configuration is evaluated.
    if (process.env.RUN_GDEVELOP_EXAMPLES_COMPATIBILITY !== '1') {
      config.testPathIgnorePatterns = [
        ...(config.testPathIgnorePatterns || []),
        '/GDevelopExamplesCompatibility\\.spec\\.js$',
      ];
    }

    return config;
  },
};
