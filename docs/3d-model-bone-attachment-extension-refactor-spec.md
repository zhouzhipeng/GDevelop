# 3D model bone attachment extension refactor specification

## Status

Approved and implemented.

This document supersedes the placement and API ownership decisions
in `docs/3d-model-bone-attachments.md`. The transform, frame-order, failure,
bone-identity, and same-container contracts in that document remain unchanged
unless this specification explicitly replaces them.

This is intentionally a breaking refactor. Compatibility with the previously
implemented `Scene3D::Base3DBehavior` bone-attachment event API is out of scope.

## Problem

The current implementation puts the complete bone-attachment feature in the
mandatory `Scene3D` extension:

- `Scene3D::Base3DBehavior`, which is present on every 3D object, stores an
  optional attachment relationship and exposes all attachment actions,
  conditions, and expressions.
- `Scene3D::Base3DBehavior` unconditionally includes
  `Model3DBoneAttachmentManager.js`.
- Loading the manager registers two instance-container callbacks that execute
  for every relevant container frame, even when the project never creates a
  bone attachment.
- Every 3D model eagerly builds the public canonical-bone index and allocates
  bone-expression scratch values even when no bone feature queries the model.
- The generic 3D instruction list mixes base transforms with a specialized,
  stateful equipment/constraint system.

The feature has two distinct roles that should not share ownership:

1. A target 3D model owns a cloned GLTF hierarchy and can provide safe,
   renderer-private access to a posed bone transform.
2. An independently rendered 3D object may opt into a persistent transform
   constraint that follows one of those bones.

The first role belongs close to `Model3DRuntimeObject3DRenderer`. The second is
an optional feature and must not be a responsibility or runtime cost of every
object with `Scene3D::Base3DBehavior`.

## Goals

- Restore `Scene3D::Base3DBehavior` to a generic 3D transform capability with
  no bone-attachment state, lifecycle work, public attachment API, or manager
  include.
- Introduce an optional built-in JavaScript extension dedicated to 3D model
  bone attachments.
- Represent attachment support as a behavior explicitly added to the attached
  object.
- Continue allowing any rendered object with
  `Scene3D::Base3DBehavior`—including boxes, models, and 3D custom objects—to be
  the attachment.
- Continue requiring the bone-owning target to be a
  `Scene3D::Model3DObject`.
- Preserve the existing attachment transform, picking, lifecycle, frame-order,
  failure, custom-object, and hot-reload semantics for the new API.
- Include attachment runtime code and register synchronization callbacks only
  in projects that contain the new behavior.
- Avoid eager canonical-bone indexing and attachment-only scratch allocations
  for models that never receive a bone query.
- Keep direct Three.js objects private to the model renderer.

## Non-goals

- Preserving, aliasing, or migrating the old
  `Scene3D::Base3DBehavior::{AttachToModelBone,...}` instruction identifiers.
- Automatically adding the new behavior to objects referenced by old events.
- Loading old projects containing the removed attachment instructions without
  validation or code-generation errors.
- Moving generic 3D transforms, model animation playback, shared-animation rig
  support, or spring-bone renderer primitives out of `Extensions/3D`.
- Changing the attachment transform math, direct-parenting decision,
  same-container/same-layer rule, cycle handling, or multiplayer limitations.
- Adding serialization of live target pointers, bone names, or offsets to
  object/instance data.
- Supporting 2D attachments, arbitrary mesh nodes, named sockets, physics
  joints, or cross-container attachments.
- Removing the generic instance-container callback hooks from GDJS runtime.

## Current behavior

`Extensions/3D/JsExtension.js` declares attachment actions, conditions, and
expressions on the hidden `Base3DBehavior`. The behavior unconditionally adds
the manager runtime file to its include list.

`Extensions/3D/Base3DBehavior.ts` owns a nullable
`Model3DBoneAttachment`, forwards attachment API calls to the manager, and
detaches during behavior destruction.

`Extensions/3D/Model3DBoneAttachmentManager.ts` indexes records by
`Base3DBehavior`, registers the post-object-update and pre-object-render
callbacks at module load, and synchronizes attachment transforms.

`Extensions/3D/Model3DRuntimeObject3DRenderer.ts` owns the cloned model and
bone objects. It eagerly builds a canonical-name map when the model is rebuilt.
`Extensions/3D/Model3DRuntimeObject.ts` exposes safe wrappers and user-facing
model bone expressions.

## Proposed architecture

### New extension identity

Add a built-in JavaScript extension with these stable identifiers:

