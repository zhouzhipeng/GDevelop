const shell = require('shelljs');
const fs = require('fs');
const { downloadLocalFile } = require('./lib/DownloadLocalFile');
const path = require('path');

const sourceDirectory = '../../../Binaries/embuild/GDevelop.js';
const destinationTestDirectory = '../node_modules/libGD.js-for-tests-only';
const alreadyHasLibGdJs =
  shell.test('-f', '../public/libGD.js') &&
  shell.test('-f', '../public/libGD.wasm') &&
  shell.test('-f', destinationTestDirectory + '/index.js') &&
  shell.test('-f', destinationTestDirectory + '/libGD.wasm');

/**
 * libGD.js and libGD.wasm are loaded with a version in their URL so that a new
 * version is fetched when the version changes. Historically this was done with
 * a `?cache-buster=` query string, but CDNs (e.g. Cloudflare) do not cache URLs
 * with a query string by default, so every deploy forced a slow re-download of
 * the multi-MB wasm from the origin (and could time out the editor load).
 *
 * Instead, we put the version hash in the FILENAME: libGD.<versionWithHash>.js
 * and libGD.<versionWithHash>.wasm. These are path-only, immutable URLs that a
 * CDN caches forever, while a new build naturally produces a new path.
 *
 * The hashed files are byte-identical copies of public/libGD.js / libGD.wasm.
 * The loaders (src/index.js, BackgroundSerializer.worker.js, the service
 * worker) request the hashed names. The plain files are kept too (used by the
 * test harness and as the copy source).
 */
const writeHashedLibGdCopies = () => {
  const publicDir = path.join(__dirname, '..', 'public');
  const plainJs = path.join(publicDir, 'libGD.js');
  const plainWasm = path.join(publicDir, 'libGD.wasm');
  if (!shell.test('-f', plainJs) || !shell.test('-f', plainWasm)) {
    shell.echo(
      '⚠️ Cannot create hashed libGD copies: public/libGD.js or libGD.wasm is missing.'
    );
    return;
  }

  // Read the freshly generated version metadata (make-version-metadata runs
  // before this script in the import-resources npm script).
  // Bust the require cache in case it was generated during this same process.
  const versionMetadataPath = require.resolve('../src/Version/VersionMetadata');
  delete require.cache[versionMetadataPath];
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const { versionWithShortHash } = require(versionMetadataPath);
  if (!versionWithShortHash) {
    shell.echo(
      '⚠️ Cannot create hashed libGD copies: versionWithShortHash is empty.'
    );
    return;
  }

  // Remove any stale hashed copies so public/ does not accumulate old versions.
  fs.readdirSync(publicDir)
    .filter(name => /^libGD\..+\.(js|wasm)$/.test(name))
    .forEach(name => {
      try {
        fs.unlinkSync(path.join(publicDir, name));
      } catch (error) {
        // Best-effort cleanup.
      }
    });

  const hashedJs = path.join(publicDir, `libGD.${versionWithShortHash}.js`);
  const hashedWasm = path.join(publicDir, `libGD.${versionWithShortHash}.wasm`);
  if (shell.cp(plainJs, hashedJs).stderr || shell.cp(plainWasm, hashedWasm).stderr) {
    shell.echo('❌ Error while writing hashed libGD copies.');
  } else {
    shell.echo(
      `✅ Wrote hashed libGD copies: libGD.${versionWithShortHash}.js / .wasm`
    );
  }
};

if (shell.mkdir('-p', destinationTestDirectory).stderr) {
  shell.echo('❌ Error while creating node_modules folder for libGD.js');
}

