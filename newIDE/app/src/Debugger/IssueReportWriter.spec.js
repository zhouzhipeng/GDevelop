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
const screenshotDataUrl =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=';

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

  test('builds Markdown that links compact external artifacts', () => {
    const markdown = buildIssueReportMarkdown(makeReportData(), {
      screenshotRelativePath: 'images/issue-screenshot.png',
      dumpRelativePath: 'dumps/issue-game-memory-dump.json',
    });

    expect(markdown).toContain('# Game issue report');
    expect(markdown).toContain('- Created: 2026-08-13T07:30:12.123Z');
    expect(markdown).toContain('- Scene: Level 1');
    expect(markdown).toContain('The player falls through this platform.');
    expect(markdown).toContain(
      '![Annotated paused game frame](images/issue-screenshot.png)'
    );
    expect(markdown).toContain(
      '[Open the game-memory dump](dumps/issue-game-memory-dump.json)'
    );
    expect(markdown).toContain('Only read the linked game-memory dump');
    expect(markdown).toContain('avoid wasting context tokens');
    expect(markdown).not.toContain('data:image/png;base64');
    expect(markdown).not.toContain('"score": 42');
  });

  test('rejects missing descriptions', () => {
    expect(() =>
      buildIssueReportMarkdown(
        { ...makeReportData(), description: '  ' },
        {
          screenshotRelativePath: 'images/screenshot.png',
          dumpRelativePath: 'dumps/dump.json',
        }
      )
    ).toThrow('description');
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
    const firstStem = getIssueReportFileStem(createdAt);
    const firstMarkdown = fs.readFileSync(firstPath, 'utf8');
    const firstScreenshotPath = path.join(
      projectRoot,
      'issues',
      'images',
      `${firstStem}-screenshot.png`
    );
    const firstDumpPath = path.join(
      projectRoot,
      'issues',
      'dumps',
      `${firstStem}-game-memory-dump.json`
    );
    expect(fs.readFileSync(firstScreenshotPath).slice(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
    expect(JSON.parse(fs.readFileSync(firstDumpPath, 'utf8'))).toEqual({
      paused: true,
      score: 42,
    });
    expect(firstMarkdown).toContain(
      `![Annotated paused game frame](images/${firstStem}-screenshot.png)`
    );
    expect(firstMarkdown).toContain(
      `[Open the game-memory dump](dumps/${firstStem}-game-memory-dump.json)`
    );
    expect(firstMarkdown).not.toContain(screenshotDataUrl);
    const secondStem = `${firstStem}-1`;
    expect(
      fs.existsSync(
        path.join(
          projectRoot,
          'issues',
          'images',
          `${secondStem}-screenshot.png`
        )
      )
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          projectRoot,
          'issues',
          'dumps',
          `${secondStem}-game-memory-dump.json`
        )
      )
    ).toBe(true);
    expect(fs.readFileSync(secondPath, 'utf8')).toContain(
      `images/${secondStem}-screenshot.png`
    );
  });

  test('rejects invalid screenshot bytes without creating a report', async () => {
    const projectRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'gdevelop-invalid-issue-report-')
    );
    temporaryDirectories.push(projectRoot);
    const projectFile = path.join(projectRoot, 'project.gdevelop');

    await expect(
      writeIssueReport({
        projectFile,
        data: {
          ...makeReportData(),
          screenshotDataUrl: 'data:image/png;base64,aGVsbG8=',
        },
      })
    ).rejects.toThrow('valid PNG image');
    expect(fs.existsSync(path.join(projectRoot, 'issues'))).toBe(false);
  });
});
