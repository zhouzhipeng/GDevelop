// @flow
import optionalRequire from '../../Utils/OptionalRequire';

const fs = optionalRequire('fs-extra');
const path = optionalRequire('path');
const manifestName = 'desktop-service.json';
const serviceDirectory = 'gdevelop-desktop-service';

const isRelativeFile = (value: mixed): boolean =>
  typeof value === 'string' &&
  value.split('/').every(part => /^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(part));

export type DesktopServicePreview =
  | {| entry: string, cwd: string, transport: 'ipc' |}
  | {|
      entry: string,
      cwd: string,
      transport?: void,
      port: number,
      path: string,
      method: 'GET' | 'OPTIONS',
    |};

const readLocalElectronService = (
  projectFile: string
): ?{|
  files: Array<string>,
  sources: Array<string>,
  entry: string,
  preview: ?DesktopServicePreview,
|} => {
  if (!fs || !path || !path.isAbsolute(projectFile)) return;
  const root = path.dirname(projectFile);
  const manifestPath = path.join(root, manifestName);
  if (!fs.existsSync(manifestPath)) return;

  const realRoot = fs.realpathSync(root);
  const readProjectFile = (relative: string): string => {
    const source = fs.realpathSync(path.join(root, relative));
    const relativeSource = path.relative(realRoot, source);
    if (
      !relativeSource ||
      relativeSource === '..' ||
      relativeSource.startsWith('..' + path.sep) ||
      path.isAbsolute(relativeSource) ||
      !fs.statSync(source).isFile()
    ) {
      throw new Error(
        'Desktop service file must be inside the project: ' + relative
      );
    }
    return source;
  };

  const manifest = fs.readJsonSync(readProjectFile(manifestName));
  if (
    !manifest ||
    typeof manifest.entry !== 'string' ||
    !manifest.entry.endsWith('.mjs') ||
    !isRelativeFile(manifest.entry) ||
    !Array.isArray(manifest.files) ||
    !manifest.files.every(isRelativeFile)
  ) {
    throw new Error(
      'Invalid desktop-service.json: expected a relative .mjs entry and an array of relative files.'
    );
  }

  const files: Array<string> = [
    ...new Set([manifest.entry, ...manifest.files]),
  ];
  const sources = files.map(readProjectFile);
  let preview = null;
  const readiness = manifest.preview;
  if (readiness && readiness.transport === 'ipc') {
    preview = { entry: sources[0], cwd: realRoot, transport: 'ipc' };
  } else if (readiness !== undefined) {
    if (
      !readiness ||
      !Number.isInteger(readiness.port) ||
      readiness.port < 1 ||
      readiness.port > 65535 ||
      typeof readiness.path !== 'string' ||
      !/^\/[^\s#]*$/.test(readiness.path) ||
      (readiness.method !== undefined &&
        readiness.method !== 'GET' &&
        readiness.method !== 'OPTIONS')
    ) {
      throw new Error(
        'Invalid desktop-service.json preview: expected a loopback port, an HTTP path and optionally GET or OPTIONS.'
      );
    }
    preview = {
      entry: sources[0],
      cwd: realRoot,
      port: readiness.port,
      path: readiness.path,
      method: readiness.method || 'GET',
    };
  }
  return { files, sources, entry: manifest.entry, preview };
};

export const getLocalElectronServicePreview = (
  projectFile: string
): ?DesktopServicePreview => {
  const service = readLocalElectronService(projectFile);
  return service && service.preview;
};

export const exportLocalElectronService = (
  projectFile: string,
  outputDirectory: string
): void => {
  const service = readLocalElectronService(projectFile);
  if (!service) return;
  const { files, sources, entry } = service;
  const packagePath = path.join(outputDirectory, 'package.json');
  const packageJson = fs.readJsonSync(packagePath);

  for (const [index, file] of files.entries()) {
    const target = path.join(outputDirectory, serviceDirectory, file);
    fs.ensureDirSync(path.dirname(target));
    fs.copyFileSync(sources[index], target);
  }

  packageJson.gdevelopDesktopService = entry;
  packageJson.build.extraResources = [
    ...(packageJson.build.extraResources || []),
    { from: serviceDirectory, to: serviceDirectory, filter: files },
  ];
  fs.writeJsonSync(packagePath, packageJson, { spaces: 2 });
};
