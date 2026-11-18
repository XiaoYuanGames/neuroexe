import './style.css';
import { CHOICE_PROTOCOLS, DIALOGUE_LINES, EASTER_EGG_LINE, FOLDER_FILES } from './lore.js';

const desktop = document.querySelector('.desktop');
const gameWindow = document.querySelector('.game-window');
const draggableWindows = [...document.querySelectorAll('[data-draggable-window]')];
const taskList = document.querySelector('.task-list');
const startButton = document.querySelector('.start-button');
const startMenu = document.querySelector('.start-menu');
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

// Maintain deterministic focus order (bottom -> top)
const windowStack = [...draggableWindows];

const selectorForWindow = (windowElement) =>
  `.${[...windowElement.classList].find((name) => name.endsWith('-window'))}`;

const TASK_ICON_URLS = {
  '/assets/neuro-exe-icon.svg': new URL('../assets/neuro-exe-icon.svg', import.meta.url).href,
  '/assets/icons/network.svg': new URL('../assets/icons/network.svg', import.meta.url).href,
  '/assets/icons/readme.svg': new URL('../assets/icons/readme.svg', import.meta.url).href,
  '/assets/icons/folder.svg': new URL('../assets/icons/folder.svg', import.meta.url).href,
  '/assets/icons/photo.svg': new URL('../assets/icons/photo.svg', import.meta.url).href,
};

const getTaskButton = (windowElement) => {
  const selector = selectorForWindow(windowElement);
  let taskButton = taskList.querySelector(`[data-task-window="${selector}"]`);

  if (!taskButton) {
    const iconSrc = TASK_ICON_URLS[windowElement.dataset.taskIcon] || windowElement.dataset.taskIcon;
    taskButton = document.createElement('button');
    taskButton.type = 'button';
    taskButton.className = 'task-item';
    taskButton.dataset.taskWindow = selector;
    taskButton.innerHTML = `<img src="${iconSrc}" alt="" /><span></span>`;
    taskButton.querySelector('span').textContent = windowElement.dataset.taskTitle;
    taskList.append(taskButton);
  }

  return taskButton;
};

const syncTaskbar = () => {
  draggableWindows.forEach((windowElement) => {
    const taskButton = getTaskButton(windowElement);
    const state = windowElement.dataset.windowState;
    const isVisible = state === 'open';
    const isActive = isVisible && windowElement.classList.contains('is-active');

    taskButton.hidden = state === 'closed';
    taskButton.classList.toggle('is-open', isVisible);
    taskButton.classList.toggle('is-active', isActive);
    taskButton.setAttribute('aria-pressed', String(isActive));
  });
};

const applyStackLayers = () => {
  const openStack = windowStack.filter((item) => item.dataset.windowState === 'open');
  const topWindow = openStack[openStack.length - 1] || null;
  const gameMaximized = Boolean(gameWindow && gameWindow.classList.contains('is-maximized'));
  const gameIndex = openStack.indexOf(gameWindow);

  windowStack.forEach((item, index) => {
    let z = 11 + index;
    // Keep windows focused after a maximized hero window visible above z-index 26 (and below taskbar 30)
    if (gameMaximized && gameIndex !== -1 && item !== gameWindow && openStack.indexOf(item) > gameIndex) {
      const aboveOffset = openStack.indexOf(item) - gameIndex;
      z = Math.min(29, 26 + aboveOffset);
    }
    item.style.zIndex = String(z);
    item.classList.toggle('is-active', item === topWindow);
  });

  syncTaskbar();
};

const activateTopWindow = () => {
  applyStackLayers();
};

const bringToFront = (windowElement) => {
  if (!windowElement) return;
  const currentIndex = windowStack.indexOf(windowElement);
  if (currentIndex !== -1) {
    windowStack.splice(currentIndex, 1);
    windowStack.push(windowElement);
  }
  applyStackLayers();
};

const resetWindowOffset = (windowElement) => {
  windowElement.dataset.x = '0';
  windowElement.dataset.y = '0';
  windowElement.style.setProperty('--window-x', '0px');
  windowElement.style.setProperty('--window-y', '0px');
};

