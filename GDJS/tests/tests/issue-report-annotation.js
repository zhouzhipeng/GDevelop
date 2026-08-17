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

  const hasRedPixel = (pixels) => {
    for (let index = 0; index < pixels.length; index += 4) {
      if (
        pixels[index] > 200 &&
        pixels[index + 1] < 100 &&
        pixels[index + 2] < 150
      ) {
        return true;
      }
    }
    return false;
  };

  afterEach(function () {
    document.querySelectorAll(overlaySelector).forEach((canvas) => {
      canvas.remove();
    });
  });

  it('requests an issue report after two quick unmodified R presses', function () {
    const messages = [];
    const client = Object.create(gdjs.AbstractDebuggerClient.prototype);
    client._lastReportIssueShortcutPressTime = null;
    client._sendMessage = (message) => messages.push(JSON.parse(message));
    const makeEvent = (timeStamp, overrides = {}) => ({
      code: 'KeyR',
      timeStamp,
      repeat: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      target: document.body,
      ...overrides,
    });

    client._handleReportIssueShortcutKeyDown(makeEvent(100));
    client._handleReportIssueShortcutKeyDown(makeEvent(550));
    expect(messages.length).to.be(1);
    expect(messages[0].command).to.be('issueReport.shortcut');

    client._handleReportIssueShortcutKeyDown(makeEvent(1000));
    client._handleReportIssueShortcutKeyDown(makeEvent(1600));
    client._handleReportIssueShortcutKeyDown(
      makeEvent(1650, { ctrlKey: true })
    );
    client._handleReportIssueShortcutKeyDown(makeEvent(1700));
    expect(messages.length).to.be(1);
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
      expect(hasRedPixel(annotatedPixels)).to.be(true);

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

  it('draws rectangles and arrows with the selected annotation tool', async function () {
    const gameCanvas = document.createElement('canvas');
    gameCanvas.width = 120;
    gameCanvas.height = 80;
    gameCanvas.getBoundingClientRect = () => ({
      bottom: 80,
      height: 80,
      left: 0,
      right: 120,
      top: 0,
      width: 120,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    const gameContext = gameCanvas.getContext('2d');
    gameContext.fillStyle = '#000000';
    gameContext.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
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
      client.setIssueAnnotationTool('rectangle', 2);
      expect(messages[messages.length - 1].command).to.be(
        'issueReport.annotationToolChanged'
      );
      expect(messages[messages.length - 1].payload.tool).to.be('rectangle');

      const overlayCanvas = document.querySelector(overlaySelector);
      dispatchPointerEvent(overlayCanvas, 'pointerdown', 15, 10);
      dispatchPointerEvent(overlayCanvas, 'pointermove', 65, 40);
      dispatchPointerEvent(overlayCanvas, 'pointerup', 65, 40);

      client.setIssueAnnotationTool('arrow', 3);
      dispatchPointerEvent(overlayCanvas, 'pointerdown', 20, 65);
      dispatchPointerEvent(overlayCanvas, 'pointermove', 100, 65);
      dispatchPointerEvent(overlayCanvas, 'pointerup', 100, 65);

      client.sendAnnotatedIssueScreenshot(4);
      const screenshotMessage = messages[messages.length - 1];
      expect(screenshotMessage.payload.strokeCount).to.be(2);
      expect(screenshotMessage.payload.pointCount).to.be(4);

      const image = await loadImage(screenshotMessage.payload.dataUrl);
      const verificationCanvas = document.createElement('canvas');
      verificationCanvas.width = 120;
      verificationCanvas.height = 80;
      const verificationContext = verificationCanvas.getContext('2d');
      verificationContext.drawImage(image, 0, 0);
      expect(
        hasRedPixel(verificationContext.getImageData(10, 5, 12, 12).data)
      ).to.be(true);
      expect(
        hasRedPixel(verificationContext.getImageData(92, 57, 16, 16).data)
      ).to.be(true);
      expect(
        hasRedPixel(verificationContext.getImageData(35, 20, 10, 10).data)
      ).to.be(false);

      client.undoIssueAnnotation(5);
      expect(messages[messages.length - 1].payload.strokeCount).to.be(1);
      expect(messages[messages.length - 1].payload.pointCount).to.be(2);

      client.setIssueAnnotationTool('ellipse', 6);
      expect(messages[messages.length - 1].payload.success).to.be(false);
      expect(messages[messages.length - 1].payload.tool).to.be('arrow');
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
