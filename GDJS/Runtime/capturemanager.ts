/*
 * GDevelop JS Platform
 * Copyright 2013-2016 Florian Rival (Florian.Rival@gmail.com). All rights reserved.
 * This project is released under the MIT License.
 */
namespace gdjs {
  /**
   * @category Core Engine > Captures
   */
  export type CaptureOptions = {
    screenshots?: Array<{
      delayTimeInSeconds: number;
      signedUrl: string;
      publicUrl: string;
    }>;
  };

  /**
   * Helper function to convert a base64 string to a Blob, which can be uploaded to a server.
   */
  const base64ToBlob = (base64) => {
    const byteString = atob(base64.split(',')[1]);
    const mimeString = base64.split(',')[0].split(':')[1].split(';')[0];

    const arrayBuffer = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
      arrayBuffer[i] = byteString.charCodeAt(i);
    }

    return new Blob([arrayBuffer], { type: mimeString });
  };

  /**
   * Manage the screenshots that need to be taken during the game.
   * @category Core Engine > Captures
   */
  export class CaptureManager {
    _game: gdjs.RuntimeGame;
    _captureOptions: CaptureOptions;

    constructor(game: gdjs.RuntimeGame, captureOptions: CaptureOptions) {
      this._game = game;
      this._captureOptions = captureOptions;
    }

    /**
     * To be called when the scene has started rendering.
     */
    setupCaptureOptions(isPreview: boolean): void {
      if (!isPreview) {
        return;
      }

      if (this._captureOptions.screenshots) {
        for (const screenshotCaptureOption of this._captureOptions
          .screenshots) {
          setTimeout(async () => {
            await this.takeAndUploadScreenshot(
              screenshotCaptureOption.signedUrl
            );
          }, screenshotCaptureOption.delayTimeInSeconds);
        }
      }
    }

    /**
     * Take a screenshot and upload it to the server.
     */
    async takeAndUploadScreenshot(signedUrl: string) {
      const canvas = this._game.getRenderer().getCanvas();
      if (canvas) {
        try {
          const base64Data = canvas.toDataURL('image/png');
          const blobData = base64ToBlob(base64Data);

          await fetch(signedUrl, {
            method: 'PUT',
            body: blobData,
            headers: {
              'Content-Type': 'image/png',
            },
          });
        } catch (error) {
          console.error('Error while uploading screenshot:', error);
        }
      }
    }
  }
}
