// @noflow
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  buildIssueReportMarkdown,
  getIssueReportFileStem,
  getLocalProjectRoot,
  writeIssueReport,
} from './IssueReportWriter';

const createdAt = new Date('2026-08-13T07:30:12.123Z');
const screenshotDataUrl = 'data:image/png;base64,aGVsbG8=';

const makeReportData = () => ({
  createdAt,
  projectName: 'Example game',
  sceneName: 'Level 1',
  debuggerId: 'preview-ws-15',
  description: 'The player falls through this platform.',
  screenshotDataUrl,
  runtimeDump: { paused: true, score: 42 },
});

describe('IssueReportWriter', () => {
  const temporaryDirectories: Array<string> = [];

  afterEach(() => {
    temporaryDirectories.splice(0).forEach(directory => {
      fs.rmSync(directory, { recursive: true, force: true });
    });
  });

  test('builds a self-contained Markdown report', () => {
    const markdown = buildIssueReportMarkdown(makeReportData());

    expect(markdown).toContain('# Game issue report');
    expect(markdown).toContain('- Created: 2026-08-13T07:30:12.123Z');
    expect(markdown).toContain('- Scene: Level 1');
    expect(markdown).toContain('The player falls through this platform.');
    expect(markdown).toContain(
      `![Annotated paused game frame](${screenshotDataUrl})`
    );
    expect(markdown).toContain('"score": 42');
    expect(markdown.match(/data:image\/png;base64/g)).toHaveLength(1);
  });

  test('rejects missing descriptions and invalid screenshots', () => {
    expect(() =>
      buildIssueReportMarkdown({ ...makeReportData(), description: '  ' })
    ).toThrow('description');
    expect(() =>
      buildIssueReportMarkdown({
        ...makeReportData(),
        screenshotDataUrl: 'not-an-image',
      })
    ).toThrow('PNG data URL');
  });

  test('recognizes only absolute local project paths', () => {
    expect(getLocalProjectRoot('project.gdevelop')).toBe(null);
    const absoluteProjectFile = path.resolve('game', 'project.gdevelop');
    expect(getLocalProjectRoot(absoluteProjectFile)).toBe(
      path.dirname(absoluteProjectFile)
    );
  });

  test('writes reports under issues without overwriting collisions', async () => {
    const projectRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'gdevelop-issue-report-')
    );
    temporaryDirectories.push(projectRoot);
    const projectFile = path.join(projectRoot, 'project.gdevelop');

    const firstPath = await writeIssueReport({
      projectFile,
      data: makeReportData(),
    });
    const secondPath = await writeIssueReport({
      projectFile,
      data: makeReportData(),
    });

    expect(path.dirname(firstPath)).toBe(path.join(projectRoot, 'issues'));
    expect(path.basename(firstPath)).toBe(
      `${getIssueReportFileStem(createdAt)}.md`
    );
    expect(path.basename(secondPath)).toBe(
      `${getIssueReportFileStem(createdAt)}-1.md`
    );
    expect(fs.readFileSync(firstPath, 'utf8')).toContain(
      'The player falls through this platform.'
    );
  });
});
