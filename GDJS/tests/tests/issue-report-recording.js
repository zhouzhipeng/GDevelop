describe('gdjs.AbstractDebuggerClient issue report recording', function () {
  let canvas, client, messages;
  beforeEach(function () {
    canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;
    document.body.appendChild(canvas);
    messages = [];
    client = Object.create(gdjs.AbstractDebuggerClient.prototype);
    client._issueRecording = null;
    client._issueAnnotationLayer = null;
    client._sendMessage = (message) => messages.push(JSON.parse(message));
    client._runtimegame = {
      pause: sinon.spy(),
      getRenderer: () => ({ getCanvas: () => canvas }),
      getSceneStack: () => ({
        renderWithoutStep: () => {
          const context = canvas.getContext('2d');
          context.fillStyle = 'blue';
          context.fillRect(0, 0, 320, 180);
          return true;
        },
      }),
    };
    client.startIssueAnnotation();
  });
  afterEach(function () {
    client.stopIssueAnnotation();
    canvas.remove();
  });
  it('records playable WebM and timed inputs without blocking game input', async function () {
    client.startIssueRecording(1);
    expect(messages[messages.length - 1].command).to.be(
      'issueReport.recordingStarted'
    );
    expect(messages[messages.length - 1].payload.success).to.be(true);
    expect(client._runtimegame.pause.lastCall.args[0]).to.be(false);
    expect(
      document.querySelector('canvas[data-gdevelop-issue-annotation="true"]')
    ).to.be(null);
    const key = new KeyboardEvent('keydown', {
      code: 'KeyA',
      bubbles: true,
      cancelable: true,
    });
    canvas.dispatchEvent(key);
    expect(key.defaultPrevented).to.be(false);
    canvas.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 20,
        clientY: 30,
        pointerType: 'touch',
        pointerId: 7,
        bubbles: true,
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 200));
    await client.stopIssueRecording(2);
    const result = messages.find((message) => message.messageId === 2);
    expect(result.payload.success).to.be(true);
    expect(result.payload.dataUrl.indexOf('data:video/webm;base64,')).to.be(0);
    expect(
      result.payload.inputs.some(
        (event) => event.code === 'KeyA' && event.timeMs >= 0
      )
    ).to.be(true);
    expect(
      result.payload.inputs.some(
        (event) => event.pointerType === 'touch' && event.pointerId === 7
      )
    ).to.be(true);
    expect(client._runtimegame.pause.lastCall.args[0]).to.be(true);
    expect(
      !!document.querySelector('canvas[data-gdevelop-issue-annotation="true"]')
    ).to.be(true);
    const count = result.payload.inputs.length;
    canvas.dispatchEvent(
      new KeyboardEvent('keyup', { code: 'KeyA', bubbles: true })
    );
    await client.stopIssueRecording(3);
    expect(
      messages.find((message) => message.messageId === 3).payload.inputs.length
    ).to.be(count);
    const video = document.createElement('video');
    await new Promise((resolve, reject) => {
      video.onloadeddata = resolve;
      video.onerror = reject;
      video.src = result.payload.dataUrl;
    });
    expect(video.videoWidth).to.be(320);
    expect(video.videoHeight).to.be(180);
    video.removeAttribute('src');
    video.load();
  });
  it('automatically stops at the deadline and can record again', async function () {
    let stopAtDeadline;
    const originalSetTimeout = window.setTimeout;
    const stub = sinon
      .stub(window, 'setTimeout')
      .callsFake((callback, delay) => {
        if (delay === 60000) {
          stopAtDeadline = callback;
          return 0;
        }
        return originalSetTimeout(callback, delay);
      });
    try {
      client.startIssueRecording(1);
    } finally {
      stub.restore();
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
    stopAtDeadline();
    await client.stopIssueRecording(2);
    expect(
      messages.some(
        (message) => message.command === 'issueReport.recordingEnded'
      )
    ).to.be(true);
    expect(client._runtimegame.pause.lastCall.args[0]).to.be(true);
    client.startIssueRecording(3);
    expect(
      messages.find((message) => message.messageId === 3).payload.success
    ).to.be(true);
    expect(client._runtimegame.pause.lastCall.args[0]).to.be(false);
  });
  it('keeps the paused annotation session when video encoding is unsupported', function () {
    const recorder = window.MediaRecorder;
    window.MediaRecorder = undefined;
    try {
      client.startIssueRecording(1);
    } finally {
      window.MediaRecorder = recorder;
    }
    expect(
      messages.find((message) => message.messageId === 1).payload.success
    ).to.be(false);
    expect(client._runtimegame.pause.lastCall.args[0]).to.be(true);
    expect(
      !!document.querySelector('canvas[data-gdevelop-issue-annotation="true"]')
    ).to.be(true);
  });
  it('cancels recording without recreating an annotation layer', async function () {
    client.startIssueRecording(1);
    await new Promise((resolve) => setTimeout(resolve, 100));
    client.stopIssueAnnotation();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(client._issueRecording).to.be(null);
    expect(
      document.querySelector('canvas[data-gdevelop-issue-annotation="true"]')
    ).to.be(null);
    expect(
      messages.some(
        (message) => message.command === 'issueReport.recordingEnded'
      )
    ).to.be(false);
  });
});
