// @flow

import * as React from 'react';
import {
  type LaunchCaptureOptions,
  type CaptureOptions,
} from '../ExportAndShare/PreviewLauncher.flow';
import {
  createGameResourceSignedUrls,
  updateGame,
} from '../Utils/GDevelopServices/Game';
import { type GamesList } from '../GameDashboard/UseGamesList';
import AuthenticatedUserContext from '../Profile/AuthenticatedUserContext';
import PreferencesContext from './Preferences/PreferencesContext';

export const TIME_BETWEEN_PREVIEW_SCREENSHOTS = 1000 * 60 * 3; // 3 minutes

const filterUploadedPublicUrls = async (
  publicUrls: Array<string>
): Promise<Array<string>> => {
  const uploadedPublicUrls = await Promise.all(
    publicUrls.map(
      async (publicUrl): Promise<string | null> => {
        const response = await fetch(publicUrl, { method: 'HEAD' });
        return response.ok ? publicUrl : null;
      }
    )
  );
  return uploadedPublicUrls.filter(Boolean);
};

const useCapturesManager = ({
  project,
  gamesList,
}: {
  project: ?gdProject,
  gamesList: GamesList,
}): {
  createCaptureOptionsForPreview: (
    launchCaptureOptions: ?LaunchCaptureOptions
  ) => Promise<CaptureOptions>,
  getHotReloadPreviewLaunchCaptureOptions: (
    gameId: string
  ) => LaunchCaptureOptions | void,
  onCaptureFinished: (captureOptions: CaptureOptions) => Promise<void>,
} => {
  const [
    lastPreviewScreenshotsTakenAt,
    setLastPreviewScreenshotsTakenAt,
  ] = React.useState<{ [projectUuid: string]: number }>({});
  const { getAuthorizationHeader, profile } = React.useContext(
    AuthenticatedUserContext
  );
  const preferences = React.useContext(PreferencesContext);

  const createCaptureOptionsForPreview = React.useCallback(
    async (
      launchCaptureOptions: ?LaunchCaptureOptions
    ): Promise<CaptureOptions> => {
      const captureOptions: CaptureOptions = {
        screenshots: [],
      };
      if (!launchCaptureOptions) return captureOptions;

      try {
        if (launchCaptureOptions.screenshots.length) {
          const screenshotOptions = launchCaptureOptions.screenshots;
          const response = await createGameResourceSignedUrls({
            uploadType: 'game-screenshot',
            files: screenshotOptions.map(screenshotOption => ({
              contentType: 'image/png',
            })),
          });
          const signedUrls = response.signedUrls;
          if (!signedUrls || signedUrls.length === 0) {
            throw new Error('No signed url returned');
          }

          captureOptions.screenshots = screenshotOptions
            .map((screenshotOption, index) => {
              const signedUrlInfo = signedUrls[index];
              if (!signedUrlInfo) {
                return null;
              }

              return {
                delayTimeInSeconds: screenshotOption.delayTimeInSeconds,
                signedUrl: signedUrlInfo.signedUrl,
                publicUrl: signedUrlInfo.publicUrl,
              };
            })
            .filter(Boolean);
        }
      } catch (error) {
        console.error(
          'Error caught while creating signed URLs for game resources. Skipping.',
          error
        );
      }

      return captureOptions;
    },
    []
  );

  const onCaptureFinished = React.useCallback(
    async (captureOptions: CaptureOptions) => {
      if (!project) return;
      const projectId = project.getProjectUuid();

      try {
        const uploadedScreenshotPublicUrls = await filterUploadedPublicUrls(
          captureOptions.screenshots.map(screenshot => screenshot.publicUrl)
        );
        if (!uploadedScreenshotPublicUrls.length) return;

        const game = gamesList.games
          ? gamesList.games.find(game => game.id === projectId)
          : null;

        setLastPreviewScreenshotsTakenAt(lastPreviewScreenshotsTakenAt => ({
          ...lastPreviewScreenshotsTakenAt,
          [projectId]: Date.now(),
        }));

        // The game is registered, let's update it.
        if (game && profile) {
          try {
            const updatedGame = await updateGame(
              getAuthorizationHeader,
              profile.id,
              game.id,
              {
                screenshotUrls: [
                  ...(game.screenshotUrls || []),
                  ...uploadedScreenshotPublicUrls,
                ],
              }
            );
            gamesList.onGameUpdated(updatedGame);
          } catch (error) {
            console.error(
              'Error while updating game with new captures:',
              error
            );
            // Do not throw.
          }
        }
      } catch (error) {
        console.error('Error while handling finished capture options:', error);
      }
    },
    [project, gamesList, getAuthorizationHeader, profile]
  );

  const getHotReloadPreviewLaunchCaptureOptions = React.useCallback(
    (gameId: string): LaunchCaptureOptions | void => {
      const shouldTakeScreenshotOnPreview =
        preferences.values.takeScreenshotOnPreview &&
        Date.now() >
          (lastPreviewScreenshotsTakenAt[gameId] || 0) +
            TIME_BETWEEN_PREVIEW_SCREENSHOTS;
      if (!shouldTakeScreenshotOnPreview) return undefined;

      const game = gamesList.games
        ? gamesList.games.find(game => game.id === gameId)
        : null;
      if (game && game.thumbnailUrl) return undefined;

      return { screenshots: [{ delayTimeInSeconds: 3000 }] };
    },
    [
      preferences.values.takeScreenshotOnPreview,
      lastPreviewScreenshotsTakenAt,
      gamesList.games,
    ]
  );

  return {
    createCaptureOptionsForPreview,
    onCaptureFinished,
    getHotReloadPreviewLaunchCaptureOptions,
  };
};

export default useCapturesManager;
