// @flow
import { Trans } from '@lingui/macro';
import * as React from 'react';
import EmptyMessage from '../UI/EmptyMessage';
import Paper from '../UI/Paper';
import Text from '../UI/Text';
import { useResponsiveWindowSize } from '../UI/Responsive/ResponsiveWindowMeasurer';
import { ColumnStackLayout } from '../UI/Layout';
import {
  getGameVideoUrl,
  type PublicGame,
} from '../Utils/GDevelopServices/Game';

const videoWidth = 272;

type Props = {|
  publicGame: PublicGame,
|};

/**
 * The few seconds of gameplay shown on gd.games: recorded by the creator, or else
 * recorded automatically during previews.
 */
export const GameThumbnailVideo = ({ publicGame }: Props): React.Node => {
  const { isMobile, isLandscape } = useResponsiveWindowSize();
  const videoUrl = getGameVideoUrl(publicGame);
  // Full width on mobile, like the thumbnail displayed next to it.
  const isFullWidth = isMobile && !isLandscape;

  return (
    <ColumnStackLayout noMargin alignItems="center">
      <Paper
        style={{
          width: isFullWidth ? '100%' : videoWidth,
          aspectRatio: '16 / 9',
          overflow: 'hidden', // Keep the radius effect.
          display: 'flex',
        }}
        background="light"
      >
        {videoUrl ? (
          <video
            key={videoUrl}
            src={videoUrl}
            muted
            loop
            autoPlay
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          <EmptyMessage>
            <Trans>No video</Trans>
          </EmptyMessage>
        )}
      </Paper>
      {!publicGame.thumbnailVideoUrl && videoUrl && (
        <Text size="body-small" color="secondary" noMargin>
          <Trans>Recorded automatically during your previews.</Trans>
        </Text>
      )}
    </ColumnStackLayout>
  );
};
