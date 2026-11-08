const KEY = 'jungle-run-v1';
const defaults = { best: 0, sound: true };

export function readPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      best: Number.isSafeInteger(saved.best) && saved.best >= 0 ? saved.best : 0,
      sound: typeof saved.sound === 'boolean' ? saved.sound : true,
    };
  } catch { return { ...defaults }; }
}

export function writePreferences(preferences) {
  try { localStorage.setItem(KEY, JSON.stringify(preferences)); } catch { /* Private browsing can disable storage. The game still works. */ }
}
