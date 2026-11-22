const listeners = new Set();
let nextId = 0;

// Call toast("Saved") or toast("Something failed", "error") from anywhere.
export function toast(message, type = "success") {
  const t = { id: ++nextId, message, type };
  listeners.forEach((fn) => fn(t));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}