if (shell.test('-f', path.join(sourceDirectory, 'libGD.js'))) {
  shell.echo(
    'ℹ️  Copying libGD.js and associated files built locally to newIDE...'
  );
  const copyToNewIDEScriptPath = path.join(
    __dirname,
    '..',
    '..',
    '..',
    'GDevelop.js',
    'scripts',
    'copy-to-newIDE.js'
  );
  shell.exec(`node ${copyToNewIDEScriptPath}`);
  writeHashedLibGdCopies();
} else if (
  alreadyHasLibGdJs &&
  !process.env.APPVEYOR &&
  !process.env.REQUIRES_EXACT_LIBGD_JS_VERSION
) {
  shell.echo(
    'Reusing existing libGD.js from newIDE/app/public and node_modules.'
  );
  writeHashedLibGdCopies();
} else {
  // Download a pre-built version otherwise
  shell.echo(
    '🌐 Downloading pre-built libGD.js from https://s3.amazonaws.com/gdevelop-gdevelop.js (be patient)...'
  );

  const getBranchFromGitRef = gitRef => {
    const branchShellString = shell.exec(
      `git rev-parse --abbrev-ref "${gitRef}"`,
      {
        silent: true,
      }
    );

    if (branchShellString.stderr || branchShellString.code) {
      return null;
    }

    let branch = (branchShellString.stdout || '').trim();
    if (branch === 'HEAD') {
      // We're in detached HEAD. Try to read the branch from the CI environment variables.
      if (process.env.APPVEYOR_PULL_REQUEST_HEAD_REPO_BRANCH) {
        branch = process.env.APPVEYOR_PULL_REQUEST_HEAD_REPO_BRANCH;
      } else if (process.env.APPVEYOR_REPO_BRANCH) {
        branch = process.env.APPVEYOR_REPO_BRANCH;
      }
    }

    if (!branch) {
      shell.echo(
        `⚠️ Can't find the branch of the associated commit - if you're in detached HEAD, you need to be on a branch instead.`
      );
      return 'unknown-branch';
    }

    return branch;
  };

  // Try to download libGD.js from a specific commit on the current branch
  const downloadCommitLibGdJs = (branch, gitRef) =>
    new Promise((resolve, reject) => {
      shell.echo(`ℹ️ Trying to download libGD.js for ${gitRef}.`);

      var hashShellString = shell.exec(`git rev-parse "${gitRef}"`, {
        silent: true,
      });
      const hash = (hashShellString.stdout || 'unknown-hash').trim();
      const branch = getBranchFromGitRef(gitRef);
      if (hashShellString.stderr || hashShellString.code || !branch) {
        shell.echo(
          `⚠️ Can't find the hash or branch of the associated commit.`
        );
        reject();
        return;
      }

      resolve(
        downloadLibGdJs(
          `https://s3.amazonaws.com/gdevelop-gdevelop.js/${branch}/commit/${hash}`
        )
      );
    });

  // Try to download libGD.js from the latest version built for master branch.
  const downloadBranchLatestLibGdJs = branchName => {
    shell.echo(
      `ℹ️ Trying to download libGD.js from ${branchName}, latest build.`
    );

    return downloadLibGdJs(
      `https://s3.amazonaws.com/gdevelop-gdevelop.js/${branchName}/latest`
    );
  };

  const downloadLibGdJs = baseUrl =>
    Promise.all([
      downloadLocalFile(baseUrl + '/libGD.js', '../public/libGD.js'),
      downloadLocalFile(baseUrl + '/libGD.wasm', '../public/libGD.wasm'),
    ]).then(
      responses => {},
      error => {
        if (error.statusCode === 403) {
          shell.echo(
            `ℹ️ Maybe libGD.js was not automatically built yet, try again in a few minutes.`
          );
          throw error;
        }
        if (error.statusCode === 0) {
          shell.echo(
            `⚠️ Can't download libGD.js (error: ${
              error.statusMessage
            }) (baseUrl=${baseUrl}), please check your internet connection.`
          );
          throw error;
        }

        shell.echo(
          `⚠️ Can't download libGD.js (${
            error.statusMessage
          }) (baseUrl=${baseUrl}), try again later.`
        );
        throw error;
      }
    );

  const onLibGdJsDownloaded = response => {
    shell.echo('✅ libGD.js downloaded and stored in public/libGD.js');

    if (
      !shell.cp('../public/libGD.js', destinationTestDirectory + '/index.js')
        .stderr &&
      !shell.cp(
        '../public/libGD.wasm',
        destinationTestDirectory + '/libGD.wasm'
      ).stderr
    ) {
      shell.echo('✅ Copied libGD.js to node_modules folder');
    } else {
      shell.echo('❌ Error while copying libGD.js to node_modules folder');
    }

    writeHashedLibGdCopies();
  };

  const branch = getBranchFromGitRef('HEAD');

  // Try to download the latest libGD.js, fallback to previous or master ones
  // if not found (including different parents, for handling of merge commits).
  downloadCommitLibGdJs(branch, 'HEAD').then(onLibGdJsDownloaded, () => {
    // Force the exact version of GDevelop.js to be downloaded for AppVeyor - because
    // this means we build the app and we don't want to risk mismatch (Core C++ not up to date
    // with the IDE JavaScript).
    if (process.env.APPVEYOR || process.env.REQUIRES_EXACT_LIBGD_JS_VERSION) {
      shell.echo(
        `❌ Can't download the exact required version of libGD.js - check it was built by CircleCI before running this CI.`
      );
      shell.echo(
        `ℹ️ See the pipeline on https://app.circleci.com/pipelines/github/4ian/GDevelop.`
      );
      shell.exit(1);
    }

    downloadCommitLibGdJs(branch, 'HEAD~1').then(onLibGdJsDownloaded, () =>
      downloadCommitLibGdJs(branch, 'HEAD~2').then(onLibGdJsDownloaded, () =>
        downloadCommitLibGdJs(branch, 'HEAD~3').then(onLibGdJsDownloaded, () =>
          downloadBranchLatestLibGdJs(branch).then(onLibGdJsDownloaded, () =>
            downloadBranchLatestLibGdJs('master').then(
              onLibGdJsDownloaded,
              () => {
                if (alreadyHasLibGdJs) {
                  shell.echo(
                    `ℹ️ Can't download any version of libGD.js, assuming you can go ahead with the existing one.`
                  );
                  writeHashedLibGdCopies();
                  shell.exit(0);
                  return;
                } else {
                  shell.echo(
                    `❌ Can't download any version of libGD.js, please check your internet connection.`
                  );
                  shell.exit(1);
                  return;
                }
              }
            )
          )
        )
      )
    );
  });
}