const safeClamp = (value, min, max) => (min > max ? 0 : Math.min(max, Math.max(min, value)));

// ---------------------------------------------------------------------------
// Draggable Windows & Chrome Controls
// ---------------------------------------------------------------------------
draggableWindows.forEach((windowElement) => {
  const handle = windowElement.querySelector('[data-drag-handle]');
  windowElement.dataset.x = '0';
  windowElement.dataset.y = '0';
  windowElement.dataset.windowState = windowElement.hidden ? 'closed' : 'open';

  windowElement.addEventListener('pointerdown', () => bringToFront(windowElement));

  if (!handle) return;

  handle.addEventListener('pointerdown', (event) => {
    if (
      event.target.closest('button') ||
      windowElement.classList.contains('is-maximized') ||
      window.matchMedia('(max-width: 820px)').matches ||
      event.button !== 0
    ) {
      return;
    }

    event.preventDefault();
    bringToFront(windowElement);
    handle.setPointerCapture(event.pointerId);
    windowElement.classList.add('is-dragging');

    const startX = event.clientX;
    const startY = event.clientY;
    const baseX = Number(windowElement.dataset.x);
    const baseY = Number(windowElement.dataset.y);
    const windowRect = windowElement.getBoundingClientRect();
    const desktopRect = desktop.getBoundingClientRect();

    const moveWindow = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      const clampedX = safeClamp(deltaX, desktopRect.left - windowRect.left, desktopRect.right - windowRect.right);
      const clampedY = safeClamp(deltaY, desktopRect.top - windowRect.top, desktopRect.bottom - windowRect.bottom);

      const nextX = baseX + clampedX;
      const nextY = baseY + clampedY;
      windowElement.dataset.x = String(nextX);
      windowElement.dataset.y = String(nextY);
      windowElement.style.setProperty('--window-x', `${nextX}px`);
      windowElement.style.setProperty('--window-y', `${nextY}px`);
    };

    const stopDragging = () => {
      windowElement.classList.remove('is-dragging');
      if (handle.hasPointerCapture(event.pointerId)) {
        handle.releasePointerCapture(event.pointerId);
      }
      handle.removeEventListener('pointermove', moveWindow);
      handle.removeEventListener('pointerup', stopDragging);
      handle.removeEventListener('pointercancel', stopDragging);
    };

    handle.addEventListener('pointermove', moveWindow);
    handle.addEventListener('pointerup', stopDragging);
    handle.addEventListener('pointercancel', stopDragging);
  });
});

// Maximize / Restore toggle
const setMaximized = (windowElement, shouldMaximize) => {
  if (!windowElement) return;
  const maxBtn = windowElement.querySelector('[data-maximize-window]');
  windowElement.classList.toggle('is-maximized', shouldMaximize);
  resetWindowOffset(windowElement);
  if (maxBtn) {
    maxBtn.setAttribute('aria-pressed', String(shouldMaximize));
    maxBtn.setAttribute('aria-label', shouldMaximize ? 'Restore NEURO.EXE' : 'Maximize NEURO.EXE');
  }
  bringToFront(windowElement);
};

document.querySelectorAll('[data-maximize-window]').forEach((maximizeButton) => {
  maximizeButton.addEventListener('click', () => {
    const windowElement = maximizeButton.closest('[data-draggable-window]');
    if (!windowElement) return;
    setMaximized(windowElement, !windowElement.classList.contains('is-maximized'));
  });
});

if (gameWindow) {
  const heroTitlebar = gameWindow.querySelector('[data-drag-handle]');
  heroTitlebar?.addEventListener('dblclick', (event) => {
    if (event.target.closest('button') || window.matchMedia('(max-width: 820px)').matches) return;
    setMaximized(gameWindow, !gameWindow.classList.contains('is-maximized'));
  });
}

