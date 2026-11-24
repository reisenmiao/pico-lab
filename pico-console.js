(() => {
  const toggles = document.querySelectorAll('[data-action="console"]');
  let owner = 'example-pane';
  let port, session, failedPort, waitingMessage = '', buffer = '', timer;
  let visible = false, status = '', stopNotice = '';

  function publish(reveal = false) {
    clearTimeout(timer);
    timer = undefined;
    window.dispatchEvent(new CustomEvent('pico-console-output', {
      detail: { pane: owner, open: visible, status: stopNotice + status, text: buffer.replace(/\r\n?/g, '\n'), reveal }
    }));
  }
  function schedule() {
    if (visible && timer === undefined) timer = setTimeout(publish, 100);
  }
  function setStatus(message) {
    if (message === status) return;
    status = message;
    schedule();
  }

  function append(text) {
    if (!text) return;
    buffer += text;
    if (buffer.length > 262144) {
      let cut = buffer.indexOf('\n', buffer.length - 196608);
      if (cut < 0) cut = buffer.length - 196608;
      buffer = '[Earlier serial output discarded]\n' + buffer.slice(cut + 1);
    }
    schedule();
  }

  async function read(current) {
    let opened = false;
    const decoder = new TextDecoder();
    try {
      setStatus('Opening port…');
      await current.port.open({ baudRate: 115200 });
      opened = true;
      if (current.stopping) return;
      await current.port.setSignals({ dataTerminalReady: true });
      if (current.stopping) return;
      current.reader = current.port.readable.getReader();
      setStatus('Listening');
      while (!current.stopping) {
        const { value, done } = await current.reader.read();
        if (done || current.stopping) break;
        append(decoder.decode(value, { stream: true }));
      }
      if (!current.stopping) {
        append(decoder.decode());
        setStatus('Stream closed. Reopen the console to retry.');
      }
    } catch {
      if (!current.stopping) setStatus('Port unavailable. Close other serial monitors and reopen the console.');
    } finally {
      current.reader?.releaseLock();
      if (opened) {
        try { await current.port.close(); } catch { /* The board may have disconnected. */ }
      }
      if (!current.stopping) failedPort = current.port;
    }
  }

  function release() {
    if (!session) return;
    if (!session.stopping) {
      session.stopping = true;
      session.reader?.cancel().catch(() => {});
    }
    return session.done;
  }

  function reconcile() {
    const wanted = visible ? port : undefined;
    if (visible && !wanted) setStatus(waitingMessage);
    if (session) {
      if (session.port !== wanted) release();
      return;
    }
    if (!wanted) return;
    if (wanted === failedPort) return;
    session = { port: wanted, stopping: false };
    session.done = read(session).finally(() => {
      session = undefined;
      reconcile();
    });
  }
  function setOpen(open, pane = owner) {
    if (open === visible && pane === owner) return;
    owner = pane;
    visible = open;
    stopNotice = '';
    for (const toggle of toggles) toggle.setAttribute('aria-expanded', String(open && toggle.closest('.viewer-pane').id === owner));
    failedPort = undefined;
    reconcile();
    publish(open);
  }
  for (const toggle of toggles) {
    const pane = toggle.closest('.viewer-pane').id;
    toggle.onclick = () => setOpen(!visible || owner !== pane, pane);
  }
  window.picoConsole = {
    sync(selected, message) {
      if (selected !== port) failedPort = undefined;
      port = selected;
      waitingMessage = message;
      reconcile();
    },
    release,
    show: pane => setOpen(true, pane),
    clear() { buffer = ''; stopNotice = ''; publish(); },
    reportStopFailure() {
      stopNotice = 'Stop not confirmed. Hold BOOTSEL while reconnecting the Pico. ';
      publish(true);
    },
    hide: () => setOpen(false)
  };
})();
