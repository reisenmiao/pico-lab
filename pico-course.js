(() => {
  const get = id => document.getElementById(id);
  const track = get('track'), lesson = get('lesson'), material = get('material');
  const readingPositionKey = 'pico-course:reading-position';
  const sheet = get('sheet'), nav = document.querySelector('nav');
  const examplePane = get('example-pane'), guidePane = get('guide-pane');
  const guidePrevious = get('guide-prev'), guideNext = get('guide-next');
  const exampleButton = get('show-example');
  const exampleControl = get('example-control'), guideControl = get('guide-control');
  const exampleGrip = exampleControl.querySelector('.view-grip');
  const circuitPane = get('circuit-pane'), circuitControl = get('circuit-control');
  const circuitImage = get('circuit-image');
  const viewButtons = exampleControl.parentElement;
  const sweepControl = get('sweep-control');
  const sweepPane = examplePane.cloneNode(true);
  sweepPane.id = 'sweep-pane';
  sweepPane.setAttribute('aria-label', 'SG90 sweep code');
  for (const node of sweepPane.querySelectorAll('[id]')) node.id = 'sweep-' + node.id;
  for (const node of sweepPane.querySelectorAll('[aria-controls]')) {
    node.setAttribute('aria-controls', 'sweep-' + node.getAttribute('aria-controls'));
  }
  examplePane.after(sweepPane);
  const originalName = document.createElement('span');
  originalName.className = 'sheet-name';
  originalName.textContent = 'Potentiometer';
  originalName.hidden = true;
  const sweepName = originalName.cloneNode();
  sweepName.hidden = false;
  sweepName.textContent = 'SG90 sweep';
  get('sketch-tools').prepend(originalName);
  get('sweep-sketch-tools').prepend(sweepName);
  const viewControls = [exampleControl, guideControl, circuitControl, sweepControl];
  const paneFor = control => get(control.firstElementChild.getAttribute('aria-controls'));
  const viewer = examplePane.parentElement;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const papers = viewControls.map(control => paneFor(control).firstElementChild);
  sheet.addEventListener('load', () => {
    viewer.style.setProperty('--sheet-ratio', sheet.naturalWidth / sheet.naturalHeight);
    if (!guidePane.hidden) turnPage(sheet, guideDirection);
  });
  const names = ['Hello, LED!', 'Button-controlled LED', 'LED brightness with PWM', 'RGB LED', 'Custom buzzer tones', 'Analog input', 'Servo control with a potentiometer', 'Light-sensitive LED', 'Thermometer', 'LCD temperature display', 'Intruder alarm', 'RGB LED strip'];
  const piper = [names[0], names[1], 'Tilt switch and LED', names[10], names[7], 'Servo', names[11]];
  let data, base, labels, page, chapter, examples, sweepExample;
  let installedSource = '', runtimePresent = false;
  try { installedSource = sessionStorage.getItem('pico-course:installed-sketch') || ''; } catch {}
  function updateRunningChapter() {
    const running = runtimePresent && track.value === 'arduino' && installedSource
      ? Object.keys(data.examples).find(key => data.examples[key].some(file => file.file === installedSource))
      : undefined;
    for (const [i, button] of [...nav.children].entries()) {
      button.classList.toggle('running-chapter', String(i) === running);
    }
    get('chapter-number')?.classList.toggle('running-chapter', String(chapter) === running);
  }
  window.addEventListener('pico-firmware-sent', event => {
    installedSource = event.detail?.source || '';
    runtimePresent = false;
    try { sessionStorage.setItem('pico-course:installed-sketch', installedSource); } catch {}
    updateRunningChapter();
  });
  window.addEventListener('pico-presence', ({ detail }) => {
    const present = detail.present && !detail.bootsel;
    if (present === runtimePresent) return;
    runtimePresent = present;
    updateRunningChapter();
  });
  const layoutKey = 'pico-course:sheet-layout';
  const openSheets = new Set([guideControl, exampleControl]);
  function saveLayout() {
    const sheets = [...viewButtons.children].map(control => ({ id: control.id, open: openSheets.has(control) }));
    try { localStorage.setItem(layoutKey, JSON.stringify(sheets)); } catch { /* Keep the layout for this session. */ }
  }
  function restoreLayout() {
    let order = [guideControl, exampleControl, circuitControl, sweepControl];
    try {
      const sheets = JSON.parse(localStorage.getItem(layoutKey));
      if (Array.isArray(sheets) && (sheets.length === viewControls.length || (sheets.length === 3 && sheets.every(sheet => sheet?.id !== sweepControl.id))) &&
          sheets.every(sheet => sheet && typeof sheet.open === 'boolean' && viewControls.some(control => control.id === sheet.id)) &&
          new Set(sheets.map(sheet => sheet.id)).size === sheets.length && sheets.some(sheet => sheet.open)) {
        order = sheets.map(sheet => get(sheet.id));
        if (!order.includes(sweepControl)) order.push(sweepControl);
        openSheets.clear();
        sheets.forEach((sheet, i) => { if (sheet.open) openSheets.add(order[i]); });
      }
    } catch { /* Use the default layout when storage is unavailable. */ }
    viewButtons.append(...order);
    viewer.append(...order.map(paneFor));
  }
  // Figures follow each track's guide, including its setup pinout at index zero.
  const circuits = {
    arduino: ['pinout', 'arduino-led', 'arduino-button-led', 'arduino-pwm-led', 'arduino-rgb-led', 'arduino-buzzer', 'arduino-analog-input', 'arduino-servo-potentiometer', 'arduino-light-sensor', 'arduino-thermometer', 'arduino-lcd-temperature', 'arduino-intruder-alarm', 'arduino-led-strip', 'arduino-servo-lcd', 'arduino-four-button-lock', 'arduino-timer-lock'],
    python: ['pinout', 'pinout', 'arduino-button-led', 'arduino-led', 'arduino-rgb-led', 'arduino-buzzer', 'arduino-analog-input', 'arduino-servo-potentiometer', 'arduino-light-sensor', 'arduino-thermometer', 'arduino-lcd-temperature', 'arduino-intruder-alarm', 'python-led-strip'],
    piper: ['pinout', 'arduino-led', 'piper-button-led', 'piper-tilt-led', 'piper-intruder-alarm', 'arduino-light-sensor', 'piper-servo', 'piper-led-strip']
  };

  const kitManifest = {"arduino": {"1": [["Project_1_Hello_LED.ino", "Project_1_Hello_LED.ino"]], "10": [["Project_10_LCD1602_Show_Temperature.ino", "Project_10_LCD1602_Show_Temperature.ino"]], "11": [["Project_11_Intruder_Alarm.ino", "Project_11_Intruder_Alarm.ino"]], "12": [["Project_12_RGB_LED_Strip.ino", "Project_12_RGB_LED_Strip.ino"]], "2": [["Project_2_Button_Control_LED.ino", "Project_2_Button_Control_LED.ino"]], "3": [["Project_3_PWM_Control_LED.ino", "Project_3_PWM_Control_LED.ino"]], "4": [["Project_4_RGB_LED.ino", "Project_4_RGB_LED.ino"]], "5": [["Project_5_Custom_Tone.ino", "Project_5_Custom_Tone.ino"]], "6": [["Project_6_Analog_Input.ino", "Project_6_Analog_Input.ino"]], "7": [["Project_7_Potentiometer_Control_Servo.ino", "Project_7_Potentiometer_Control_Servo.ino"]], "8": [["Project_8_Photoresistor_Control_LED.ino", "Project_8_Photoresistor_Control_LED.ino"]], "9": [["Project_9_Thermometer.ino", "Project_9_Thermometer.ino"]]}, "python": {"1": [["Hello_Led.py", "Hello_Led.py"]], "10": [["LCD1602.py", "LCD1602.py"], ["LCD1602_Show_Temperature.py", "LCD1602_Show_Temperature.py"]], "11": [["Intruder_Alarm.py", "Intruder_Alarm.py"]], "12": [["RGB LED Strip.py", "RGB_LED_Strip.py"], ["ws2812.py", "ws2812.py"]], "2": [["Button_Control_LED.py", "Button_Control_LED.py"]], "3": [["PWM_Control_LED.py", "PWM_Control_LED.py"]], "4": [["RGB_LED.py", "RGB_LED.py"]], "5": [["Buzzer_Tone.py", "Buzzer_Tone.py"]], "6": [["Analog_Input.py", "Analog_Input.py"]], "7": [["Potentiometer Control Servo.py", "Potentiometer_Control_Servo.py"]], "8": [["Photoresistor_Control_LED.py", "Photoresistor_Control_LED.py"]], "9": [["Thermometer.py", "Thermometer.py"]]}, "piper": {"1": [["Hello LED.png", "Hello_LED.png"]], "2": [["Button_Control_LED.png", "Button_Control_LED.png"]], "3": [["Tilt_Switch_Control_LED.png", "Tilt_Switch_Control_LED.png"]], "4": [["Intruder_Alarm.png", "Intruder_Alarm.png"]], "5": [["Photoresistor_Control_LED.png", "Photoresistor_Control_LED.png"]], "6": [["Servo.png", "Servo.png"]], "7": [["RGB_LED_Strip.png", "RGB_LED_Strip.png"]]}};
  const manualNames = {"arduino": "Arduino IDE--Raspberry Pi Pico Starter Kit.pdf", "python": "MicroPython--Raspberry Pi Pico Starter Kit.pdf", "piper": "Piper Make--Raspberry Pi Pico Starter Kit.pdf"};
  const manuals = {};
  const fileUrls = {};
  const assetsForTrack = Object.fromEntries(Object.entries(window.picoCatalog).map(([key, value]) =>
    [key, Object.fromEntries(Object.entries(value.examples).map(([chapter, files]) => [chapter, [...files]]))]));
  const isKitLesson = () => track.value !== 'arduino' || chapter < 13;
  const askForKit = () => get('kit-picker').click();
  get('kit-open').onclick = askForKit;
  get('kit-picker').onchange = async event => {
    const files = new Map(Array.from(event.target.files, file => [file.name.toLowerCase(), file]));
    const status = get('kit-status');
    if (!Object.values(manualNames).some(name => files.has(name.toLowerCase()))) {
      status.textContent = 'No kit manual found. Extract the inner ZIP and choose the kit folder again.';
      return;
    }
    const input = event.target;
    input.disabled = true;
    try {
      for (const [key, name] of Object.entries(manualNames)) {
        const manual = files.get(name.toLowerCase());
        if (!manual) continue;
        if (manuals[key]) URL.revokeObjectURL(manuals[key]);
        manuals[key] = URL.createObjectURL(manual);
        for (const [ch, entries] of Object.entries(kitManifest[key])) {
          const available = [...assetsForTrack[key][ch]];
          for (const [label, filename] of entries) {
            const file = files.get(label.toLowerCase());
            if (!file) continue;
            const slot = key + '/' + filename;
            if (fileUrls[slot]) URL.revokeObjectURL(fileUrls[slot]);
            fileUrls[slot] = URL.createObjectURL(file);
            const entry = {name:label, file:filename};
            if (key !== 'piper') entry.code = await file.text();
            available.push(entry);
          }
          window.picoCatalog[key].examples[ch] = available;
        }
      }
      status.textContent = 'Kit opened for this tab.';
      showPage(page, true);
      if (get('files-panel').open) get('files-panel').close();
    } catch { status.textContent = 'The kit could not be read. Choose the extracted folder again.'; }
    finally { input.disabled = false; input.value = ''; }
  };
  function setFrame(id, url) {
    const frame = get(id);
    frame.hidden = !url;
    if (!url) { if (frame.hasAttribute('src')) frame.removeAttribute('src'); }
    else if (frame.getAttribute('src') !== url) frame.src = url;
  }
  for (const dialog of document.querySelectorAll('dialog')) {
    dialog.addEventListener('click', e => {
      if (e.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
    });
  }

  function showCircuitFigure() {
    const kit = isKitLesson();
    const manual = manuals[track.value];
    const wiringPage = data.wiringPages[chapter] || data.starts[chapter-1] || 1;
    const original = get('circuit-original');
    original.hidden = kit;
    setFrame('kit-wiring', kit && manual ? manual + '#page=' + wiringPage + '&view=Fit' : '');
    if (kit) {
      get('circuit-label').textContent = 'Circuit';
      get('circuit-title').textContent = labels[chapter];
      const note = get('circuit-note');
      note.hidden = !!manual;
      note.replaceChildren('Open the kit folder to see the wiring in the lesson manual. ');
      const button = document.createElement('button');
      button.textContent = 'Open kit folder'; button.onclick = askForKit; note.append(button);
      circuitImage.dataset.lesson = '';
      return;
    }
    const figure = circuits[track.value][chapter];
    const src = 'assets/circuits/' + figure + '.webp';
    if (circuitImage.getAttribute('src') === src && circuitImage.dataset.lesson === track.value + chapter) return;
    circuitImage.dataset.lesson = track.value + chapter;
    circuitImage.src = src;
    const subject = chapter ? labels[chapter] : 'Raspberry Pi Pico pinout';
    const description = figure === 'pinout' ? 'Pico GPIO pinout' : subject + ' breadboard wiring';
    circuitImage.alt = description;
    get('circuit-original').href = src;
    get('circuit-original').setAttribute('aria-label', 'Open full-size ' + description);
    get('circuit-label').textContent = chapter ? 'Circuit / Project ' + String(chapter).padStart(2, '0') : 'Circuit / Setup';
    get('circuit-title').textContent = subject;
    const onboard = track.value === 'python' && chapter === 1;
    get('circuit-note').hidden = !onboard;
    get('circuit-note').textContent = onboard ? 'The sketch drives the onboard LED on GP25. Connect the Pico by USB.' : '';
    turnPage(circuitImage, 1);
  }
  let guideDirection = 1;
  const slide = { duration: 440, easing: 'cubic-bezier(.22,.8,.24,1)' };
  function setLayers(panes) {
    for (const pane of viewControls.map(paneFor)) pane.style.zIndex = '1';
    panes.forEach((pane, i) => { pane.style.zIndex = String(panes.length - i + 1); });
  }
  function turnPage(element, direction) {
    if (reducedMotion.matches) return;
    element.getAnimations().forEach(animation => animation.cancel());
    element.animate([
      { opacity: .25, transform: `translateX(${direction * 16}px)` },
      { opacity: 1, transform: 'none' }
    ], { ...slide, duration: 300 });
  }
  // Read the on-screen positions before interrupting an in-flight rearrangement.
  function measurePapers() {
    viewer.querySelectorAll('.departing-paper').forEach(copy => copy.remove());
    const positions = papers.map(paper => {
      const rect = paper.getBoundingClientRect();
      const opacity = Number(getComputedStyle(paper).opacity);
      paper.getAnimations().forEach(animation => animation.cancel());
      return { rect, opacity };
    });
    return reducedMotion.matches ? [] : positions;
  }
  function animatePapers(before) {
    const motions = [];
    before.forEach(({ rect: from }, i) => {
      const paper = papers[i];
      if (paper.parentElement.hidden) return;
      const to = paper.getBoundingClientRect();
      if (!to.width || !to.height) return;
      if (from.width) {
        motions.push(paper.animate([
          { transform: `translate(${from.x - to.x}px,${from.y - to.y}px) scale(${from.width / to.width},${from.height / to.height})` },
          { transform: 'none' }
        ], slide));
      } else {
        motions.push(paper.animate([
          { opacity: 0, transform: 'translateY(28px) scale(.95) rotate(.8deg)' },
          { opacity: 1, transform: 'none' }
        ], slide));
      }
    });
    const ordered = () => [...viewer.querySelectorAll('.viewer-pane:not([hidden])')];
    if (!motions.length) {
      setLayers(ordered());
      return;
    }
    Promise.all(motions.map(motion => motion.finished)).then(() => {
      setLayers(ordered());
    }, () => {}); // A new layout cancels the old motions and decides the layer order.
  }
  function animateDeparture(paper, { rect, opacity }) {
    const board = viewer.getBoundingClientRect();
    const copy = paper.cloneNode(true);
    copy.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
    copy.inert = true;
    copy.setAttribute('aria-hidden', 'true');
    copy.classList.add('departing-paper');
    Object.assign(copy.style, {
      left: (rect.left - board.left) + 'px', top: (rect.top - board.top) + 'px',
      width: rect.width + 'px', height: rect.height + 'px'
    });
    viewer.append(copy);
    const timing = { duration: 240, easing: 'ease-in', fill: 'forwards' };
    const exit = copy.animate([
      { opacity, transform: 'none' },
      { opacity: 0, transform: 'translateY(24px) scale(.94) rotate(-1deg)' }
    ], timing);
    exit.finished.then(() => copy.remove(), () => copy.remove());
  }
  function moveView(source, target, dragged = false) {
    if (!target || source === target) return;
    const moving = reducedMotion.matches ? [] : [...viewButtons.children];
    const paperPositions = measurePapers();
    const positions = moving.map(element => element.getBoundingClientRect());
    for (const element of moving) {
      for (const animation of element.getAnimations()) animation.cancel();
    }
    if (dragged) source.style.removeProperty('translate');
    const focused = document.activeElement;
    const after = [...viewButtons.children].indexOf(source) < [...viewButtons.children].indexOf(target);
    target[after ? 'after' : 'before'](source);
    const targetPane = paneFor(target);
    targetPane[after ? 'after' : 'before'](paneFor(source));
    saveLayout();
    animatePapers(paperPositions);
    if (viewButtons.contains(focused) || viewer.contains(focused)) focused.focus({ preventScroll: true });

    moving.forEach((element, index) => {
      const before = positions[index];
      const after = element.getBoundingClientRect();
      element.animate([
        { transform: `translate(${before.left - after.left}px, ${before.top - after.top}px)` },
        { transform: 'translate(0, 0)' }
      ], slide);
    });
  }
  function download(label, file, originalName) {
    const link = document.createElement('a');
    link.textContent = label;
    link.href = fileUrls[track.value + '/' + file] || base + file;
    if (originalName) link.download = originalName;
    else { link.target = '_blank'; link.rel = 'noopener'; }
    get('downloads').append(link);
  }
  function createCodeSheet(pane, prefix) {
    const get = id => document.getElementById(prefix + id);
    const code = get('code'), editor = get('source-editor'), editButton = get('edit-source');
    const blocks = get('blocks');
    let displayedExample, chunks = [], chunk = 0;
    function controls(label, first, last) {
      get('position').textContent = label;
      get('prev').disabled = first;
      get('next').disabled = last;
    }
    let sheetParts = [], activeSketch = '', buildOutput;
    let consoleOutput = { open: false }, followLast = false;
    let measuredText = '', measuredSize = '';
    const drafts = new Map();
    let fileKey = '', editing = false, storedLocally = true;
    function setEditing(enabled) {
      editing = enabled;
      editor.hidden = !enabled;
      editButton.setAttribute('aria-pressed', String(enabled));
      editButton.title = enabled ? 'Finish editing' : 'Edit code';
      editButton.setAttribute('aria-label', editButton.title);
      get('prev').hidden = get('next').hidden = enabled;
      get('last').hidden = enabled;
    }
    function pageStart() {
      return chunks.slice(0, chunk).reduce((sum, part) => sum + part.length, 0);
    }
    function beginEditing(offset) {
      setEditing(true);
      display(displayedExample);
      editor.focus({ preventScroll: true });
      editor.setSelectionRange(offset, offset);
    }
    editButton.onclick = () => {
      if (editing) {
        setEditing(false);
        display(displayedExample);
      } else {
        beginEditing(pageStart());
      }
    };
    code.onclick = event => {
      if (event.target !== code || !fileKey) return;
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed && code.contains(selection.anchorNode)) return;
      const start = pageStart();
      if (sheetParts.length > 1 && start >= sheetParts[0].text.length) return;
      const caret = document.caretPositionFromPoint?.(event.clientX, event.clientY);
      const node = caret?.offsetNode ?? selection?.focusNode;
      const offset = caret?.offset ?? selection?.focusOffset ?? 0;
      if (sheetParts.length > 1 && node !== code.firstChild) return;
      const withinPage = node === code.firstChild && node?.nodeType === Node.TEXT_NODE
        ? offset : chunks[chunk].length;
      beginEditing(Math.min(start + withinPage, editor.value.length));
    };
    editor.oninput = () => {
      if (!fileKey) return;
      const original = displayedExample.code.replace(/\r\n?/g, '\n');
      const modified = editor.value !== original;
      if (modified) drafts.set(fileKey, editor.value);
      else drafts.delete(fileKey);
      try {
        if (modified) localStorage.setItem(fileKey, editor.value);
        else localStorage.removeItem(fileKey);
        storedLocally = true;
      } catch { storedLocally = false; }
      get('position').textContent = storedLocally ? 'Saved in this browser' : 'Saved for this session';
      buildOutput = undefined;
      window.dispatchEvent(new CustomEvent('pico-sketch-changed', { detail: { source: activeSketch } }));
    };
    function showCode() {
      const start = pageStart();
      const end = start + chunks[chunk].length;
      let offset = 0;
      const content = document.createDocumentFragment();
      for (const part of sheetParts) {
        const visible = part.text.slice(Math.max(0, start - offset), Math.max(0, end - offset));
        offset += part.text.length;
        if (!visible) continue;
        if (!part.kind) {
          content.append(visible);
          continue;
        }
        const node = document.createElement(part.kind);
        node.textContent = visible;
        if (part.divider) {
          node.textContent = '';
          node.className = 'output-divider';
          node.setAttribute('role', 'separator');
        } else if (part.kind === 'a') {
          node.href = '/api/builds/' + buildOutput.digest + '.uf2';
          node.download = buildOutput.file;
          node.setAttribute('aria-label', part.text);
        } else if (part.kind === 'button') {
          node.type = 'button';
          node.disabled = !buildOutput.canInstall;
          node.setAttribute('aria-label', part.text);
          node.onclick = () => window.dispatchEvent(new CustomEvent('pico-install-sketch', { detail: { source: activeSketch } }));
        }
        content.append(node);
      }
      code.replaceChildren(content);
      controls('Code ' + (chunk + 1) + ' / ' + chunks.length, chunk === 0, chunk === chunks.length - 1);
      get('last').setAttribute('aria-pressed', String(followLast));
    }
    // Measure wrapped text in the actual pane, including long lines on small screens.
    function paginate(source, reveal) {
      sheetParts = [{ text: source }];
      let messageStart = source.length;
      if (buildOutput && activeSketch) {
        sheetParts[0].text = source.trimEnd() + '\n\n';
        // Reserve one line for the rule when measuring the paginated text.
        sheetParts.push({ text: '-', kind: 'span', divider: true }, { text: '\n' });
        messageStart = sheetParts[0].text.length + 2;
        sheetParts.push({ text: buildOutput.message, kind: 'span' });
        if (buildOutput.hint) sheetParts.push({ text: '\n' + buildOutput.hint, kind: 'span' });
        if (buildOutput.digest) {
          sheetParts.push({ text: '\n' }, { text: 'Download UF2', kind: 'a' });
          if (!buildOutput.sent) sheetParts.push({ text: '\n' }, { text: 'Install on Pico', kind: 'button' });
        }
      }
      if (consoleOutput.open) {
        if (sheetParts.length === 1) sheetParts[0].text = source.trimEnd();
        sheetParts.push({ text: '\n\n' }, { text: '-', kind: 'span', divider: true }, { text: '\n' });
        if (reveal === 'console') messageStart = sheetParts.reduce((sum, part) => sum + part.text.length, 0);
        sheetParts.push({ text: 'Serial console · ' + consoleOutput.status, kind: 'span' });
        if (consoleOutput.text) sheetParts.push({ text: '\n' + consoleOutput.text, kind: 'span' });
      }
      const text = sheetParts.map(part => part.text).join('');
      const size = code.clientWidth + '/' + code.clientHeight;
      // Appended output can only change the final page and the pages after it.
      let offset = measuredText.length;
      if (size !== measuredSize || !chunks.length || !text.startsWith(measuredText)) {
        chunks = [];
        offset = 0;
      } else if (text.length > offset) {
        offset -= chunks.pop().length;
      }
      measuredText = text;
      measuredSize = size;
      while (offset < text.length) {
        let low = 1, high = Math.min(512, text.length - offset);
        while (high < text.length - offset) {
          code.textContent = text.slice(offset, offset + high);
          if (code.scrollHeight > code.clientHeight) break;
          low = high;
          high = Math.min(high * 2, text.length - offset);
        }
        while (low < high) {
          const mid = Math.ceil((low + high) / 2);
          code.textContent = text.slice(offset, offset + mid);
          if (code.scrollHeight <= code.clientHeight) low = mid;
          else high = mid - 1;
        }
        let end = offset + low;
        if (end < text.length) {
          const newline = text.lastIndexOf('\n', end - 1);
          if (newline >= offset) end = newline + 1;
        }
        chunks.push(text.slice(offset, end));
        offset = end;
      }
      if (!chunks.length) chunks.push('');
      if (followLast) chunk = chunks.length - 1;
      else if (reveal) {
        let end = 0;
        chunk = chunks.findIndex(part => (end += part.length) > messageStart);
        if (chunk < 0) chunk = chunks.length - 1;
      } else chunk = Math.min(chunk, chunks.length - 1);
      showCode();
    }
    function display(file) {
      const sketch = track.value === 'arduino' && file ? file.file : '';
      if (activeSketch !== sketch) {
        window.dispatchEvent(new CustomEvent('pico-sketch-changed', { detail: { source: activeSketch } }));
        activeSketch = sketch;
        buildOutput = undefined;
      }
      const isCode = file?.code !== undefined;
      const nextKey = isCode ? 'pico-course:draft:' + track.value + '/' + file.file : '';
      if (fileKey !== nextKey) {
        chunk = 0;
        fileKey = nextKey;
        followLast = false;
        if (consoleOutput.open) window.picoConsole?.hide();
        setEditing(false);
        if (isCode) {
          let draft = drafts.get(fileKey);
          if (draft === undefined) {
            try { draft = localStorage.getItem(fileKey); } catch { /* Use the session copy. */ }
          }
          editor.value = draft ?? file.code;
        }
      }
      get('sketch-tools').hidden = !isCode;
      get('compile-sketch').hidden = get('run-sketch').hidden = true;
      get('stop-sketch').hidden = !sketch;
      get('last').hidden = !isCode || editing;
      get('compile-sketch').dataset.file = sketch;
      code.hidden = !isCode || editing;
      blocks.hidden = !file || isCode;
      if (editing) {
        get('position').textContent = storedLocally ? 'Editing · autosave' : 'Saved for this session';
      } else if (isCode) paginate(editor.value);
      else if (file) {
        blocks.src = fileUrls[track.value + '/' + file.file] || base + file.file;
        blocks.alt = labels[chapter] + ' block diagram';
        controls('Block diagram', true, true);
      }
      if (file && displayedExample && file !== displayedExample) turnPage(isCode ? code : blocks, 1);
      displayedExample = file;
    }
    window.addEventListener('pico-build-output', ({ detail }) => {
      if (!activeSketch || activeSketch !== detail.source) return;
      buildOutput = detail;
      if (editing && !detail.reveal) return;
      if (editing) {
        setEditing(false);
        code.hidden = false;
      }
      paginate(editor.value, detail.reveal);
    });
    window.addEventListener('pico-console-output', ({ detail }) => {
      consoleOutput = detail.pane === pane.id ? detail : { open: false };
      const reveal = consoleOutput.open && detail.reveal;
      if (!fileKey || pane.hidden) return;
      if (editing && reveal) {
        setEditing(false);
        code.hidden = false;
      }
      if (!code.hidden) paginate(editor.value, reveal && 'console');
    });
    function moveCodePage(page, follow = false) {
      const direction = Math.sign(page - chunk);
      followLast = follow;
      chunk = page;
      showCode();
      if (direction) turnPage(code, direction);
    }
    get('prev').onclick = () => moveCodePage(chunk - 1);
    get('next').onclick = () => moveCodePage(chunk + 1);
    get('last').onclick = () => moveCodePage(chunks.length - 1, true);
    new ResizeObserver(() => {
      if (displayedExample && !code.hidden && !pane.hidden) paginate(editor.value);
    }).observe(pane.querySelector('.stage'));
    return display;
  }
  const displayExample = createCodeSheet(examplePane, '');
  const displaySweep = createCodeSheet(sweepPane, 'sweep-');
  function render() {
    const file = openSheets.has(exampleControl) ? examples[Number(material.value)] : undefined;
    const sweep = openSheets.has(sweepControl) ? sweepExample : undefined;
    const showCircuit = openSheets.has(circuitControl);
    const guideVisible = openSheets.has(guideControl) || (!file && !sweep && !showCircuit);
    const visibility = [!!file, guideVisible, showCircuit, !!sweep];
    const layoutChanged = papers.some((paper, i) => paper.parentElement.hidden === visibility[i]);
    if (layoutChanged) {
      setLayers([...viewButtons.children].filter(control =>
        visibility[viewControls.indexOf(control)] && !paneFor(control).hidden).map(paneFor));
    }
    const before = layoutChanged ? measurePapers() : [];
    before.forEach((position, i) => {
      if (position.rect.width && !visibility[i]) animateDeparture(papers[i], position);
    });
    examplePane.hidden = !file;
    guidePane.hidden = !guideVisible;
    circuitPane.hidden = !showCircuit;
    sweepPane.hidden = !sweep;
    if (showCircuit) showCircuitFigure();
    const visibleCount = visibility.filter(Boolean).length;
    viewer.style.setProperty('--visible-panes', visibleCount);
    viewer.classList.toggle('split', visibleCount > 1);
    viewControls.forEach((control, i) => {
      control.querySelector('.view-grip').disabled = !visibility[i] || visibleCount === 1;
      control.firstElementChild.setAttribute('aria-pressed', String(visibility[i]));
      control.firstElementChild.setAttribute('aria-disabled', String(visibility[i] && visibleCount === 1));
    });
    material.hidden = !file || examples.length < 2;
    displayExample(file);
    displaySweep(sweep);
    const imagePath = base + 'p' + page + '.webp';
    const kit = isKitLesson();
    const manual = manuals[track.value];
    sheet.hidden = kit;
    get('kit-info').hidden = !kit || !!manual;
    get('kit-topic').textContent = labels[chapter];
    get('guide-prev').closest('footer').hidden = kit && !manual;
    setFrame('kit-manual', kit && manual && guideVisible ? manual + '#page=' + page + '&view=Fit&toolbar=0' : '');
    if (!kit && sheet.getAttribute('src') !== imagePath) sheet.src = imagePath;
    if (guideVisible) {
      sheet.alt = labels[chapter] + ', guide page ' + page;
      // Keep the source open to the same lesson while reading its guide.
      const first = (file || sweep || showCircuit) && chapter ? data.starts[chapter - 1] : 1;
      const last = (file || sweep || showCircuit) && chapter < data.starts.length ? data.starts[chapter] - 1 : data.pages;
      guidePrevious.disabled = page <= first;
      guideNext.disabled = page >= last;
    }
    if (layoutChanged) animatePapers(before);
  }
  function showPage(number, newLesson = false) {
    guideDirection = number < page ? -1 : 1;
    page = number;
    const nextChapter = data.starts.filter(start => start <= page).length;
    if (newLesson || nextChapter !== chapter) {
      chapter = nextChapter;
      lesson.value = String(chapter);
      [...nav.children].forEach((b,i) => b.setAttribute('aria-current', String(i === chapter)));
      get('title').textContent = labels[chapter];
      get('kicker').textContent = track.selectedOptions[0].text + (chapter ? ' / Project ' : ' / Getting started');
      if (chapter) {
        const number = document.createElement('span');
        number.id = 'chapter-number';
        number.textContent = String(chapter).padStart(2, '0');
        get('kicker').append(number);
      }
      updateRunningChapter();
      const chapterFiles = data.examples[chapter] || [];
      sweepExample = chapterFiles.find(file => file.file === 'Project_7_SG90_Sweep.ino');
      sweepControl.hidden = !sweepExample;
      originalName.hidden = !sweepExample;
      examples = chapterFiles.filter(file => file !== sweepExample);
      material.replaceChildren(...examples.map((file, i) => new Option(file.name, String(i))));
      // The LCD project also includes a driver module. Open the runnable script first.
      const mainFile = examples.findIndex(file => file.name === 'LCD1602_Show_Temperature.py');
      material.selectedIndex = Math.max(0, mainFile);
      exampleControl.hidden = examples.length === 0;
      exampleButton.textContent = track.value === 'piper' ? 'Blocks' : 'Code';
      exampleGrip.setAttribute('aria-label', 'Move ' + exampleButton.textContent.toLowerCase() + ' pane');
    }
    get('downloads').replaceChildren();
    const supplement = data.guides?.[chapter];
    if (supplement) download('Open chapter guide (PDF)', supplement);
    else if (manuals[track.value]) {
      const link = document.createElement('a');
      link.href = manuals[track.value] + '#page=' + page;
      link.textContent = 'Open kit manual (PDF)'; link.target = '_blank'; link.rel = 'noopener';
      get('downloads').append(link);
    }
    for (const f of [...(data.examples[chapter] || []), ...data.resources]) download(f.name,f.file,f.name);
    for (const file of data.firmware?.[chapter] || []) download('Download starter sketch (UF2)', file, file);
    render();
    try {
      localStorage.setItem(readingPositionKey, JSON.stringify({ track: track.value, page }));
    } catch { /* Reading still works when browser storage is unavailable. */ }
  }
  function selectLesson(i) { showPage(i ? data.starts[i - 1] : 1, true); }
  function showTrack(savedPage) {
    data = window.picoCatalog[track.value];
    base = 'assets/' + track.value + '/';
    labels = ['Introduction & setup', ...(track.value === 'piper' ? piper : names)];
    if (track.value === 'arduino') labels.push('Servo angle on the LCD', 'Four-button phone lock', 'Timer phone lock');
    nav.replaceChildren(); lesson.replaceChildren();
    labels.forEach((name,i) => {
      const number = String(i).padStart(2,'0');
      const button = document.createElement('button'), prefix = document.createElement('span');
      prefix.textContent = i ? number : '•';
      button.append(prefix,name); button.onclick = () => selectLesson(i);
      nav.append(button); lesson.add(new Option((i ? number + ' · ' : '') + name,String(i)));
    });
    if (Number.isInteger(savedPage) && savedPage >= 1 && savedPage <= data.pages) showPage(savedPage, true);
    else selectLesson(track.value === 'arduino' ? 15 : 1);
  }
  get('files').onclick = () => get('files-panel').showModal();
  guidePrevious.onclick = () => showPage(page - 1);
  guideNext.onclick = () => showPage(page + 1);
  for (const control of viewControls) {
    const toggle = control.firstElementChild;
    toggle.onclick = () => {
      if (toggle.getAttribute('aria-disabled') === 'true') return;
      if (openSheets.has(control)) openSheets.delete(control);
      else openSheets.add(control);
      saveLayout();
      render();
    };
  }
  for (const source of viewControls) {
    const grip = source.querySelector('.view-grip');
    let drag;
    const visibleControls = () => [...viewButtons.children].filter(control => !paneFor(control).hidden);
    function nextControl() {
      const visible = visibleControls();
      return visible[(visible.indexOf(source) + 1) % visible.length];
    }
    function targetAt(event) {
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      return visibleControls().find(control => control !== source &&
        (control.contains(hit) || paneFor(control).contains(hit)));
    }
    function highlight(target) {
      for (const control of viewControls) {
        control.classList.toggle('drop-target', control === target);
        paneFor(control).classList.toggle('drop-target', control === target);
      }
    }
    function clearDrag() {
      drag = undefined;
      source.classList.remove('dragging');
      highlight();
    }
    function returnToSlot() {
      const offset = source.style.translate;
      source.style.removeProperty('translate');
      if (offset && !reducedMotion.matches) source.animate([{ translate: offset }, { translate: 'none' }], slide);
    }
    grip.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
      grip.setPointerCapture(event.pointerId);
    });
    grip.addEventListener('pointermove', event => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.slot) {
        if (Math.hypot(dx, dy) <= 6) return;
        const start = source.getBoundingClientRect();
        for (const animation of source.getAnimations()) animation.cancel();
        drag.slot = source.getBoundingClientRect();
        drag.startX = start.left - drag.slot.left;
        drag.startY = start.top - drag.slot.top;
        source.classList.add('dragging');
      }
      const { left, top, right, bottom } = drag.slot;
      const x = Math.max(-left, Math.min(innerWidth - right, drag.startX + dx));
      const y = Math.max(-top, Math.min(innerHeight - bottom, drag.startY + dy));
      source.style.translate = `${x}px ${y}px`;
      highlight(targetAt(event));
    });
    grip.addEventListener('pointerup', event => {
      if (!drag || drag.id !== event.pointerId) return;
      const target = drag.slot ? targetAt(event) :
        grip.contains(document.elementFromPoint(event.clientX, event.clientY)) && nextControl();
      clearDrag();
      if (target) moveView(source, target, true);
      else returnToSlot();
    });
    grip.addEventListener('lostpointercapture', event => {
      if (drag?.id !== event.pointerId) return;
      clearDrag();
      returnToSlot();
    });
    grip.addEventListener('click', event => { if (event.detail === 0) moveView(source, nextControl()); });
    source.addEventListener('keydown', event => {
      if (grip.disabled || !['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const visible = visibleControls();
      const step = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1;
      moveView(source, visible[visible.indexOf(source) + step]);
    });
  }
  material.onchange = render;
  track.onchange = () => showTrack(); lesson.onchange = () => selectLesson(Number(lesson.value));
  restoreLayout();
  let savedPage;
  try {
    const saved = JSON.parse(localStorage.getItem(readingPositionKey));
    if (saved && [...track.options].some(option => option.value === saved.track)) {
      track.value = saved.track;
      savedPage = saved.page;
    }
  } catch { /* Use the starting lesson when no saved position can be read. */ }
  const url = new URL(location.href);
  const project = url.searchParams.get('project');
  if (project && /^[1-9]\d*$/.test(project) && window.picoCatalog.arduino.starts[Number(project) - 1]) {
    track.value = 'arduino';
    savedPage = window.picoCatalog.arduino.starts[Number(project) - 1];
    url.searchParams.delete('project');
    history.replaceState(null, '', url);
  }
  showTrack(savedPage);
})();