- Directory and extension namespace: `Model3DBoneAttachment`
- Display name: `3D model bone attachment`
- Behavior type:
  `Model3DBoneAttachment::Model3DBoneAttachmentBehavior`
- Default behavior name: `Model3DBoneAttachment`
- Runtime class: `gdjs.Model3DBoneAttachmentRuntimeBehavior`
- Instruction/expression group: `3D model bone attachment`

The extension is built in and available without a store installation, but its
runtime files are collected only when a project contains the behavior.

### Dependency on the generic 3D capability

The new behavior is not restricted to one concrete object type. Its editor
implementation declares a hidden `Behavior` property whose required type is
`Scene3D::Base3DBehavior`, following the existing required-capability pattern
used by 3D physics behaviors.

This gives the editor and object picker an authoritative compatibility rule:

- A 3D box can have the behavior.
- A 3D model can have the behavior.
- A 3D custom object exposing the base 3D capability can have the behavior.
- A 2D-only object cannot have the behavior.

Runtime validation still checks that the owner implements `Base3DHandler`, has
a rendered 3D root, and satisfies all existing layer/container requirements.

### Behavior responsibilities

`Model3DBoneAttachmentRuntimeBehavior` owns the optional runtime relationship:

```ts
type Model3DBoneAttachment = {
  target: gdjs.Model3DRuntimeObject;
  boneName: string;
  positionOffset: [number, number, number];
  rotationOffset: [number, number, number];
  isResolved: boolean;
  lastFailure: Model3DBoneAttachmentFailure | null;
};
```

It implements the attachment-facing actions, conditions, and expressions and
registers/unregisters itself with the manager. No attachment member or method
remains on `Base3DBehavior`.

Behavior activation has these semantics:

- Deactivation retains the relationship and offsets, freezes the object at its
  last synchronized transform, and makes `IsBoneAttachmentResolved` false.
- Reactivation immediately attempts synchronization and then resumes the two
  normal frame passes.
- Deactivation is intentional and does not emit an unresolved warning.
- Destroying or removing the behavior detaches it and releases all manager and
  target references while preserving the object's last transform.

The relationship remains runtime-only. The behavior's serialized content
contains only its required Base3D behavior reference; target, bone, offsets,
and resolution state are created by events and are not serialized.

### Manager responsibilities

Move the manager to:

`Extensions/Model3DBoneAttachment/Model3DBoneAttachmentManager.ts`

Change all indexes and records from `gdjs.Base3DBehavior` to
`gdjs.Model3DBoneAttachmentRuntimeBehavior`. Preserve the existing:

- per-scene manager ownership;
- per-instance-container record indexes;
- cached target-first topological order;
- owner and target destroy callbacks;
- immediate synchronization after attach and offset actions;
- post-object-update and pre-object-render synchronization;
- transactional reattachment validation;
- cycle rejection;
- rate-limited failure logging; and
- allocation reuse in frame hot paths.

The manager module registers the two generic container callbacks when it is
loaded. Since the module is included by the optional behavior rather than by
`Base3DBehavior`, projects without the behavior do not register attachment
callbacks.

No callback unregister/re-register mechanism is required in the first version.
Once a project contains the behavior, two callback invocations with a WeakMap
lookup are acceptable even before an attachment action creates a manager.

### Model renderer boundary

Keep renderer-private skeleton access in `Extensions/3D` because the model
renderer owns the cloned GLTF hierarchy and animation mixer. The supported
internal boundary remains value-based and does not expose `THREE.Bone`:

```ts
hasBone(boneName: string): boolean;
isBoneNameAmbiguous(boneName: string): boolean;
getBonePose(
  boneName: string,
  relativeTo: THREE.Object3D,
  result: gdjs.Model3DBonePose
): boolean;
```

The renderer must make the canonical bone index lazy:

- Model clone/rebuild invalidates the index without traversing the clone.
- The first call to `hasBone`, `isBoneNameAmbiguous`, `getBonePose`, or another
  existing internal consumer such as spring-bone binding builds it once.
- Repeated queries reuse the index until the model generation changes.
- A model rebuild discards old bone references before a new query can use
  them.
- Empty names, authored-name preference, and duplicate-name ambiguity keep the
  current contract.

Attachment-specific matrix/quaternion scratch values should also be allocated
lazily or grouped in a lazily created query scratch object. Existing
spring-bone scratch state is outside this refactor unless it shares the same
canonical index.

### Public model bone queries

Keep these target-model APIs in `Scene3D::Model3DObject`:

- `HasBone`
- `BoneX`, `BoneY`, and `BoneZ`
- `BoneRotationX`, `BoneRotationY`, and `BoneRotationZ`

