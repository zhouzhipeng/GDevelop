// @flow
import type { EventPath } from './EventPath';
import type { ValidationError } from './EventsValidationScanner';

const gd: libGDevelop = global.gd;

export type EventSourceLocation = {|
  locationType: 'scene' | 'external-events',
  locationName: string,
  eventPath: EventPath,
|};

// Validation uses an owned copy so local variables and parent conditions have
// exactly the same scope as inline events. Keep original source locations for
// diagnostics; never mutate the scene or fragment while expanding a Link.
export const expandEventsForValidation = ({
  project,
  events,
  sceneName,
  lifecycleFunctionName,
  externalEventsName,
}: {|
  project: gdProject,
  events: gdEventsList,
  sceneName: string,
  lifecycleFunctionName: string,
  externalEventsName?: ?string,
|}): {|
  events: gdEventsList,
  locations: Map<number, EventSourceLocation>,
  referencedFragments: Set<string>,
  errors: Array<ValidationError>,
|} => {
  const expanded = new gd.EventsList();
  const locations: Map<number, EventSourceLocation> = new Map();
  const referencedFragments: Set<string> = new Set();
  const errors: Array<ValidationError> = [];
  let expandedCount = 0;
  const role = lifecycleFunctionName || 'sceneUpdate';
  const rootLocation = externalEventsName
    ? { locationType: 'external-events', locationName: externalEventsName }
    : { locationType: 'scene', locationName: sceneName };

  const expand = (
    source: gdEventsList,
    destination: gdEventsList,
    location: {|
      locationType: 'scene' | 'external-events',
      locationName: string,
    |},
    parentPath: EventPath,
    active: Array<string>,
    first: number = 0,
    last: number = source.getEventsCount() - 1
  ): void => {
    for (let index = first; index <= last; index++) {
      const event = source.getEventAt(index);
      const eventPath = [...parentPath, index];
      const sourceLocation = { ...location, eventPath };
      if (++expandedCount > 100000) {
        throw new Error('Event Link expansion exceeds 100000 events.');
      }
      if (
        event.getType() === 'BuiltinCommonInstructions::Link' &&
        !event.isDisabled()
      ) {
        const link = gd.asLinkEvent(event);
        const target = link.getTarget();
        const external = project.hasExternalEventsNamed(target);
        const targetKey = `${external ? 'external-events' : 'scene'}:${target}`;
        const invalid = (message: string) =>
          errors.push({
            type: 'invalid-link',
            diagnosticCode: 'EVENT_LINK_INVALID',
            diagnosticMessage: message,
            isCondition: false,
            instructionType: 'BuiltinCommonInstructions::Link',
            instructionSentence: `Link ${target}`,
            ...sourceLocation,
            lifecycleFunctionName: role,
          });
        if (active.includes(targetKey)) {
          invalid(
            `Circular event Link: ${[...active, targetKey].join(' -> ')}`
          );
          continue;
        }
        if (!external && !project.hasLayoutNamed(target)) {
          invalid(`Event Link target does not exist: ${target}`);
          continue;
        }
        let linkedEvents = external
          ? project.getExternalEvents(target).getEvents()
          : project
              .getLayout(target)
              .getLifecycleEventsFunctions()
              .getByName(role)
              .getEvents();
        if (external) referencedFragments.add(target);
        const linkedLocation = {
          locationType: external ? 'external-events' : 'scene',
          locationName: target,
        };
        let linkedParentPath = [];
        if (link.getIncludeConfig() === 1) {
          let group = null;
          for (let i = 0; i < linkedEvents.getEventsCount(); i++) {
            const candidate = linkedEvents.getEventAt(i);
            if (
              candidate.getType() === 'BuiltinCommonInstructions::Group' &&
              gd.asGroupEvent(candidate).getName() === link.getEventsGroupName()
            ) {
              group = candidate;
              linkedParentPath = [i];
              break;
            }
          }
          if (!group) {
            invalid(
              `Event Link group does not exist: ${target} / ${link.getEventsGroupName()}`
            );
            continue;
          }
          linkedEvents = group.getSubEvents();
        }
        if (link.getIncludeConfig() === 2 && !linkedEvents.isEmpty()) {
          const first = link.getIncludeStart();
          const last = link.getIncludeEnd();
          if (first > last || last >= linkedEvents.getEventsCount()) {
            invalid(`Event Link range is outside ${target}.`);
            continue;
          }
          expand(
            linkedEvents,
            destination,
            linkedLocation,
            [],
            [...active, targetKey],
            first,
            last
          );
        } else {
          expand(linkedEvents, destination, linkedLocation, linkedParentPath, [
            ...active,
            targetKey,
          ]);
        }
        continue;
      }
      const copy = destination.insertEvent(event, destination.getEventsCount());
      locations.set(copy.ptr, sourceLocation);
      if (event.canHaveSubEvents() && !event.isDisabled()) {
        copy.getSubEvents().clear();
        expand(
          event.getSubEvents(),
          copy.getSubEvents(),
          location,
          eventPath,
          active
        );
      }
    }
  };

  try {
    expand(
      events,
      expanded,
      rootLocation,
      [],
      [`${rootLocation.locationType}:${rootLocation.locationName}`]
    );
    return { events: expanded, locations, referencedFragments, errors };
  } catch (error) {
    expanded.delete();
    throw error;
  }
};
