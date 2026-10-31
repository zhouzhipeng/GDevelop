// @flow
import { SceneTreeViewItemContent } from './SceneTreeViewItemContent';

const gd = global.gd;

jest.mock('.', () => ({ scenesRootFolderId: 'scenes-root' }));

describe('SceneTreeViewItemContent', () => {
  it('opens scene variables from the scene context menu', () => {
    const onOpenLayoutVariables = jest.fn();
    const project = gd.ProjectHelper.createNewGDJSProject();
    const layout = project.insertNewLayout('Game', 0);
    const content = new SceneTreeViewItemContent(
      layout,
      project.getLayoutsRootFolder().getItemNamed('Game'),
      (({ onOpenLayoutVariables, project }: any): any)
    );
    const i18n: any = { _: message => message };

    const variablesMenuItem: any = content.buildMenuTemplate(i18n, 0)[4];
    variablesMenuItem.click();

    expect(onOpenLayoutVariables).toHaveBeenCalledWith(layout);
  });
});
