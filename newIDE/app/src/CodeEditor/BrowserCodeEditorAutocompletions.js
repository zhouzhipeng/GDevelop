// @flow
import { buildRuntimeApiDeclaration } from '../ProjectsStorage/JavaScriptAuthoringApi';

export const setupAutocompletions = (monaco: any): Promise<void> => {
  monaco.languages.typescript.javascriptDefaults.addExtraLib(
    buildRuntimeApiDeclaration(),
    'gdevelop-runtime-api.d.ts'
  );
  return Promise.resolve();
};
