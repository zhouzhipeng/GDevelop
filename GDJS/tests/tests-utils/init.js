// @ts-check

// This file is called before all tests (but after GDJS is loaded).
// Disable a few logs that are too verbose:
gdjs.Logger.getDefaultConsoleLoggerOutput().discardGroup('Firebase (setup)');
gdjs.Logger.getDefaultConsoleLoggerOutput().discardGroup('RuntimeScene (setup warnings)');
gdjs.Logger.getDefaultConsoleLoggerOutput().discardGroup('Player Authentication');

gdjs.multiplayer.disableMultiplayerForTesting = true;

// Scene cleanup can use Physics3D even when only unrelated tests are selected.
before(function(done) {
  this.timeout(20000);
  gdjs.getAllAsynchronouslyLoadingLibraryPromise().then(() => done(), done);
});
