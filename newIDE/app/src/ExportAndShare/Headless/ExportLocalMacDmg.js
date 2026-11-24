// @flow
import { type I18n } from '@lingui/core';
import optionalRequire from '../../Utils/OptionalRequire';
import { exportLocalElectronHeadless } from '../LocalExporters/LocalElectronExport';

const fs = optionalRequire('fs');
const path = optionalRequire('path');
const process = optionalRequire('process');
const childProcess = optionalRequire('child_process');

const runNpm = (
  args: Array<string>,
  cwd: string,
  timeout: number
): Promise<void> =>
  new Promise((resolve, reject) => {
    childProcess.execFile(
      'npm',
      args,
      { cwd, timeout, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const output = (stderr || stdout || '').trim().slice(-4000);
          reject(
            new Error(
              'npm ' +
                args[0] +
                ': ' +
                error.message.split('\n')[0] +
                (output ? '\n' + output : '')
            )
          );
        } else {
          resolve();
        }
      }
    );
  });

export const exportLocalMacDmg = async (
  project: gdProject,
  i18n: I18n,
  outputDir: string
): Promise<string> => {
  if (
    !process ||
    process.platform !== 'darwin' ||
    !childProcess ||
    !fs ||
    !path
  ) {
    throw new Error(
      'macOS DMG export requires the GDevelop desktop app on macOS.'
    );
  }

  await exportLocalElectronHeadless(project, i18n, outputDir);
  await runNpm(['install', '--no-audit', '--no-fund'], outputDir, 240000);
  await runNpm(
    ['run', 'build', '--', '--mac', 'dmg', '--publish', 'never'],
    outputDir,
    300000
  );

  const dist = path.join(outputDir, 'dist');
  const images = fs
    .readdirSync(dist, { withFileTypes: true })
    .filter(
      entry => entry.isFile() && entry.name.toLowerCase().endsWith('.dmg')
    );
  if (images.length !== 1) {
    throw new Error(
      'Expected one DMG in ' + dist + ', found ' + images.length + '.'
    );
  }
  return path.join(dist, images[0].name);
};