They describe a capability of a 3D model rather than an attachment
relationship and can support other bone-driven features. Rename their editor
group from `Bone attachments` to `Bones`.

Make the expression pose, quaternion, and Euler scratch state in
`Model3DRuntimeObject` lazy so an ordinary model instance does not allocate it.
The warning rate-limiting string may remain a nullable field.

### Editor bone-name parameter

Keep the global `model3DBoneName` parameter value type and these editor files in
their current shared locations:

- `Model3DBoneNameField.js`
- `Model3DBoneNameFieldUtils.js`
- `Model3DBoneUtils.js`

The field is useful to any model-bone API. The new behavior's attach action
keeps the same parameter ordering—owner object, behavior, target model, bone
name—so the field can continue discovering the most recent target model
parameter without feature-specific branching.

## New event API

The new behavior declares the same user-visible attachment operations under
the new behavior namespace.

### Actions

- `AttachToModelBone`
- `DetachFromModelBone`
- `SetBoneAttachmentPositionOffset`
- `SetBoneAttachmentRotationOffset`

### Conditions

- `IsAttachedToModelBone`
- `IsBoneAttachmentResolved`

### String expressions

- `AttachedBoneName`

### Number expressions

- `BoneAttachmentOffsetX`
- `BoneAttachmentOffsetY`
- `BoneAttachmentOffsetZ`
- `BoneAttachmentRotationOffsetX`
- `BoneAttachmentRotationOffsetY`
- `BoneAttachmentRotationOffsetZ`

Names local to the new behavior remain familiar, but their fully qualified
serialized identifiers intentionally change from the old
`Scene3D::Base3DBehavior` identifiers.

The scoped behavior API preserves ordinary GDevelop object-picking semantics:
all picked attachment objects that own the behavior are processed, while the
target remains the selected `Model3DObject` pointer under the existing
single-target rules.

## Removed API and compatibility policy

Delete all attachment declarations and implementations from
`Scene3D::Base3DBehavior`, including:

- the attachment failure and state types;
- the nullable attachment member;
- attachment lifecycle cleanup;
- attachment actions, conditions, and expression methods;
- attachment instruction/expression metadata; and
- the unconditional manager include.

Do not add hidden aliases, prototype adapters, deserialization migration,
event rewriting, or automatic behavior insertion.

Projects authored against the old event identifiers must be manually updated:

1. Add `Model3DBoneAttachmentBehavior` to every attachment object.
2. Replace the old Base3D bone-attachment instructions with the corresponding
   new behavior instructions.

Because compatibility is explicitly excluded, an old event that is not
updated may be reported as an unknown instruction and may block preview/export
under the repository's strict validation rules.

The model-owned `HasBone` and bone transform expressions keep their existing
identifiers and do not require migration.

## Affected layers and files

### New files

- `Extensions/Model3DBoneAttachment/JsExtension.js`
- `Extensions/Model3DBoneAttachment/Model3DBoneAttachmentTypes.ts`
- `Extensions/Model3DBoneAttachment/Model3DBoneAttachmentRuntimeBehavior.ts`
- `Extensions/Model3DBoneAttachment/Model3DBoneAttachmentManager.ts`
- `Extensions/Model3DBoneAttachment/tests/Model3DBoneAttachment.spec.js`
- `newIDE/app/src/JsExtensionsLoader/Model3DBoneAttachmentJsExtension.spec.js`

Use the existing skeleton-bone icon assets rather than introducing a duplicate
icon.

### Modified files

- `Extensions/3D/Base3DBehavior.ts`
  - Remove all attachment types, state, methods, and lifecycle work.
- `Extensions/3D/JsExtension.js`
  - Remove the manager include and Base3D attachment metadata.
  - Keep model bone queries and rename their group to `Bones`.
- `Extensions/3D/Model3DRuntimeObject3DRenderer.ts`
  - Retain the internal bone adapter and make its index/query scratch lazy.
- `Extensions/3D/Model3DRuntimeObject.ts`
  - Retain model query wrappers and make expression scratch lazy.
- `GDJS/tests/karma.conf.js`
  - Load the moved manager/types/behavior in the focused runtime test order.
- `newIDE/app/src/JsExtensionsLoader/BrowserJsExtensionsLoader.js`
  - Register the new built-in extension declaration.
- `newIDE/app/src/JsExtensionsLoader/LocalJsExtensionsLoader.js`
  - Update the expected local built-in extension count.
