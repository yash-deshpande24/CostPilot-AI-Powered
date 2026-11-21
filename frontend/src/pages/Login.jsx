import { useState } from "react";
import { login, register, rememberedId } from "../auth";

// Usage: <Login onLogin={(session) => ...} />
export default function Login({ onLogin }) {
  const [mode, setMode] = useState("signin");
  const [id, setId] = useState(rememberedId());
  const [pw, setPw] = useState("");
  const [remember, setRemember] = useState(!!rememberedId());
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const s = mode === "signin" ? await login(id, pw, remember) : await register(id, pw);
      onLogin?.(s);
    } catch (x) { setErr(x.message); }
    setBusy(false);
  }

  return (
    <div className="cp-login">
      <form className="cp-login-card" onSubmit={submit}>
        <h1 className="cp-login-brand">CostPilot</h1>
        <p className="cp-login-sub">{mode === "signin" ? "Sign in to see where your AWS money goes." : "Create a login to save your view."}</p>

        <label>Login ID
          <input value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" required />
        </label>

        <label>Password
          <span className="cp-pw">
            <input type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)}
              autoComplete={mode === "signin" ? "current-password" : "new-password"} required />
            <button type="button" onClick={() => setShow(!show)}>{show ? "Hide" : "Show"}</button>
          </span>
        </label>

        {mode === "signin" && (
          <label className="cp-check">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Remember my login ID on this device
          </label>
        )}

        {err && <p className="cp-login-err" role="alert">{err}</p>}

        <button className="cp-primary" disabled={busy}>{mode === "signin" ? "Sign in" : "Create account"}</button>
        <button type="button" className="cp-link" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setErr(""); }}>
          {mode === "signin" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}