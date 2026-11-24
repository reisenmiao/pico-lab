(() => {
  const get = id => document.getElementById(id);
  const panel = get('pico-panel'), button = get('detect'), reset = get('reset-bootsel');
  const choose = get('select-port'), state = get('pico-state'), status = get('usb-status');
  const serial = navigator.serial;
  let selected, hostPresent = false, bootsel = false, resetting = false;
  let waitingForDrive = false, serialPresent = false, notice = '';
  let resetPort, signalReset, driveTimer, reconnectTimer, revision = 0;

  function canRestart() {
    if (!selected || bootsel || resetting || waitingForDrive) return false;
    const info = selected.getInfo();
    return info.usbVendorId === 0x2e8a && [0x0009, 0x000a].includes(info.usbProductId);
  }
  function update() {
    const available = hostPresent || serialPresent || selected?.getInfo().usbVendorId === 0x2e8a;
    button.toggleAttribute('data-available', !!available);
    const transitioning = resetting || waitingForDrive;
    window.picoConsole.sync(!bootsel && !transitioning ? selected : undefined,
      bootsel ? 'BOOTSEL · waiting for serial' : transitioning ? 'Pico restarting…'
      : !serial ? 'Open in Edge or Chrome for USB serial.' : 'Select a serial port in Connect Pico.');
    const description = bootsel ? 'Pico in BOOTSEL mode' : transitioning ? 'Restarting Pico…'
      : selected ? 'Serial port connected' : available ? 'Pico detected' : 'No Pico detected';
    if (state.textContent !== description) state.textContent = description;
    choose.hidden = !serial || bootsel || transitioning;
    choose.textContent = selected ? 'Change serial port' : 'Connect serial port';
    reset.hidden = reset.disabled = !canRestart();
    for (const stop of document.querySelectorAll('[data-action="stop"]')) {
      stop.disabled = reset.disabled || get('run-sketch').disabled;
    }
    const message = bootsel || transitioning ? '' : notice ||
      (!serial ? 'Open the course in Edge or Chrome to connect a serial port.' : '');
    if (status.textContent !== message) status.textContent = message;
    status.hidden = !message;
  }
  button.onclick = () => { if (!panel.open) panel.showModal(); };

  function select(port) {
    selected = port;
    revision++;
    notice = '';
    update();
  }
  async function autoSelect() {
    if (!serial || selected || resetting || bootsel || waitingForDrive) return;
    const current = ++revision;
    try {
      const ports = await serial.getPorts();
      if (current !== revision || bootsel || resetting || waitingForDrive) return;
      const candidates = ports.filter(port => {
        const info = port.getInfo();
        return port.connected !== false && info.usbVendorId === 0x2e8a &&
          [0x0005, 0x0009, 0x000a].includes(info.usbProductId);
      });
      serialPresent = candidates.length > 0;
      if (candidates.length === 1) select(candidates[0]);
      else update();
    } catch { /* A board can still be selected with the chooser. */ }
  }
  choose.onclick = async () => {
    const current = ++revision;
    try {
      const port = await serial.requestPort();
      if (current === revision && !bootsel && !resetting) select(port);
    } catch (error) {
      if (error.name !== 'NotFoundError') notice = 'Could not open the port chooser. Try again in Edge or Chrome.';
      update();
    }
  };

  function reconnect() {
    clearTimeout(reconnectTimer);
    const deadline = Date.now() + 15000;
    async function check() {
      await autoSelect();
      if (!selected && !bootsel && Date.now() < deadline) reconnectTimer = setTimeout(check, 700);
    }
    check();
  }
  window.addEventListener('pico-presence', ({ detail }) => {
    const wasBootsel = bootsel;
    hostPresent = detail.present;
    bootsel = detail.bootsel;
    if (bootsel && !wasBootsel) {
      revision++;
      selected = undefined;
      serialPresent = waitingForDrive = false;
      notice = '';
      clearTimeout(driveTimer);
      clearTimeout(reconnectTimer);
      signalReset?.();
    }
    update();
    if (wasBootsel && !bootsel) reconnect();
  });

  async function restartInBootsel() {
    if (!canRestart()) return;
    resetPort = selected;
    resetting = true;
    revision++;
    notice = '';
    update();
    let timer, opened = false;
    const changed = new Promise(resolve => { signalReset = () => resolve(true); });
    const timeout = new Promise(resolve => { timer = setTimeout(() => resolve(false), 4000); });
    try {
      // A successful reset can make the port disappear during open().
      await window.picoConsole.release();
      try { await resetPort.open({ baudRate: 1200 }); opened = true; } catch { /* Check for the reboot below. */ }
      if (await Promise.race([changed, timeout])) {
        selected = undefined;
        serialPresent = false;
        waitingForDrive = !bootsel;
        if (waitingForDrive) driveTimer = setTimeout(() => {
          waitingForDrive = false;
          update();
          autoSelect();
        }, 8000);
      } else {
        notice = 'Reset was not detected. Hold BOOTSEL while reconnecting the Pico.';
      }
      return !notice;
    } finally {
      clearTimeout(timer);
      if (opened) {
        try { await resetPort.close(); } catch { /* A rebooted device has already disconnected. */ }
      }
      resetPort = signalReset = undefined;
      resetting = false;
      update();
    }
  }
  reset.onclick = restartInBootsel;
  for (const stop of document.querySelectorAll('[data-action="stop"]')) {
    stop.onclick = async () => {
      if (!canRestart()) return;
      window.picoConsole.show(stop.closest('.viewer-pane').id);
      if (!await restartInBootsel()) window.picoConsole.reportStopFailure();
    };
  }
  window.picoConnection = { canRestart, restartInBootsel };
  serial?.addEventListener('disconnect', event => {
    revision++;
    if (event.target === resetPort) signalReset?.();
    if (event.target === selected) selected = undefined;
    serialPresent = false;
    notice = '';
    update();
    autoSelect();
  });
  serial?.addEventListener('connect', () => { if (!waitingForDrive) autoSelect(); });
  window.addEventListener('pico-firmware-sent', reconnect);
  update();
  autoSelect();
})();
