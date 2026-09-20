// @flow
import { expandEventsForValidation } from './ExpandEventsForValidation';

const gd: libGDevelop = global.gd;

describe('event Link validation expansion', () => {
  let project: gdProject;
  let scene: gdLayout;
  let fragment: gdExternalEvents;
  let link: gdLinkEvent;
  beforeEach(() => {
    project = gd.ProjectHelper.createNewGDJSProject();
    scene = project.insertNewLayout('Scene', 0);
    fragment = project.insertNewExternalEvents('Fragment', 0);
    link = gd.asLinkEvent(
      scene
        .getEvents()
        .insertNewEvent(project, 'BuiltinCommonInstructions::Link', 0)
    );
    link.setTarget('Fragment');
  });
  afterEach(() => project.delete());
  const expand = () =>
    expandEventsForValidation({
      project,
      events: scene.getEvents(),
      sceneName: 'Scene',
      lifecycleFunctionName: 'sceneUpdate',
    });

  it('preserves original group and range source paths', () => {
    const events = fragment.getEvents();
    events.insertNewEvent(project, 'BuiltinCommonInstructions::Standard', 0);
    const group = gd.asGroupEvent(
      events.insertNewEvent(project, 'BuiltinCommonInstructions::Group', 1)
    );
    group.setName('Selected');
    group
      .getSubEvents()
      .insertNewEvent(project, 'BuiltinCommonInstructions::Standard', 0);
    events.insertNewEvent(project, 'BuiltinCommonInstructions::Standard', 2);
    link.setIncludeEventsGroup('Selected');
    const grouped = expand();
    expect(grouped.errors).toEqual([]);
    expect(grouped.events.getEventsCount()).toBe(1);
    expect(grouped.locations.get(grouped.events.getEventAt(0).ptr)).toEqual({
      locationType: 'external-events',
      locationName: 'Fragment',
      eventPath: [1, 0],
    });
    grouped.events.delete();
    link.setIncludeStartAndEnd(2, 2);
    const ranged = expand();
    expect(ranged.errors).toEqual([]);
    expect(ranged.events.getEventsCount()).toBe(1);
    expect(
      ranged.locations.get(ranged.events.getEventAt(0).ptr).eventPath
    ).toEqual([2]);
    ranged.events.delete();
    expect(events.getEventsCount()).toBe(3);
    expect(group.getSubEvents().getEventsCount()).toBe(1);
  });

  it('treats empty bodies as no-ops but reports missing groups and invalid ranges', () => {
    const empty = expand();
    expect(empty.errors).toEqual([]);
    expect(empty.events.getEventsCount()).toBe(0);
    empty.events.delete();
    const other = project.insertNewLayout('Other', 1);
    other.getLifecycleEventsFunctions().removeByName('sceneUpdate');
    link.setTarget('Other');
    link.setIncludeEventsGroup('Missing');
    const missing = expand();
    expect(missing.errors).toEqual([
      expect.objectContaining({
        type: 'invalid-link',
        locationType: 'scene',
        locationName: 'Scene',
        eventPath: [0],
      }),
    ]);
    missing.events.delete();
    fragment
      .getEvents()
      .insertNewEvent(project, 'BuiltinCommonInstructions::Standard', 0);
    link.setTarget('Fragment');
    link.setIncludeStartAndEnd(1, 2);
    const invalidRange = expand();
    expect(invalidRange.errors).toHaveLength(1);
    invalidRange.events.delete();
  });

  it('does not diagnose Links inside disabled parent events', () => {
    scene.getEvents().clear();
    const parent = scene
      .getEvents()
      .insertNewEvent(project, 'BuiltinCommonInstructions::Standard', 0);
    parent.setDisabled(true);
    const missing = gd.asLinkEvent(
      parent
        .getSubEvents()
        .insertNewEvent(project, 'BuiltinCommonInstructions::Link', 0)
    );
    missing.setTarget('Missing');
    const expanded = expand();
    expect(expanded.errors).toEqual([]);
    expect(expanded.events.getEventAt(0).isDisabled()).toBe(true);
    expanded.events.delete();
  });
});
