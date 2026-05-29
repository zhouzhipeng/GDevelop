const getElectronAppCommandLineArguments = (
  processArgv,
  { isDev, isDefaultApp }
) => {
  // When the app is launched with the Electron binary (`electron app`), the
  // app folder is present in argv even if ELECTRON_IS_DEV forces production
  // mode for the renderer.
  const electronAppPathArgumentCount = isDev || isDefaultApp ? 2 : 1;
  return processArgv.slice(electronAppPathArgumentCount);
};

module.exports = {
  getElectronAppCommandLineArguments,
};
