// @noflow
import { validateSerializedProject } from './McpProjectTools';
import {
  reloadProjectEventsFunctionsExtensionMetadata,
  unloadProjectEventsFunctionsExtension,
  getProjectExtensionMetadataSnapshot,
} from '../EventsFunctionsExtensionsLoader';
import { serializeToJSObject } from '../Utils/Serializer';
import * as EventsValidationScanner from '../Utils/EventsValidationScanner';

const gd = global.gd;

describe('Validation metadata isolation', () => {
  test.each([false, true])(
    'preserves live extension include paths and generated metadata (validation throws: %s)',
    throws => {
      const project = gd.ProjectHelper.createNewGDJSProject();
      const name = 'LiveValidationMetadata';
      const platform = gd.JsPlatform.get();
      project.addPlatform(platform);
      const extension = project.insertNewEventsFunctionsExtension(name, 0);
      extension
        .getEventsFunctions()
        .insertNewEventsFunction('Run', 0)
        .setFunctionType(gd.EventsFunction.Action);
      extension.getEventsBasedObjects().insertNew('Panel', 0);
      extension.getEventsBasedBehaviors().insertNew('Motion', 0);
      project.insertNewLayout('Scene', 0);
      reloadProjectEventsFunctionsExtensionMetadata(
        project,
        extension,
        {
          getIncludeFileFor: namespace => `/actual/generated/${namespace}.js`,
          writeFunctionCode: async () => {},
          writeBehaviorCode: async () => {},
          writeObjectCode: async () => {},
        },
        { _: value => (typeof value === 'string' ? value : value.id) }
      );
      const actionType = `${name}::Run`;
      const actionMetadata = gd.MetadataProvider.getActionMetadata(
        platform,
        actionType
      );
      const originalFunctionName = actionMetadata.getFunctionName();
      const originalIncludes = actionMetadata.getIncludeFiles().toJSArray();
      const scan = jest.spyOn(
        EventsValidationScanner,
        'scanProjectForValidationErrors'
      );
      scan.mockImplementation(() => {
        // Validation must see its detached snapshot, not the live editor metadata.
        expect(
          gd.MetadataProvider.getActionMetadata(platform, actionType)
            .getIncludeFiles()
            .toJSArray()
        ).not.toEqual(originalIncludes);
        if (throws) throw new Error('Deliberate validation failure');
        return [];
      });
      try {
        const result = validateSerializedProject(
          serializeToJSObject(project),
          { include_generated_code: false },
          project
        );
        expect(result.valid).toBe(!throws);
        const restored = gd.MetadataProvider.getActionMetadata(
          platform,
          actionType
        );
        expect(restored.getFunctionName()).toBe(originalFunctionName);
        expect(restored.getIncludeFiles().toJSArray()).toEqual(
          originalIncludes
        );
        expect(
          gd.MetadataProvider.isBadObjectMetadata(
            gd.MetadataProvider.getObjectMetadata(platform, `${name}::Panel`)
          )
        ).toBe(false);
        expect(
          gd.MetadataProvider.isBadBehaviorMetadata(
            gd.MetadataProvider.getBehaviorMetadata(platform, `${name}::Motion`)
          )
        ).toBe(false);
      } finally {
        scan.mockRestore();
        unloadProjectEventsFunctionsExtension(project, name);
        project.delete();
      }
    }
  );
  test('releases retained metadata on replacement and unload', () => {
    const project = gd.ProjectHelper.createNewGDJSProject();
    const extension = project.insertNewEventsFunctionsExtension(
      'SnapshotOwnership',
      0
    );
    const writer = {
      getIncludeFileFor: name => `${name}.js`,
      writeFunctionCode: async () => {},
      writeBehaviorCode: async () => {},
      writeObjectCode: async () => {},
    };
    const i18n = { _: value => (typeof value === 'string' ? value : value.id) };
    try {
      reloadProjectEventsFunctionsExtensionMetadata(
        project,
        extension,
        writer,
        i18n
      );
      const first = getProjectExtensionMetadataSnapshot(
        project,
        'SnapshotOwnership'
      );
      expect(first).toBeTruthy();
      const releaseFirst = jest.spyOn(first, 'delete');
      reloadProjectEventsFunctionsExtensionMetadata(
        project,
        extension,
        writer,
        i18n
      );
      expect(releaseFirst).toHaveBeenCalledTimes(1);
      releaseFirst.mockRestore();
      const second = getProjectExtensionMetadataSnapshot(
        project,
        'SnapshotOwnership'
      );
      expect(second).not.toBe(first);
      const releaseSecond = jest.spyOn(second, 'delete');
      unloadProjectEventsFunctionsExtension(project, 'SnapshotOwnership');
      expect(releaseSecond).toHaveBeenCalledTimes(1);
      releaseSecond.mockRestore();
      expect(
        getProjectExtensionMetadataSnapshot(project, 'SnapshotOwnership')
      ).toBeNull();
    } finally {
      unloadProjectEventsFunctionsExtension(project, 'SnapshotOwnership');
      project.delete();
    }
  });
});
