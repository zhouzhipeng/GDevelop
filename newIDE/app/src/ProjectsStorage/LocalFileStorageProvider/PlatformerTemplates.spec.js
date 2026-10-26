// @noflow
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { gunzipSync } from 'zlib';
import { getLegacyProjectFirstDifferenceDescription } from '../MultiFileProjectFormat';
import { openMultiFileProject } from './LocalMultiFileProject';
import { onSaveProject } from './LocalProjectWriter';
import {
  mergeProjectInstructionCatalogs,
  normalizeLegacyProjectInstructionParameters,
} from '../SettingsDsl/InstructionCatalog';
import { normalizeDownloadedProject } from '../UrlStorageProvider/NormalizeDownloadedProject';
import {
  reloadProjectEventsFunctionsExtensionMetadata,
  unloadProjectEventsFunctionsExtension,
} from '../../EventsFunctionsExtensionsLoader';
import {
  serializeToJSObject,
  unserializeFromJSObject,
} from '../../Utils/Serializer';

describe('Official Platformer template creation', () => {
  let temporaryDirectory;
  beforeEach(() => {
    temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'gdevelop-template-')
    );
  });
  afterEach(() => fs.removeSync(temporaryDirectory));
  test.each(['platformer', 'starting-platformer', 'starting-3D-platformer'])(
    'imports, saves, reopens and saves the complete %s template',
    async slug => {
      const fixturePath = path.resolve(
        __dirname,
        '../../fixtures/PlatformerTemplates',
        `${slug}.json.gz`
      );
      const extensionsRoot = path.resolve(
        __dirname,
        '../../../../../Extensions'
      );
      fs.readdirSync(extensionsRoot).forEach(directory => {
        const modulePath = path.join(
          extensionsRoot,
          directory,
          'JsExtension.js'
        );
        if (!fs.existsSync(modulePath) || directory === 'ExampleJsExtension')
          return;
        const extensionModule = require(modulePath);
        const extension = extensionModule.createExtension(
          value => value,
          global.gd
        );
        global.gd.JsPlatform.get().addNewExtension(extension);
        extension.delete();
      });
      const project = global.gd.ProjectHelper.createNewGDJSProject();
      const extensionNames = [];
      const entryPath = path.join(temporaryDirectory, 'project.gdevelop');
      try {
        unserializeFromJSObject(
          project,
          normalizeDownloadedProject(
            JSON.parse(
              gunzipSync(fs.readFileSync(fixturePath)).toString('utf8')
            )
          )
        );
        for (
          let index = 0;
          index < project.getEventsFunctionsExtensionsCount();
          index++
        ) {
          extensionNames.push(
            project.getEventsFunctionsExtensionAt(index).getName()
          );
          reloadProjectEventsFunctionsExtensionMetadata(
            project,
            project.getEventsFunctionsExtensionAt(index),
            ({
              getIncludeFileFor: () => 'generated.js',
              writeFunctionCode: async () => {},
              writeBehaviorCode: async () => {},
              writeObjectCode: async () => {},
            }: any),
            ({
              _: value => (typeof value === 'string' ? value : value.id),
            }: any)
          );
        }
        const expected = { ...serializeToJSObject(project), constants: {} };
        await onSaveProject(project, { fileIdentifier: entryPath }, undefined, {
          showAlert: jest.fn(),
          showConfirmation: jest.fn(),
        });
        const reopened = await openMultiFileProject(entryPath);
        if (slug === 'starting-3D-platformer') {
          const layer = reopened.layouts[0].layers.find(
            layer => layer.name === ''
          );
          const light = layer.effects.find(
            effect => effect.effectType === 'Scene3D::DirectionalLight'
          );
          expect(light.doubleParameters.frustumSize).toBe(4000);
          expect(
            reopened.layouts[0].objects.find(object => object.name === 'Ground')
              .content.tileScale
          ).toBe(0.2);
        }
        // A second save catches registrations that were valid only during import.
        unserializeFromJSObject(project, reopened);
        await onSaveProject(project, { fileIdentifier: entryPath }, undefined, {
          showAlert: jest.fn(),
          showConfirmation: jest.fn(),
        });
        expect(
          getLegacyProjectFirstDifferenceDescription(
            reopened,
            await openMultiFileProject(entryPath)
          )
        ).toBe(null);
        const catalog = mergeProjectInstructionCatalogs(
          fs.readJsonSync(
            path.join(temporaryDirectory, '.gdevelop/instructions-catalog.json')
          ),
          fs.readJsonSync(
            path.join(
              temporaryDirectory,
              '.gdevelop/deprecated-instructions-catalog.json'
            )
          )
        );
        expect(
          getLegacyProjectFirstDifferenceDescription(
            normalizeLegacyProjectInstructionParameters(expected, catalog),
            reopened
          )
        ).toBe(null);
      } finally {
        extensionNames.forEach(name =>
          unloadProjectEventsFunctionsExtension(project, name)
        );
        project.delete();
      }
    },
    30000
  );
});
