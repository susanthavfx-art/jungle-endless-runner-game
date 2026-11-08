export function bindInput({ surface, left, right, jump, pause, action, pauseToggle }) {
  const onKey = (event) => {
    if (document.querySelector('dialog[open]') || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', 'a', 'd', 'w', ' ', 'p', 'escape'].includes(key)) {
      if (key === ' ' && event.target.closest?.('button, a') && action() !== 'running') return;
      event.preventDefault();
      if (event.repeat) return;
      if (key === 'p' || key === 'escape') pauseToggle();
      else if (key === 'arrowleft' || key === 'a') left();
      else if (key === 'arrowright' || key === 'd') right();
      else if (key === 'arrowup' || key === 'w' || key === ' ') jump();
    }
  };
  window.addEventListener('keydown', onKey);

  let gesture = null;
  const down = (event) => {
    if (action() !== 'running' || !event.isPrimary) return;
    gesture = { x: event.clientX, y: event.clientY, id: event.pointerId };
    surface.setPointerCapture?.(event.pointerId);
  };
  const up = (event) => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    gesture = null;
    if (action() !== 'running') return;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 24) dx < 0 ? left() : right();
    else if (dy < -24 || (Math.abs(dx) < 14 && Math.abs(dy) < 14)) jump();
  };
  const cancel = () => { gesture = null; };
  surface.addEventListener('pointerdown', down);
  surface.addEventListener('pointerup', up);
  surface.addEventListener('pointercancel', cancel);

  const cleanups = [];
  for (const [element, callback] of [[document.querySelector('#left-button'), left], [document.querySelector('#right-button'), right], [document.querySelector('#jump-button'), jump], [document.querySelector('#pause-button'), pause]]) {
    const press = (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      element.classList.add('pressed');
      callback();
    };
    const release = () => element.classList.remove('pressed');
    const click = (event) => { if (event.detail === 0) callback(); };
    element.addEventListener('pointerdown', press);
    element.addEventListener('pointerup', release);
    element.addEventListener('pointercancel', release);
    element.addEventListener('pointerleave', release);
    element.addEventListener('click', click);
    cleanups.push(() => {
      element.removeEventListener('pointerdown', press);
      element.removeEventListener('pointerup', release);
      element.removeEventListener('pointercancel', release);
      element.removeEventListener('pointerleave', release);
      element.removeEventListener('click', click);
    });
  }
  return () => {
    window.removeEventListener('keydown', onKey);
    surface.removeEventListener('pointerdown', down);
    surface.removeEventListener('pointerup', up);
    surface.removeEventListener('pointercancel', cancel);
    cleanups.forEach((cleanup) => cleanup());
  };
}