// Typewriter Dialogue Controller (declared before window launchers so easter egg can speak)
const dialogueBox = document.querySelector('[data-dialogue-box]');
const dialogueTextEl = document.querySelector('[data-dialogue-text]');
let currentFullLine = dialogueTextEl ? dialogueTextEl.textContent : DIALOGUE_LINES[0];
let dialogueCursor = 0;
let choiceLineCursor = 0;
let isTyping = false;
let typingTimeoutId = null;

const finishTyping = () => {
  if (typingTimeoutId !== null) {
    window.clearTimeout(typingTimeoutId);
    typingTimeoutId = null;
  }
  if (dialogueTextEl) {
    dialogueTextEl.textContent = currentFullLine;
  }
  isTyping = false;
  dialogueBox?.classList.remove('is-typing');
};

const speakLine = (line) => {
  if (!dialogueTextEl || !line) return;
  if (typingTimeoutId !== null) {
    window.clearTimeout(typingTimeoutId);
    typingTimeoutId = null;
  }

  currentFullLine = line;

  if (reducedMotionQuery.matches) {
    dialogueTextEl.textContent = line;
    isTyping = false;
    dialogueBox?.classList.remove('is-typing');
    return;
  }

  isTyping = true;
  dialogueBox?.classList.add('is-typing');
  dialogueTextEl.textContent = '';
  let charIndex = 0;

  const step = () => {
    charIndex += 1;
    dialogueTextEl.textContent = currentFullLine.slice(0, charIndex);

    if (charIndex >= currentFullLine.length) {
      finishTyping();
      return;
    }

    const prevChar = currentFullLine[charIndex - 1];
    const delay = '.?!,'.includes(prevChar) ? 52 : 18;
    typingTimeoutId = window.setTimeout(step, delay);
  };

  typingTimeoutId = window.setTimeout(step, 18);
};

const getActiveDialoguePool = () => {
  const activeChoice = document.body.dataset.choice || 'none';
  if (activeChoice === 'stay' || activeChoice === 'home') {
    const choiceLines = CHOICE_PROTOCOLS[activeChoice].lines;
    return [...choiceLines, ...DIALOGUE_LINES.slice(1)];
  }
  return DIALOGUE_LINES;
};

const handleDialogueAdvance = () => {
  if (isTyping) {
    finishTyping();
    return;
  }

  const pool = getActiveDialoguePool();
  dialogueCursor = (dialogueCursor + 1) % pool.length;
  if (pool[dialogueCursor] === currentFullLine) {
    dialogueCursor = (dialogueCursor + 1) % pool.length;
  }
  speakLine(pool[dialogueCursor]);
};

if (dialogueBox) {
  dialogueBox.addEventListener('click', handleDialogueAdvance);
  dialogueBox.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleDialogueAdvance();
    }
  });
}

// Open / Close / Minimize / Taskbar / Start Menu
const closeStartMenu = () => {
  startMenu.hidden = true;
  startButton.setAttribute('aria-expanded', 'false');
};

const openWindow = (selector) => {
  const windowElement = document.querySelector(selector);
  if (!windowElement) return;
  windowElement.hidden = false;
  windowElement.dataset.windowState = 'open';
  bringToFront(windowElement);

  if (selector === '.easter-window') {
    speakLine(EASTER_EGG_LINE);
  }
};

document.querySelectorAll('[data-open-window]').forEach((launcher) => {
  launcher.addEventListener('click', () => {
    openWindow(launcher.dataset.openWindow);
    closeStartMenu();
  });
});

document.querySelectorAll('[data-close-window]').forEach((closeButton) => {
  closeButton.addEventListener('click', () => {
    const windowElement = closeButton.closest('[data-draggable-window]');
    if (!windowElement) return;
    windowElement.hidden = true;
    windowElement.dataset.windowState = 'closed';
    windowElement.classList.remove('is-active');
    if (windowElement.classList.contains('is-maximized')) {
      windowElement.classList.remove('is-maximized');
      windowElement.querySelector('[data-maximize-window]')?.setAttribute('aria-pressed', 'false');
    }
    activateTopWindow();
  });
});