- `docs/3d-model-bone-attachments.md`
  - Update ownership, API examples, implementation map, serialization notes,
    test plan, and rollout to the approved architecture.

The generic hooks already implemented in these files remain unchanged unless
tests expose an ordering bug:

- `GDJS/Runtime/gd.ts`
- `GDJS/Runtime/RuntimeInstanceContainer.ts`
- `GDJS/Runtime/CustomRuntimeObjectInstanceContainer.ts`
- `GDJS/Runtime/runtimescene.ts`

The existing editor parameter field and canonical-name utilities should need
only import/test adjustments if file moves affect their fixtures.

## Public API, data, and schema changes

- Removes the old Base3D attachment instruction and expression identifiers.
- Adds the new behavior type and new behavior-scoped instruction/expression
  identifiers.
- Adds one serialized behavior entry to objects that opt into attachment.
- Adds no target, bone, offset, manager, or live relationship data to project,
  object, instance, network, or save-state schemas.
- Keeps `model3DBoneName` and all model-owned bone query identifiers stable.
- Keeps the internal `Model3DBonePose` value contract, although its type may
  move to the new extension types file only if `Extensions/3D` has no compile
  dependency on that file. Prefer keeping a renderer-owned pose interface in
  `Extensions/3D` to avoid reversing the dependency direction.

The dependency direction must be:

```text
Model3DBoneAttachment
  -> Scene3D Base3D capability
  -> Scene3D Model3D bone pose adapter
  -> generic GDJS container hooks
```

`Extensions/3D` must not import or include the optional attachment extension.

## Performance requirements

A project containing 3D boxes or models but no
`Model3DBoneAttachmentBehavior` must:

- exclude the attachment types, behavior, and manager runtime files from the
  exported include set;
- register no attachment synchronization callbacks;
- allocate no attachment state on `Base3DBehavior`; and
- perform no canonical public-bone indexing until another bone consumer makes
  a query.

A project containing the behavior pays for:

- one small behavior instance per opted-in object;
- one manager only after an attachment operation needs it;
- two registered container callbacks;
- one cached record and pose result per active relationship; and
- one lazy canonical index per queried model generation.

Unchanged frames must continue to avoid GLTF traversal, object-list scans,
graph sorting, and per-frame temporary allocations.

## Error handling

Retain the current transactional and rate-limited failure policy:

- An invalid new attach request does not replace an existing valid
  relationship.
- Missing/ambiguous bones, layer changes, and renderer-parent mismatches freeze
  the last valid pose and mark the relationship unresolved.
- Target deletion permanently detaches.
- Owner or behavior destruction removes every manager record and callback.
- Repeated unresolved frames do not repeat the same warning.
- Behavior deactivation is a silent intentional suspension, not an error.

The behavior constructor and manager must guard runtime misuse even though the
editor restricts the behavior to objects with `Base3DBehavior`.

## Implementation sequence

1. Add the new extension declaration, required-Base3D behavior metadata, and
   declaration tests without removing the old implementation yet.
2. Move the attachment types, runtime behavior state/API, and manager into the
   new extension; update manager indexes to use the new behavior.
3. Move runtime attachment tests and make them construct the new behavior.
4. Remove all attachment code and the manager include from Base3D, then remove
   its attachment metadata from `Extensions/3D/JsExtension.js`.
5. Register the new extension in the browser/editor loader and update focused
   metadata tests.
6. Make the Model3D canonical index and expression/query scratch values lazy,
   retaining all existing bone identity and pose tests.
7. Update the original feature document and any examples to require the new
   behavior.
8. Run focused tests, GDJS type checking/build, relevant editor tests, and the
   runtime suite; then dispatch the required Windows desktop build/launch.

No intermediate compatibility state is a supported deliverable. The completed
change must contain only the new public attachment API.

## Test plan

### Extension declaration and export inclusion

- The loader exposes extension `Model3DBoneAttachment`.
- The behavior has the stable full type and declares a required
  `Scene3D::Base3DBehavior` dependency.
- The behavior can be added to every supported 3D object type and is rejected
  for a 2D-only object.
- The new action parameter order and target `Model3DObject` restriction are
  correct.
- `Scene3D::Base3DBehavior` contains none of the removed attachment metadata.
- A project with an ordinary 3D object and no attachment behavior does not
  collect any `Extensions/Model3DBoneAttachment/*.js` runtime include.
- A project containing the behavior collects the types, manager, and behavior
  exactly once and in dependency order.

### Runtime behavior and manager

Move and retain all applicable cases from the original runtime test plan,
including:

