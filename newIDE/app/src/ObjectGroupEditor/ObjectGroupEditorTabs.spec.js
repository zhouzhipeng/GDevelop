// @flow
import { objectGroupEditorTabs } from './ObjectGroupEditorTabs';

describe('ObjectGroupEditorTabs', () => {
  it('offers all object group configuration tabs', () => {
    expect(objectGroupEditorTabs).toEqual([
      'objects',
      'variables',
      'requiredBehaviors',
    ]);
  });
});
