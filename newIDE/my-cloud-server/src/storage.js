// @ts-check
'use strict';

/**
 * Filesystem-backed storage for the self-hosted "My Cloud" GDevelop server.
 *
 * Layout:
 *   <dataDir>/
 *     projects.json                 index: id -> metadata
 *     <projectId>/
 *       game.zip                    current project body (a zip containing game.json)
 *       resources/<sha>-<file>      uploaded assets
 *       export/                     last HTML5 export (for /play/:id)
 *
 * The server never unzips game.zip: the IDE zips/unzips the project body itself.
 * Only the play-export is extracted server-side (see writeExport).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const yauzl = require('yauzl');

const PROJECTS_INDEX_FILE = 'projects.json';

/** Mime types good enough to serve an HTML5 game export and resources. */
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.zip': 'application/zip',
  '.txt': 'text/plain; charset=utf-8',
};

const getMimeTypeForFile = filename => {
  const ext = path.extname(filename).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
};

/**
 * Reject names that could escape their parent directory (path traversal).
 * Accepts forward-slash separated relative paths (used by zip entries / urls).
 */
const isSafeRelativePath = relativePath => {
  if (typeof relativePath !== 'string' || !relativePath) return false;
  if (relativePath.includes('\0')) return false;
  const normalized = path.posix.normalize(relativePath);
  if (path.posix.isAbsolute(normalized)) return false;
  if (normalized === '..' || normalized.startsWith('../')) return false;
  if (relativePath.includes('\\')) return false;
  return true;
};

const ensureDirSync = dir => {
  fs.mkdirSync(dir, { recursive: true });
};

const rmRfSync = target => {
  // fs.rmSync exists on Node >= 14.14.
  if (fs.rmSync) {
    fs.rmSync(target, { recursive: true, force: true });
  } else {
    // $FlowFixMe - legacy fallback
    fs.rmdirSync(target, { recursive: true });
  }
};

/**
 * Create a storage instance rooted at `dataDir`.
 * All write operations that touch the index are serialized through a single
 * promise chain to avoid read-modify-write races.
 */
