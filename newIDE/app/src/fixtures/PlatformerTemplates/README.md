# Official Platformer regression fixtures

Unmodified native JSON downloads captured on 2026-10-26, compressed with gzip
(mtime 0). They intentionally retain obsolete custom properties, wrapped
behaviors and invalid unused ambient channels to exercise the real URL import
boundary. Tests must normalize them through the production importer, not edit
the fixtures to satisfy the GDevelop Language (GDL) schema.

- `platformer.json.gz`: https://resources.gdevelop-app.com/examples/platformer/platformer.json
- `starting-3D-platformer.json.gz`: https://resources.gdevelop-app.com/examples/starting-3D-platformer/starting-3D-platformer.json
- `starting-platformer.json.gz`: https://resources.gdevelop-app.com/examples/starting-platformer/starting-platformer.json

The official GDevelop example registry lists these templates under the MIT
license. Attribution: GDevelop and the template/extension contributors identified
in the project data. No resource images or audio are bundled here.

`LocalFileStorageProvider/PlatformerTemplates.spec.js` loads the real engine and
extensions, saves each complete project, opens it again, saves it a second time,
and compares the resulting authored data. These tests run offline by default.

The 3D fixture also covers a deprecated directional-light parameter that must
remain typed and lossless, and fractional texture tiling whose native default
is integral.
