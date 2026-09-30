# GDevelop project

Open `project.gdevelop` in GDevelop and preview the project's first scene. Project creation generates the game entry, source manifests, initial scene and authoring catalogs; these are not static files in the bundled template.

Maintain this page as the current game entry point: add its name, controls and any engine requirements as development progresses. Keep older feature descriptions in `docs/history/` when needed.

- [Project structure](docs/PROJECT_STRUCTURE.md): source, asset and output boundaries.
- [Development documentation](docs/README.md): design and testing entry points.
- [Asset provenance](docs/ASSET_SOURCES.md): resource sources and licenses.
- [Project tools](tools/README.md): asset and maintenance workflows.
- [Verification artifacts](artifacts/README.md): reports and screenshots.

Follow [AGENTS.md](AGENTS.md) before editing the project. Runtime resources belong in `assets/`, editable art sources in `sources/`, and TSL material source in `materials/` when used. Scene, extension, object and gameplay-test paths follow the GDevelop file contract.
