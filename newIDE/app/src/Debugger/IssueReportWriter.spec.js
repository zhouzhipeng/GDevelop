// @noflow
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  buildIssueReportMarkdown,
  getIssueReportClipboardPath,
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
  consoleLogs: [
    {
      timestamp: 125.25,
      type: 'error',
      group: 'JavaScript',
      message: 'Unable to load player state',
    },
    {
      timestamp: 130,
      type: 'info',
      group: 'Game',
      message: 'Player entered level 2',
    },
  ],
});

describe('IssueReportWriter', () => {
  const temporaryDirectories: Array<string> = [];

  afterEach(() => {
    temporaryDirectories.splice(0).forEach(directory => {
      fs.rmSync(directory, { recursive: true, force: true });
    });
  });

  test('saves video and timed inputs with collision-safe links', async () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'gdevelop-recording-')
    );
    temporaryDirectories.push(directory);
    const video = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3]);
    const inputs = [{ timeMs: 12, type: 'keydown', code: 'KeyA' }];
    const data = {
      ...makeReportData(),
      recording: {
        dataUrl: 'data:video/webm;base64,' + video.toString('base64'),
        inputs,
      },
    };
    const projectFile = path.join(directory, 'game.json');
    for (let index = 0; index < 2; index++) {
      const report = await writeIssueReport({ projectFile, data });
      const stem = path.basename(report, '.md');
      const markdown = fs.readFileSync(report, 'utf8');
      expect(markdown).toContain(`recordings/${stem}.webm`);
      expect(markdown).toContain(`recordings/${stem}-inputs.json`);
      expect(
        fs.readFileSync(
          path.join(directory, 'issues', 'recordings', stem + '.webm')
        )
      ).toEqual(video);
      expect(
        JSON.parse(
          fs.readFileSync(
            path.join(directory, 'issues', 'recordings', stem + '-inputs.json'),
            'utf8'
          )
        )
      ).toEqual(inputs);
    }
    expect(
      fs
        .readdirSync(path.join(directory, 'issues', 'recordings'))
        .some(name => name.endsWith('.tmp'))
    ).toBe(false);
  });

  test('rolls back recording artifacts if publishing the report fails', async () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'gdevelop-recording-failure-')
    );
    temporaryDirectories.push(directory);
    const originalLink = fs.promises.link;
    const link = jest
      .spyOn(fs.promises, 'link')
      .mockImplementation((source, target) => {
        if (target.endsWith('.md'))
          return Promise.reject(new Error('Disk full'));
        return originalLink(source, target);
      });
    try {
      await expect(
        writeIssueReport({
          projectFile: path.join(directory, 'game.json'),
          data: {
            ...makeReportData(),
            recording: {
              dataUrl: 'data:video/webm;base64,GkXfow==',
              inputs: [],
            },
          },
        })
      ).rejects.toThrow('Disk full');
    } finally {
      link.mockRestore();
    }
    for (const name of ['recordings', 'images', 'logs', 'dumps']) {
      expect(fs.readdirSync(path.join(directory, 'issues', name))).toEqual([]);
    }
    expect(
      fs
        .readdirSync(path.join(directory, 'issues'))
        .some(name => name.endsWith('.md') || name.endsWith('.tmp'))
    ).toBe(false);
  });

  test('rejects invalid recordings before publishing a report', async () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'gdevelop-invalid-recording-')
    );
    temporaryDirectories.push(directory);
    await expect(
      writeIssueReport({
        projectFile: path.join(directory, 'game.json'),
        data: {
          ...makeReportData(),
          recording: { dataUrl: 'data:video/webm;base64,YmFk', inputs: [] },
        },
      })
    ).rejects.toThrow('not a valid WebM');
    expect(fs.existsSync(path.join(directory, 'issues'))).toBe(false);
  });

  test('builds Markdown that links compact external artifacts', () => {
    const markdown = buildIssueReportMarkdown(makeReportData(), {
      screenshotRelativePath: 'images/issue-screenshot.png',
      dumpRelativePath: 'dumps/issue-game-memory-dump.json',
      logRelativePath: 'logs/issue-console.log',
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
    expect(markdown).toContain(
      '[Search the debugger console log](logs/issue-console.log)'
    );
    expect(markdown).toContain('Use the linked console log as a search source');
    expect(markdown).toContain('Do not load the full log');
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
          logRelativePath: 'logs/console.log',
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

  test('builds a project-relative clipboard path for the saved report', () => {
    expect(
      getIssueReportClipboardPath(
        'C:\\Games\\Example\\issues\\issue-20260814-055200-754.md'
      )
    ).toBe('issues/issue-20260814-055200-754.md');
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
    const firstLogPath = path.join(
      projectRoot,
      'issues',
      'logs',
      `${firstStem}-console.log`
    );
    expect(fs.readFileSync(firstScreenshotPath).slice(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
    expect(JSON.parse(fs.readFileSync(firstDumpPath, 'utf8'))).toEqual({
      paused: true,
      score: 42,
    });
    expect(fs.readFileSync(firstLogPath, 'utf8')).toContain(
      '[125.250 ms] [ERROR] [JavaScript] Unable to load player state'
    );
    expect(firstMarkdown).toContain(
      `![Annotated paused game frame](images/${firstStem}-screenshot.png)`
    );
    expect(firstMarkdown).toContain(
      `[Open the game-memory dump](dumps/${firstStem}-game-memory-dump.json)`
    );
    expect(firstMarkdown).toContain(
      `[Search the debugger console log](logs/${firstStem}-console.log)`
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
        path.join(projectRoot, 'issues', 'logs', `${secondStem}-console.log`)
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
