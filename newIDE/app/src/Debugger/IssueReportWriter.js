// @flow
import optionalRequire from '../Utils/OptionalRequire';

const fs = optionalRequire('fs');
const path = optionalRequire('path');
const nodeBuffer = optionalRequire('buffer');

export type IssueReportData = {|
  createdAt: Date,
  projectName: string,
  sceneName: ?string,
  debuggerId: string,
  description: string,
  screenshotDataUrl: string,
  runtimeDump: Object,
|};

type IssueReportArtifactLinks = {|
  screenshotRelativePath: string,
  dumpRelativePath: string,
|};

const toSingleLine = (value: string): string =>
  value.replace(/[\r\n]+/g, ' ').trim();

const padNumber = (value: number, length: number): string =>
  String(value).padStart(length, '0');

export const getIssueReportFileStem = (date: Date): string =>
  `issue-${padNumber(date.getUTCFullYear(), 4)}${padNumber(
    date.getUTCMonth() + 1,
    2
  )}${padNumber(date.getUTCDate(), 2)}-${padNumber(
    date.getUTCHours(),
    2
  )}${padNumber(date.getUTCMinutes(), 2)}${padNumber(
    date.getUTCSeconds(),
    2
  )}-${padNumber(date.getUTCMilliseconds(), 3)}`;

export const getLocalProjectRoot = (projectFile: string): ?string => {
  if (!fs || !path || !projectFile || !path.isAbsolute(projectFile)) {
    return null;
  }
  return path.dirname(path.resolve(projectFile));
};

export const buildIssueReportMarkdown = (
  data: IssueReportData,
  { screenshotRelativePath, dumpRelativePath }: IssueReportArtifactLinks
): string => {
  if (!data.description.trim()) {
    throw new Error('An issue description is required.');
  }

  const metadata = [
    `- Created: ${data.createdAt.toISOString()}`,
    `- Project: ${toSingleLine(data.projectName) || 'Unnamed project'}`,
    ...(data.sceneName ? [`- Scene: ${toSingleLine(data.sceneName)}`] : []),
    `- Preview debugger ID: ${toSingleLine(data.debuggerId)}`,
  ];

  return [
    '# Game issue report',
    '',
    ...metadata,
    '',
    '## User description',
    '',
    data.description.trim(),
    '',
    '## Annotated screenshot',
    '',
    `![Annotated paused game frame](${screenshotRelativePath})`,
    '',
    '## Runtime game memory dump',
    '',
    `[Open the game-memory dump](${dumpRelativePath})`,
    '',
    '### AI investigation guidance',
    '',
    'Start with the user description and annotated screenshot. Only read the linked game-memory dump if the reported issue is very difficult to investigate or those sources are insufficient. Otherwise, do not read it, to avoid wasting context tokens.',
    '',
  ].join('\n');
};

const getScreenshotPngBytes = (screenshotDataUrl: string): any => {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(
    screenshotDataUrl
  );
  if (!match || !nodeBuffer || !nodeBuffer.Buffer) {
    throw new Error('The annotated screenshot is not a valid PNG data URL.');
  }
  const pngBytes = nodeBuffer.Buffer.from(match[1], 'base64');
  if (
    pngBytes.length < 8 ||
    pngBytes[0] !== 0x89 ||
    pngBytes[1] !== 0x50 ||
    pngBytes[2] !== 0x4e ||
    pngBytes[3] !== 0x47 ||
    pngBytes[4] !== 0x0d ||
    pngBytes[5] !== 0x0a ||
    pngBytes[6] !== 0x1a ||
    pngBytes[7] !== 0x0a
  ) {
    throw new Error('The annotated screenshot is not a valid PNG image.');
  }
  return pngBytes;
};

const removeFileIfCreated = async (filePath: string): Promise<void> => {
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (!error || error.code !== 'ENOENT') throw error;
  }
};