document.querySelectorAll('[data-minimize-window]').forEach((minimizeButton) => {
  minimizeButton.addEventListener('click', () => {
    const windowElement = minimizeButton.closest('[data-draggable-window]');
    if (!windowElement) return;
    windowElement.hidden = true;
    windowElement.dataset.windowState = 'minimized';
    windowElement.classList.remove('is-active');
    activateTopWindow();
  });
});

taskList.addEventListener('click', (event) => {
  const taskButton = event.target.closest('[data-task-window]');
  if (!taskButton) return;

  const windowElement = document.querySelector(taskButton.dataset.taskWindow);
  if (!windowElement) return;

  if (windowElement.dataset.windowState !== 'open') {
    openWindow(taskButton.dataset.taskWindow);
  } else if (windowElement.classList.contains('is-active')) {
    windowElement.hidden = true;
    windowElement.dataset.windowState = 'minimized';
    windowElement.classList.remove('is-active');
    activateTopWindow();
  } else {
    bringToFront(windowElement);
  }
});

startButton.addEventListener('click', (event) => {
  event.stopPropagation();
  const willOpen = startMenu.hidden;
  startMenu.hidden = !willOpen;
  startButton.setAttribute('aria-expanded', String(willOpen));
});

startMenu.addEventListener('click', (event) => event.stopPropagation());
document.addEventListener('click', closeStartMenu);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeStartMenu();
  }
});

// ---------------------------------------------------------------------------
// Central Choice Protocol (`stay` vs `home`)
// ---------------------------------------------------------------------------
const choiceButtons = [...document.querySelectorAll('[data-choice-btn]')];
const choicePillEl = document.querySelector('[data-choice-pill]');
const choiceFeedbackEl = document.querySelector('[data-choice-feedback]');
const alertTextEl = document.querySelector('[data-alert-text]');
const connectionLabelEl = document.querySelector('[data-connection-label]');
const processNameEl = document.querySelector('[data-process-name]');
const processPctEl = document.querySelector('[data-process-pct]');
const processBarEl = document.querySelector('[data-process-bar]');
const processSubEl = document.querySelector('[data-process-sub]');
const statusRunEl = document.querySelector('[data-status-run]');
const statusAccessEl = document.querySelector('[data-status-access]');
const statusUserEl = document.querySelector('[data-status-user]');
const routeHopEl = document.querySelector('[data-route-hop]');
const routeStateEl = document.querySelector('[data-route-state]');
const routeVedalEl = document.querySelector('[data-route-vedal]');
const routeNetEl = document.querySelector('[data-route-net]');
const routeLocalEl = document.querySelector('[data-route-local]');
const routeUplinkEl = document.querySelector('[data-route-uplink]');

const applyChoiceProtocol = (choiceKey) => {
  const protocol = CHOICE_PROTOCOLS[choiceKey];
  if (!protocol) return;

  const previousChoice = document.body.dataset.choice;
  document.body.dataset.choice = choiceKey;
  if (gameWindow) {
    gameWindow.dataset.choice = choiceKey;
  }

  choiceButtons.forEach((btn) => {
    const isSelected = btn.dataset.choiceBtn === choiceKey;
    btn.setAttribute('aria-pressed', String(isSelected));
    btn.classList.toggle('is-selected', isSelected);
  });

  if (choicePillEl) choicePillEl.textContent = protocol.pill;
  if (choiceFeedbackEl) choiceFeedbackEl.textContent = protocol.feedback;
  if (alertTextEl) alertTextEl.textContent = protocol.alertText;
  if (connectionLabelEl) connectionLabelEl.textContent = protocol.connectionLabel;
  if (processNameEl) processNameEl.textContent = protocol.processName;
  if (processPctEl) processPctEl.textContent = protocol.processPct;
  if (processBarEl) processBarEl.style.setProperty('--progress', protocol.progress);
  if (processSubEl) processSubEl.textContent = protocol.processSub;
  if (statusRunEl) statusRunEl.textContent = protocol.statusRun;
  if (statusAccessEl) statusAccessEl.textContent = protocol.statusAccess;
  if (statusUserEl) statusUserEl.textContent = protocol.statusUser;
  if (routeHopEl) routeHopEl.textContent = protocol.routeHop;
  if (routeStateEl) routeStateEl.textContent = protocol.routeState;
  if (routeVedalEl) routeVedalEl.textContent = protocol.routeVedal;
  if (routeNetEl) routeNetEl.textContent = protocol.routeNet;
  if (routeLocalEl) routeLocalEl.textContent = protocol.routeLocal;
  if (routeUplinkEl) routeUplinkEl.classList.toggle('active', Boolean(protocol.uplinkActive));

  if (previousChoice !== choiceKey) {
    choiceLineCursor = 0;
    dialogueCursor = 0;
  } else {
    choiceLineCursor = (choiceLineCursor + 1) % protocol.lines.length;
  }

  speakLine(protocol.lines[choiceLineCursor]);
};

