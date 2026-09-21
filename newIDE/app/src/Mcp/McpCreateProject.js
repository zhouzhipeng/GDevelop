// @flow
import optionalRequire from '../Utils/OptionalRequire';
import {
  createNewEmptyProject,
  ensureProjectHasDefaultScene,
  copyProjectTemplateFilesToLocalProjectFolder,
} from '../ProjectCreation/CreateProject';
import { onSaveProject } from '../ProjectsStorage/LocalFileStorageProvider/LocalProjectWriter';
import { MULTI_FILE_ENTRY_NAME } from '../ProjectsStorage/MultiFileProjectFormat';

const fs = optionalRequire('fs');
const path = optionalRequire('path');

// Create independently of editor state. Opening is a separate explicit tool
// call so an existing project's unsaved changes are never affected.
export const createLocalProject = async (args: Object): Promise<Object> => {
  if (!fs || !path) {
    throw new Error(
      'Creating a local project requires the GDevelop desktop app.'
    );
  }
  const directory = args.project_directory;
  if (
    typeof directory !== 'string' ||
    !directory.trim() ||
    !path.isAbsolute(directory)
  ) {
    throw new Error('project_directory must be an absolute local path.');
  }
  const name = args.project_name;
  if (typeof name !== 'string' || !name.trim()) {
    throw new Error('project_name must be a non-empty string.');
  }
  for (const key of ['width', 'height']) {
    if (
      args[key] !== undefined &&
      (!Number.isInteger(args[key]) || args[key] <= 0 || args[key] > 16384)
    ) {
      throw new Error(`${key} must be an integer between 1 and 16384.`);
    }
  }
  const projectDirectory = path.normalize(directory);
  // Non-recursive mkdir atomically reserves a new directory and refuses even
  // empty existing directories and symlinks. The parent must already exist.
  fs.mkdirSync(projectDirectory);
  const projectFile = path.join(projectDirectory, MULTI_FILE_ENTRY_NAME);
  let project = null;
  try {
    project = createNewEmptyProject({ creationSource: 'ai-agent-request' })
      .project;
    if (!project) throw new Error('Unable to create the empty project.');
    project.resetProjectUuid();
    project.setName(name.trim());
    project.setVersion('1.0.0');
    project.setUseDeprecatedZeroAsDefaultStringVariable(false);
    project.setGameResolutionSize(args.width || 1280, args.height || 720);
    project.setProjectFile(projectFile);
    ensureProjectHasDefaultScene(project);
    await copyProjectTemplateFilesToLocalProjectFolder({
      projectFilePath: projectFile,
    });
    const result = await onSaveProject(
      project,
      { fileIdentifier: projectFile },
      { useBackgroundSerializer: false },
      {
        showAlert: async () => {},
        showConfirmation: async () => false,
      }
    );
    if (!result.wasSaved)
      throw new Error('The new project could not be saved.');
    return {
      success: true,
      created: true,
      opened: false,
      projectFile,
      projectName: project.getName(),
      sceneNames: ['Game'],
      nextAction:
        'Call open_project with project_path set to projectFile, then read the bundled skills/gdevelop-project-files/SKILL.md and generated catalogs before editing sources.',
    };
  } catch (error) {
    // Preserve partial files for diagnosis; never remove a caller's directory.
    throw new Error(
      `Project creation failed in "${projectDirectory}". Partial files may remain: ${error.message ||
        String(error)}`
    );
  } finally {
    if (project) project.delete();
  }
};