const createStorage = dataDir => {
  ensureDirSync(dataDir);
  const indexPath = path.join(dataDir, PROJECTS_INDEX_FILE);

  // Tiny mutex: chain of promises so index writes don't interleave.
  let writeQueue = Promise.resolve();
  const withIndexLock = task => {
    const run = writeQueue.then(() => task());
    // Keep the queue alive even if a task rejects.
    writeQueue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  };

  const readIndex = () => {
    try {
      const raw = fs.readFileSync(indexPath, 'utf8');
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      if (error.code === 'ENOENT') return {};
      throw error;
    }
  };

  const writeIndex = index => {
    const tmpPath = indexPath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(index, null, 2));
    fs.renameSync(tmpPath, indexPath);
  };

  const projectDir = id => path.join(dataDir, id);
  const resourcesDir = id => path.join(projectDir(id), 'resources');
  const exportDir = id => path.join(projectDir(id), 'export');
  const archivePath = id => path.join(projectDir(id), 'game.zip');

  const nowIso = () => new Date().toISOString();
  const newVersionId = () =>
    `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;

  return {
    getMimeTypeForFile,
    isSafeRelativePath,

    // When ownerId is provided, only that user's projects are returned (plus
    // legacy projects that predate accounts and have no ownerId). When ownerId
    // is null/undefined (no-auth mode), all projects are returned.
    async listProjects(ownerId) {
      const index = readIndex();
      return Object.keys(index)
        .map(id => index[id])
        .filter(p => {
          if (!ownerId) return true;
          return !p.ownerId || p.ownerId === ownerId;
        })
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    },

    async getProject(id) {
      const index = readIndex();
      return index[id] || null;
    },

    async createProject({ name, gameId, ownerId }) {
      return withIndexLock(() => {
        const index = readIndex();
        const id = crypto.randomUUID();
        const metadata = {
          id,
          name: name || 'Untitled project',
          gameId: gameId || null,
          ownerId: ownerId || null,
          createdAt: nowIso(),
          updatedAt: nowIso(),
          currentVersion: null,
        };
        ensureDirSync(projectDir(id));
        index[id] = metadata;
        writeIndex(index);
        return metadata;
      });
    },

    async updateProject(id, { name, gameId }) {
      return withIndexLock(() => {
        const index = readIndex();
        const metadata = index[id];
        if (!metadata) return null;
        if (typeof name === 'string' && name) metadata.name = name;
        if (typeof gameId === 'string') metadata.gameId = gameId;
        metadata.updatedAt = nowIso();
        index[id] = metadata;
        writeIndex(index);
        return metadata;
      });
    },

    async deleteProject(id) {
      return withIndexLock(() => {
        const index = readIndex();
        if (!index[id]) return false;
        delete index[id];
        writeIndex(index);
        try {
          rmRfSync(projectDir(id));
        } catch (error) {
          // Index is the source of truth; ignore best-effort dir cleanup errors.
        }
        return true;
      });
    },

    /**
     * Write the project body (a zip the IDE produced) and bump currentVersion.
     * Returns the new version id, or null if the project does not exist.
     */
    async writeArchive(id, buffer) {
      return withIndexLock(() => {
        const index = readIndex();
        const metadata = index[id];
        if (!metadata) return null;
        ensureDirSync(projectDir(id));
        const tmp = archivePath(id) + '.tmp';
        fs.writeFileSync(tmp, buffer);
        fs.renameSync(tmp, archivePath(id));
        metadata.currentVersion = newVersionId();
        metadata.updatedAt = nowIso();
        index[id] = metadata;
        writeIndex(index);
        return metadata.currentVersion;
      });
    },

    /** Read the project body zip. Returns a Buffer or null. */
    async readArchive(id) {
      try {
        return fs.readFileSync(archivePath(id));
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
    },

    /**
     * Read and parse the project JSON (game.json) from the stored archive.
     * Returns the parsed object, or null if the project has no saved content.
     * Used by the standalone MCP host to inspect projects server-side.
     */
    async readProjectJson(id) {
      const buffer = await this.readArchive(id);
      if (!buffer) return null;
      const text = await readFirstZipEntryText(buffer);
      if (text == null) return null;
      return JSON.parse(text);
    },

    /**
     * Store one uploaded resource file. Returned `storedName` is what the
     * IDE references in resource URLs: /resources/<id>/<storedName>.
     */
    async writeResource(id, { sha, filename, buffer }) {
      const index = readIndex();
      if (!index[id]) return null;
      ensureDirSync(resourcesDir(id));
      const safeFilename = path.posix.basename(filename || 'file');
      const storedName = `${sha || 'nohash'}-${safeFilename}`;
      if (!isSafeRelativePath(storedName)) return null;
      const target = path.join(resourcesDir(id), storedName);
      fs.writeFileSync(target, buffer);
      return storedName;
    },

    /** Read a stored resource by its stored name. Returns Buffer or null. */
    async readResource(id, storedName) {
      if (!isSafeRelativePath(storedName)) return null;
      try {
        return fs.readFileSync(path.join(resourcesDir(id), storedName));
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
    },

    /**
     * Extract a play-export zip (an HTML5 build) into <id>/export/, replacing
     * any previous export. Returns true on success, null if project missing.
     */
    async writeExport(id, buffer) {
      const index = readIndex();
      if (!index[id]) return null;
      const target = exportDir(id);
      rmRfSync(target);
      ensureDirSync(target);
      await extractZipBufferToDir(buffer, target);
      return true;
    },

    hasExport(id) {
      try {
        return fs.existsSync(path.join(exportDir(id), 'index.html'));
      } catch (error) {
        return false;
      }
    },

    /**
     * Read a file from a project's export dir for /play/:id serving.
     * `relativePath` defaults to index.html. Guards against path traversal.
     * Returns { buffer, mimeType } or null.
     */
    async readExportFile(id, relativePath) {
      const rel = !relativePath || relativePath === '/' ? 'index.html' : relativePath;
      if (!isSafeRelativePath(rel)) return null;
      const target = path.join(exportDir(id), rel);
      try {
        const buffer = fs.readFileSync(target);
        return { buffer, mimeType: getMimeTypeForFile(rel) };
      } catch (error) {
        if (error.code === 'ENOENT' || error.code === 'EISDIR') return null;
        throw error;
      }
    },
  };
};

/** Read the first file entry of a zip Buffer as UTF-8 text (the project body
 * zip contains a single `game.json` entry). Returns null if empty. */
const readFirstZipEntryText = buffer =>
  new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) return reject(err || new Error('Invalid zip.'));
      let settled = false;
      zipfile.readEntry();
      zipfile.on('entry', entry => {
        if (/\/$/.test(entry.fileName)) {
          zipfile.readEntry();
          return;
        }
        zipfile.openReadStream(entry, (streamErr, readStream) => {
          if (streamErr || !readStream)
            return reject(streamErr || new Error('Cannot read zip entry.'));
          const chunks = [];
          readStream.on('data', c => chunks.push(c));
          readStream.on('error', reject);
          readStream.on('end', () => {
            settled = true;
            resolve(Buffer.concat(chunks).toString('utf8'));
            zipfile.close();
          });
        });
      });
      zipfile.on('end', () => {
        if (!settled) resolve(null);
      });
      zipfile.on('error', reject);
    });
  });

/** Extract a zip provided as a Buffer into `destDir` using yauzl. */
const extractZipBufferToDir = (buffer, destDir) =>
  new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) return reject(err || new Error('Invalid zip.'));
      zipfile.readEntry();
      zipfile.on('entry', entry => {
        const entryName = entry.fileName;
        if (/\/$/.test(entryName)) {
          // Directory entry.
          zipfile.readEntry();
          return;
        }
        if (!isSafeRelativePath(entryName)) {
          // Skip unsafe entries instead of failing the whole extraction.
          zipfile.readEntry();
          return;
        }
        const outPath = path.join(destDir, entryName);
        ensureDirSync(path.dirname(outPath));
        zipfile.openReadStream(entry, (streamErr, readStream) => {
          if (streamErr || !readStream)
            return reject(streamErr || new Error('Cannot read zip entry.'));
          const writeStream = fs.createWriteStream(outPath);
          readStream.on('error', reject);
          writeStream.on('error', reject);
          writeStream.on('close', () => zipfile.readEntry());
          readStream.pipe(writeStream);
        });
      });
      zipfile.on('end', resolve);
      zipfile.on('error', reject);
    });
  });

module.exports = {
  createStorage,
  getMimeTypeForFile,
  isSafeRelativePath,
};
