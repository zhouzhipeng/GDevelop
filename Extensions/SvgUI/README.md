# SVG UI

`SvgUI::SvgUIObject` renders an SVG document as native browser SVG in the game's
DOM overlay. Add an **SVG UI** object, choose an `.svg` image resource and set its
width and height. The scene editor displays an image preview; the game preserves
interactive vector nodes. `examples/hud.svg` is a ready-to-import sample.

Use stable, unique IDs in each SVG, then add object actions/conditions:

- **Set node text**: `score-text`, `"Score: " + ToString(Score)`.
- **Set node fill color**: `health-fill`, `"0;255;0"` (or a hex color).
- **Set node width**: `health-fill`, `280 * Health / MaxHealth` (SVG units).
- **Set node visibility**: `start-button`, yes/no.
- **SVG node clicked**: `start-button`, then change scene or run other actions.
- **SVG loaded** / **SVG loading failed**: manage asynchronous loading states.

Text actions apply to `<text>` and `<tspan>`. Clicks on descendants also activate
ancestor group IDs, remain true for all conditions in one event frame, and are
cleared before the next frame. Actions issued before loading finishes are applied
when the SVG arrives. Replacing the source resource resets these node overrides.

The overlay follows object position, size, center rotation, camera transforms,
canvas scaling, visibility and opacity. Pausing a scene hides its UI and retains
node changes; resuming restores it. Deleting an object aborts pending loading and
removes its DOM. SVG IDs and local references are isolated per instance.

## First-version boundaries

- The entire UI is above the game canvas. Object Z order applies within the DOM
  overlay; it cannot interleave with Pixi objects or follow layer rendering order.
- SVG `viewBox` and `preserveAspectRatio` determine internal scaling. Use normal
  object positioning/resizing (and anchoring behaviors) for screen layouts.
- Supports vector shapes, groups, text, gradients, clip paths, masks, patterns and
  local `<use>` references. Prefer presentation attributes or inline SVG styles.
- Scripts, event handler attributes, `foreignObject`, external images/fonts,
  embedded stylesheets, filters and animation elements are excluded. Convert
  unsupported assets before importing. Use installed/system fonts for text.
- The UI rectangle receives pointer input and stops propagation to the game's
  DOM container. It is intended for HUDs and menus, not world collision objects.
- Pixi effects, lighting and render-texture capture do not apply to the DOM UI.
- Runtime browser coverage currently uses ChromeHeadless; packaged mobile and
  desktop exports still need platform smoke testing.

After changing this extension, run from `newIDE/app`:

```sh
node scripts/import-GDJS-Runtime.js --skip-clean --skip-sources
```

Reload the editor to discover the new object. The web loader also registers it
explicitly in `BrowserJsExtensionsLoader.js`.