export const writeIssueReport = async ({
  projectFile,
  data,
}: {|
  projectFile: string,
  data: IssueReportData,
|}): Promise<string> => {
  const projectRoot = getLocalProjectRoot(projectFile);
  if (!projectRoot || !fs || !path || !fs.promises || !nodeBuffer) {
    throw new Error('Issue reports require a locally saved desktop project.');
  }

  const issuesDirectory = path.resolve(projectRoot, 'issues');
  const imagesDirectory = path.resolve(issuesDirectory, 'images');
  const dumpsDirectory = path.resolve(issuesDirectory, 'dumps');
  if (path.relative(projectRoot, issuesDirectory) !== 'issues') {
    throw new Error('The issue report directory is outside the project root.');
  }
  if (
    path.relative(issuesDirectory, imagesDirectory) !== 'images' ||
    path.relative(issuesDirectory, dumpsDirectory) !== 'dumps'
  ) {
    throw new Error('An issue report artifact directory is outside issues.');
  }

  const pngBytes = getScreenshotPngBytes(data.screenshotDataUrl);
  const dumpJson = `${JSON.stringify(data.runtimeDump, null, 2)}\n`;
  await Promise.all([
    fs.promises.mkdir(imagesDirectory, { recursive: true }),
    fs.promises.mkdir(dumpsDirectory, { recursive: true }),
  ]);

  const baseStem = getIssueReportFileStem(data.createdAt);
  const temporaryToken = `${baseStem}-${Math.random()
    .toString(36)
    .slice(2)}`;
  const temporaryScreenshotPath = path.join(
    imagesDirectory,
    `.${temporaryToken}.png.tmp`
  );
  const temporaryDumpPath = path.join(
    dumpsDirectory,
    `.${temporaryToken}.json.tmp`
  );
  try {
    await fs.promises.writeFile(temporaryScreenshotPath, pngBytes, {
      flag: 'wx',
    });
    await fs.promises.writeFile(temporaryDumpPath, dumpJson, {
      encoding: 'utf8',
      flag: 'wx',
    });

    for (let suffix = 0; suffix < 10000; suffix++) {
      const stem = `${baseStem}${suffix ? `-${suffix}` : ''}`;
      const screenshotFilename = `${stem}-screenshot.png`;
      const dumpFilename = `${stem}-game-memory-dump.json`;
      const reportPath = path.join(issuesDirectory, `${stem}.md`);
      const screenshotPath = path.join(imagesDirectory, screenshotFilename);
      const dumpPath = path.join(dumpsDirectory, dumpFilename);
      const temporaryMarkdownPath = path.join(
        issuesDirectory,
        `.${temporaryToken}-${suffix}.md.tmp`
      );
      let screenshotWasCreated = false;
      let dumpWasCreated = false;
      try {
        await fs.promises.link(temporaryScreenshotPath, screenshotPath);
        screenshotWasCreated = true;
        await fs.promises.link(temporaryDumpPath, dumpPath);
        dumpWasCreated = true;

        const markdown = buildIssueReportMarkdown(data, {
          screenshotRelativePath: `images/${screenshotFilename}`,
          dumpRelativePath: `dumps/${dumpFilename}`,
        });
        await fs.promises.writeFile(temporaryMarkdownPath, markdown, {
          encoding: 'utf8',
          flag: 'wx',
        });
        // Publish the Markdown last so every link points to a complete file as
        // soon as the report becomes visible.
        await fs.promises.link(temporaryMarkdownPath, reportPath);
        await removeFileIfCreated(temporaryMarkdownPath);
        return reportPath;
      } catch (error) {
        await removeFileIfCreated(temporaryMarkdownPath);
        if (dumpWasCreated) await removeFileIfCreated(dumpPath);
        if (screenshotWasCreated) await removeFileIfCreated(screenshotPath);
        if (error && error.code === 'EEXIST') continue;
        throw error;
      }
    }
    throw new Error('Unable to choose a unique issue report filename.');
  } finally {
    await Promise.all([
      removeFileIfCreated(temporaryScreenshotPath),
      removeFileIfCreated(temporaryDumpPath),
    ]);
  }
};
