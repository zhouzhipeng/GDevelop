// @flow
import optionalRequire from '../Utils/OptionalRequire';

const fs = optionalRequire('fs');
const path = optionalRequire('path');

export type IssueReportData = {|
  createdAt: Date,
  projectName: string,
  sceneName: ?string,
  debuggerId: string,
  description: string,
  screenshotDataUrl: string,
  runtimeDump: Object,
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

export const buildIssueReportMarkdown = (data: IssueReportData): string => {
  if (
    !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data.screenshotDataUrl)
  ) {
    throw new Error('The annotated screenshot is not a valid PNG data URL.');
  }
  if (!data.description.trim()) {
    throw new Error('An issue description is required.');
  }

  const metadata = [
    `- Created: ${data.createdAt.toISOString()}`,
    `- Project: ${toSingleLine(data.projectName) || 'Unnamed project'}`,
    ...(data.sceneName ? [`- Scene: ${toSingleLine(data.sceneName)}`] : []),
    `- Preview debugger ID: ${toSingleLine(data.debuggerId)}`,
  ];
  const runtimeDumpJson = JSON.stringify(data.runtimeDump, null, 2);

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
    `![Annotated paused game frame](${data.screenshotDataUrl})`,
    '',
    '## Runtime game memory dump',
    '',
    '```json',
    runtimeDumpJson,
    '```',
    '',
  ].join('\n');
};

export const writeIssueReport = async ({
  projectFile,
  data,
}: {|
  projectFile: string,
  data: IssueReportData,
|}): Promise<string> => {
  const projectRoot = getLocalProjectRoot(projectFile);
  if (!projectRoot || !fs || !path || !fs.promises) {
    throw new Error('Issue reports require a locally saved desktop project.');
  }

  const issuesDirectory = path.resolve(projectRoot, 'issues');
  if (path.relative(projectRoot, issuesDirectory) !== 'issues') {
    throw new Error('The issue report directory is outside the project root.');
  }

  const markdown = buildIssueReportMarkdown(data);
  await fs.promises.mkdir(issuesDirectory, { recursive: true });

  const stem = getIssueReportFileStem(data.createdAt);
  const temporaryPath = path.join(
    issuesDirectory,
    `.${stem}-${Math.random()
      .toString(36)
      .slice(2)}.tmp`
  );
  await fs.promises.writeFile(temporaryPath, markdown, {
    encoding: 'utf8',
    flag: 'wx',
  });

  try {
    for (let suffix = 0; suffix < 10000; suffix++) {
      const filename = `${stem}${suffix ? `-${suffix}` : ''}.md`;
      const reportPath = path.join(issuesDirectory, filename);
      try {
        // Creating a hard link publishes the fully-written temporary file in
        // one filesystem operation and fails rather than overwriting a report.
        await fs.promises.link(temporaryPath, reportPath);
        return reportPath;
      } catch (error) {
        if (error && error.code === 'EEXIST') continue;
        throw error;
      }
    }
    throw new Error('Unable to choose a unique issue report filename.');
  } finally {
    try {
      await fs.promises.unlink(temporaryPath);
    } catch (error) {
      if (!error || error.code !== 'ENOENT') throw error;
    }
  }
};
