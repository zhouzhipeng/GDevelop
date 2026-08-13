describe('gdjs.AbstractDebuggerClient issue report annotation', function () {
  const overlaySelector = 'canvas[data-gdevelop-issue-annotation="true"]';

  const dispatchPointerEvent = (canvas, type, clientX, clientY) => {
    canvas.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        button: 0,
        clientX,
        clientY,
        isPrimary: true,
        pointerId: 1,
        pointerType: 'mouse',
      })
    );
  };

  const loadImage = (source) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = source;
    });

  afterEach(function () {
    document.querySelectorAll(overlaySelector).forEach((canvas) => {
      canvas.remove();
    });
  });

  it('draws, captures, undoes, clears and removes an intrinsic-size overlay', async function () {
    const gameCanvas = document.createElement('canvas');
    gameCanvas.width = 100;
    gameCanvas.height = 50;
    gameCanvas.getBoundingClientRect = () => ({
      bottom: 120,
      height: 100,
      left: 10,
      right: 210,
      top: 20,
      width: 200,
      x: 10,
      y: 20,
      toJSON: () => {},
    });
    const gameContext = gameCanvas.getContext('2d');
    gameContext.fillStyle = '#000000';
    gameContext.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
    document.body.appendChild(gameCanvas);

    const messages = [];
    const renderWithoutStep = sinon.stub().returns(true);
    const client = Object.create(gdjs.AbstractDebuggerClient.prototype);
    client._runtimegame = {
      pause: sinon.spy(),
      getSceneStack: () => ({ renderWithoutStep }),
      getRenderer: () => ({ getCanvas: () => gameCanvas }),
    };
    client._issueAnnotationLayer = null;
    client._sendMessage = (message) => messages.push(JSON.parse(message));

    try {
      client.startIssueAnnotation(1);
      client.startIssueAnnotation(2);
      expect(document.querySelectorAll(overlaySelector).length).to.be(1);
      expect(messages[messages.length - 1].command).to.be(
        'issueReport.annotationStarted'
      );
      expect(messages[messages.length - 1].payload.success).to.be(true);

      const overlayCanvas = document.querySelector(overlaySelector);
      dispatchPointerEvent(overlayCanvas, 'pointerdown', 50, 40);
      dispatchPointerEvent(overlayCanvas, 'pointermove', 70, 50);
      dispatchPointerEvent(overlayCanvas, 'pointerup', 90, 60);

      client.sendAnnotatedIssueScreenshot(3);
      const screenshotMessage = messages[messages.length - 1];
      expect(screenshotMessage.command).to.be('issueReport.screenshot');
      expect(screenshotMessage.payload.success).to.be(true);
      expect(screenshotMessage.payload.width).to.be(100);
      expect(screenshotMessage.payload.height).to.be(50);
      expect(
        screenshotMessage.payload.dataUrl.indexOf('data:image/png;base64,')
      ).to.be(0);
      expect(renderWithoutStep.callCount).to.be(3);

      const image = await loadImage(screenshotMessage.payload.dataUrl);
      const verificationCanvas = document.createElement('canvas');
      verificationCanvas.width = 100;
      verificationCanvas.height = 50;
      const verificationContext = verificationCanvas.getContext('2d');
      verificationContext.drawImage(image, 0, 0);
      const annotatedPixels = verificationContext.getImageData(
        15,
        5,
        30,
        20
      ).data;
      let foundRedPixel = false;
      for (let index = 0; index < annotatedPixels.length; index += 4) {
        if (
          annotatedPixels[index] > 200 &&
          annotatedPixels[index + 1] < 100 &&
          annotatedPixels[index + 2] < 150
        ) {
          foundRedPixel = true;
          break;
        }
      }
      expect(foundRedPixel).to.be(true);

      client.undoIssueAnnotation(4);
      expect(messages[messages.length - 1].payload.strokeCount).to.be(0);
      client.clearIssueAnnotation(5);
      expect(messages[messages.length - 1].payload.pointCount).to.be(0);
      client.stopIssueAnnotation(6);
      expect(document.querySelector(overlaySelector)).to.be(null);
    } finally {
      client.stopIssueAnnotation();
      gameCanvas.remove();
    }
  });

  it('limits large captured screenshots to 1280 by 720', function () {
    const gameCanvas = document.createElement('canvas');
    gameCanvas.width = 2560;
    gameCanvas.height = 1440;
    gameCanvas.getBoundingClientRect = () => ({
      bottom: 720,
      height: 720,
      left: 0,
      right: 1280,
      top: 0,
      width: 1280,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    document.body.appendChild(gameCanvas);

    const messages = [];
    const client = Object.create(gdjs.AbstractDebuggerClient.prototype);
    client._runtimegame = {
      pause: sinon.spy(),
      getSceneStack: () => ({ renderWithoutStep: sinon.stub().returns(true) }),
      getRenderer: () => ({ getCanvas: () => gameCanvas }),
    };
    client._issueAnnotationLayer = null;
    client._sendMessage = (message) => messages.push(JSON.parse(message));

    try {
      client.startIssueAnnotation(1);
      client.sendAnnotatedIssueScreenshot(2);
      const screenshotMessage = messages[messages.length - 1];
      expect(screenshotMessage.payload.success).to.be(true);
      expect(screenshotMessage.payload.width).to.be(1280);
      expect(screenshotMessage.payload.height).to.be(720);
    } finally {
      client.stopIssueAnnotation();
      gameCanvas.remove();
    }
  });
});
