// @flow

import * as React from 'react';
import { action } from '@storybook/addon-actions';

import paperDecorator from '../../PaperDecorator';
import { GameThumbnailVideo } from '../../../GameDashboard/GameThumbnailVideo';
import { GameThumbnail } from '../../../GameDashboard/GameThumbnail';
import { PublicGameProperties } from '../../../GameDashboard/PublicGameProperties';
import {
  game1,
  getPublicGameFromGame,
} from '../../../fixtures/GDevelopServicesTestData';

export default {
  title: 'GameDashboard/GameThumbnailVideo',
  component: GameThumbnailVideo,
  decorators: [paperDecorator],
};

const sampleVideoUrl =
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

export const NoVideo = (): React.Node => (
  <GameThumbnailVideo publicGame={getPublicGameFromGame(game1)} />
);

export const RecordedAutomatically = (): React.Node => (
  <GameThumbnailVideo
    publicGame={{
      ...getPublicGameFromGame(game1),
      previewVideoUrls: [sampleVideoUrl],
    }}
  />
);

export const RecordedByTheCreator = (): React.Node => (
  <GameThumbnailVideo
    publicGame={{
      ...getPublicGameFromGame(game1),
      thumbnailVideoUrl: sampleVideoUrl,
    }}
  />
);

const sampleThumbnailUrl =
  'https://resources.gdevelop-app.com/examples/platformer/thumbnail.png';

/** The video next to the thumbnail, in the "Edit details" dialog of the dashboard. */
export const InGameProperties = (): React.Node => (
  <PublicGameProperties
    gameId={game1.id}
    name={game1.gameName}
    setName={action('setName')}
    description={game1.description}
    setDescription={action('setDescription')}
    authorIds={[]}
    setAuthorIds={action('setAuthorIds')}
    setAuthorUsernames={action('setAuthorUsernames')}
    orientation="landscape"
    setOrientation={action('setOrientation')}
    displayThumbnail
    thumbnailUrl={sampleThumbnailUrl}
    publicGame={{
      ...getPublicGameFromGame(game1),
      previewVideoUrls: [sampleVideoUrl],
    }}
    onGameUpdated={action('onGameUpdated')}
  />
);

/** In the header of the dashboard: the video plays while the thumbnail is hovered. */
export const ThumbnailWithVideoOnHover = (): React.Node => (
  <GameThumbnail
    gameName={game1.gameName}
    thumbnailUrl={sampleThumbnailUrl}
    videoUrl={sampleVideoUrl}
  />
);