- named, empty, duplicate, and authored/sanitized bone names;
- animated translation/rotation and local offsets;
- non-uniform dimensions, reflection, shear removal, and flip invariants;
- scene and custom-object sibling attachments;
- transactional rejection for layer/container mismatch;
- temporary resolution loss and recovery;
- deletion, reattachment, hot reload, and renderer rebuild;
- multiple attachments, chains, self-links, and longer cycles;
- pre-events and pre-render ordering; and
- rate-limited warnings and allocation-free unchanged frames.

Add behavior-specific cases:

- A rigid 3D box can opt in and follow a model bone without owning a skeleton.
- Removing/destroying the behavior detaches and cleans manager state.
- Deactivation freezes the last pose without warning and makes resolution
  false.
- Reactivation immediately resolves when the target is valid.
- Objects without the behavior cannot select or execute the new scoped API.

### Lazy model bone access

- Loading or rebuilding a rigid model does not build the canonical bone index.
- The first model expression, attachment query, or spring-bone binding builds
  the index once.
- Repeated queries do not traverse the clone again.
- Rebuilding the model invalidates old bone references and the next query
  rebuilds once.
- Expression pose/quaternion/Euler scratch values are absent before the first
  public bone transform expression and reused afterward.

### Editor field

Retain the current canonical bone-name completion tests. Add a declaration
integration case proving that the new attach action resolves its target model
parameter and receives the same completions.

### Verification commands

At implementation completion, run at minimum:

```text
cd GDJS
npm run check-types
npm run build

cd tests
npm test -- --grep "3D model bone attachment"

cd ../../newIDE/app
npm test -- --watchAll=false \
  src/JsExtensionsLoader/Model3DBoneAttachmentJsExtension.spec.js \
  src/EventsSheet/ParameterFields/Model3DBoneNameField.spec.js \
  src/ResourcesList/ResourcePreview/Model3DBoneUtils.spec.js
```

Use the actual test runner's supported focused-test syntax if `--grep` is not
accepted, then run the broader affected runtime suite. After code changes pass,
start `python scripts/start-windows-app.py` as a detached background process,
as required by the repository workflow.

## Rollout

This refactor lands atomically as a breaking internal product update:

1. Merge the new extension and remove the old API in the same change.
2. Update repository examples and documentation in that change.
3. Do not advertise automatic migration or compatibility.
4. Validate representative manual projects after replacing old events and
   adding the new behavior.

If this feature is released externally before the refactor lands, compatibility
must be reconsidered in a new approved specification; it must not be added
silently during implementation of this one.

## Alternatives considered

### Keep the feature on Base3D and only make the manager include conditional

This would reduce bundle and callback overhead but would leave specialized
state and public API on every Base3D behavior. It does not establish the desired
ownership boundary and is rejected as the final architecture.

### Use extension-level global actions without a behavior

A global manager keyed by runtime object could avoid authoring a behavior, but
it weakens behavior-based object filtering and scoped picking, hides persistent
state from the object's declared capabilities, and complicates lifecycle and
activation semantics. The explicit behavior is preferred.

### Put a bone behavior on the target model

The attachment relationship controls the independent follower object, and one
target can have many heterogeneous followers. Target ownership would put
offsets and lifecycle state on the wrong side of the relation and is rejected.

### Move all bone access out of Scene3D

The model renderer owns the cloned bones and mixer. Moving direct bone access
would either expose private Three.js objects or invert the dependency from the
base 3D extension to an optional feature. A thin value-based model adapter stays
in Scene3D.

## Open questions

- A future `Model3DBoneTools` extension could own the public `HasBone` and bone
  transform expressions if the model API grows substantially. This refactor
  deliberately keeps their identifiers and ownership stable.
- Named non-bone sockets may later reuse the optional constraint manager, but
  must receive a separate identity and transform contract.
- Automatic old-event migration can be designed later if real external
  projects require it; it is explicitly excluded from this implementation.

None of these questions blocks the approved split.

## Acceptance criteria

- `Base3DBehavior.ts` and its metadata contain no attachment-specific code.
- A normal 3D-only project exports no attachment runtime file and registers no
  attachment callback.
- The new behavior is available only on objects satisfying the Base3D
  capability and its actions preserve existing picking semantics.
- All transform, frame-order, lifecycle, failure, custom-object, and chain
  behavior passes under the new extension.
- Model-owned bone queries remain functional and keep their current event
  identifiers.
- Canonical bone indexing is lazy and generation-safe.
- No old Base3D attachment instruction alias or automatic migration remains.
- Focused and broader affected tests pass, and the required desktop launcher is
  dispatched after implementation.