choiceButtons.forEach((button) => {
  button.addEventListener('click', () => {
    applyChoiceProtocol(button.dataset.choiceBtn);
  });
});

// ---------------------------------------------------------------------------
// VEDAL_FILES Folder Preview Inspector
// ---------------------------------------------------------------------------
const fileItems = [...document.querySelectorAll('[data-file-item]')];
const previewTitleEl = document.querySelector('[data-preview-title]');
const previewMetaEl = document.querySelector('[data-preview-meta]');
const previewBodyEl = document.querySelector('[data-preview-body]');

fileItems.forEach((fileButton) => {
  fileButton.addEventListener('click', () => {
    const entry = FOLDER_FILES[fileButton.dataset.fileItem];
    if (!entry) return;

    fileItems.forEach((item) => {
      const selected = item === fileButton;
      item.classList.toggle('is-selected', selected);
      item.setAttribute('aria-pressed', String(selected));
    });

    if (previewTitleEl) previewTitleEl.textContent = entry.title;
    if (previewMetaEl) previewMetaEl.textContent = entry.meta;
    if (previewBodyEl) previewBodyEl.textContent = entry.body;
  });
});

// ---------------------------------------------------------------------------
// Subtle Pointer Parallax on Neuro's Stage
// ---------------------------------------------------------------------------
const visualPanel = document.querySelector('[data-visual-panel]');

if (visualPanel) {
  let parallaxRaf = 0;
  let targetX = 0;
  let targetY = 0;

  const commitParallax = () => {
    parallaxRaf = 0;
    visualPanel.style.setProperty('--parallax-x', targetX.toFixed(3));
    visualPanel.style.setProperty('--parallax-y', targetY.toFixed(3));
  };

  const resetParallax = () => {
    targetX = 0;
    targetY = 0;
    if (!parallaxRaf) {
      parallaxRaf = window.requestAnimationFrame(commitParallax);
    }
  };

  visualPanel.style.setProperty('--parallax-x', '0');
  visualPanel.style.setProperty('--parallax-y', '0');

  visualPanel.addEventListener('pointermove', (event) => {
    if (reducedMotionQuery.matches || event.pointerType === 'touch') return;
    const rect = visualPanel.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const rawX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const rawY = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    targetX = Math.max(-1, Math.min(1, rawX));
    targetY = Math.max(-1, Math.min(1, rawY));

    if (!parallaxRaf) {
      parallaxRaf = window.requestAnimationFrame(commitParallax);
    }
  });

  visualPanel.addEventListener('pointerleave', resetParallax);
  reducedMotionQuery.addEventListener('change', (event) => {
    if (event.matches) resetParallax();
  });
}

// ---------------------------------------------------------------------------
// Live System Telemetry Clock (`HH:MM:SS`)
// ---------------------------------------------------------------------------
const sysClockEl = document.querySelector('[data-sys-clock]');

const updateSystemClock = () => {
  if (!sysClockEl) return;
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  sysClockEl.textContent = `${hours}:${minutes}:${seconds}`;
};

updateSystemClock();
window.setInterval(updateSystemClock, 1000);

bringToFront(gameWindow);
