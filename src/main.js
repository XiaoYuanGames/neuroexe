import './style.css';

const desktop = document.querySelector('.desktop');
const draggableWindows = [...document.querySelectorAll('[data-draggable-window]')];
const taskList = document.querySelector('.task-list');
const startButton = document.querySelector('.start-button');
const startMenu = document.querySelector('.start-menu');
let topLayer = 10;

const selectorForWindow = (windowElement) => `.${[...windowElement.classList].find((name) => name.endsWith('-window'))}`;

const getTaskButton = (windowElement) => {
  const selector = selectorForWindow(windowElement);
  let taskButton = taskList.querySelector(`[data-task-window="${selector}"]`);

  if (!taskButton) {
    taskButton = document.createElement('button');
    taskButton.type = 'button';
    taskButton.className = 'task-item';
    taskButton.dataset.taskWindow = selector;
    taskButton.innerHTML = `<img src="${windowElement.dataset.taskIcon}" alt="" /><span></span>`;
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

const activateTopWindow = () => {
  const visibleWindows = draggableWindows.filter((item) => item.dataset.windowState === 'open');
  const nextWindow = visibleWindows.sort((a, b) => Number(b.style.zIndex || 0) - Number(a.style.zIndex || 0))[0];
  draggableWindows.forEach((item) => item.classList.toggle('is-active', item === nextWindow));
  syncTaskbar();
};

const bringToFront = (windowElement) => {
  if (topLayer >= 24) {
    draggableWindows.forEach((item) => item.style.removeProperty('z-index'));
    topLayer = 10;
  }
  topLayer += 1;
  windowElement.style.zIndex = String(topLayer);
  draggableWindows.forEach((item) => item.classList.toggle('is-active', item === windowElement));
  syncTaskbar();
};

draggableWindows.forEach((windowElement) => {
  const handle = windowElement.querySelector('[data-drag-handle]');
  windowElement.dataset.x = '0';
  windowElement.dataset.y = '0';
  windowElement.dataset.windowState = windowElement.hidden ? 'closed' : 'open';

  windowElement.addEventListener('pointerdown', () => bringToFront(windowElement));

  handle.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button') || window.matchMedia('(max-width: 820px)').matches || event.button !== 0) return;

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
      const clampedX = Math.min(
        desktopRect.right - windowRect.right,
        Math.max(desktopRect.left - windowRect.left, deltaX),
      );
      const clampedY = Math.min(
        desktopRect.bottom - windowRect.bottom,
        Math.max(desktopRect.top - windowRect.top, deltaY),
      );

      const nextX = baseX + clampedX;
      const nextY = baseY + clampedY;
      windowElement.dataset.x = String(nextX);
      windowElement.dataset.y = String(nextY);
      windowElement.style.setProperty('--window-x', `${nextX}px`);
      windowElement.style.setProperty('--window-y', `${nextY}px`);
    };

    const stopDragging = () => {
      windowElement.classList.remove('is-dragging');
      handle.removeEventListener('pointermove', moveWindow);
      handle.removeEventListener('pointerup', stopDragging);
      handle.removeEventListener('pointercancel', stopDragging);
    };

    handle.addEventListener('pointermove', moveWindow);
    handle.addEventListener('pointerup', stopDragging);
    handle.addEventListener('pointercancel', stopDragging);
  });
});

const openWindow = (selector) => {
  const windowElement = document.querySelector(selector);
  if (!windowElement) return;
  windowElement.hidden = false;
  windowElement.dataset.windowState = 'open';
  bringToFront(windowElement);
};

document.querySelectorAll('[data-open-window]').forEach((launcher) => {
  launcher.addEventListener('click', () => {
    openWindow(launcher.dataset.openWindow);
    startMenu.hidden = true;
    startButton.setAttribute('aria-expanded', 'false');
  });
});

document.querySelectorAll('[data-close-window]').forEach((closeButton) => {
  closeButton.addEventListener('click', () => {
    const windowElement = closeButton.closest('[data-draggable-window]');
    windowElement.hidden = true;
    windowElement.dataset.windowState = 'closed';
    windowElement.classList.remove('is-active');
    activateTopWindow();
  });
});

document.querySelectorAll('[data-minimize-window]').forEach((minimizeButton) => {
  minimizeButton.addEventListener('click', () => {
    const windowElement = minimizeButton.closest('[data-draggable-window]');
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
document.addEventListener('click', () => {
  startMenu.hidden = true;
  startButton.setAttribute('aria-expanded', 'false');
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    startMenu.hidden = true;
    startButton.setAttribute('aria-expanded', 'false');
  }
});

bringToFront(document.querySelector('.game-window'));
