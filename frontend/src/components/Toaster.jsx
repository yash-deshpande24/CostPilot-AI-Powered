import { useEffect, useState } from "react";
import { subscribe } from "../toast.js";

export default function Toaster() {
  const [items, setItems] = useState([]);

  useEffect(
    () =>
      subscribe((t) => {
        setItems((xs) => [...xs, t]);
        setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), 3500);
      }),
    []
  );

  const close = (id) => setItems((xs) => xs.filter((x) => x.id !== id));

  return (
    <div className="cp-toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`cp-toast ${t.type}`}>
          <span>{t.message}</span>
          <button type="button" aria-label="Dismiss message" onClick={() => close(t.id)}>×</button>
        </div>
      ))}
    </div>
  );
}