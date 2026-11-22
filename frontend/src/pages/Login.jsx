import { useState } from "react";
import { api, setToken } from "../api.js";
import { toast } from "../toast.js";

export default function Login({ onLogin }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const path = mode === "signin" ? "/auth/login" : "/auth/register";
      const { token } = await api(path, { method: "POST", body: { email, password: pw } });
      setToken(token);
      toast(mode === "signin" ? "Logged in successfully." : "Account created successfully.");
      onLogin?.();
    } catch (x) { setErr(x.message); }
    setBusy(false);
  }

  return (
    <div className="cp-login">
      <form className="cp-login-card" onSubmit={submit}>
        <h1 className="cp-login-brand">CostPilot</h1>
        <p className="cp-login-sub">{mode === "signin" ? "Sign in to see where your AWS money goes." : "Create an account (password 8+ characters)."}</p>
        <label>Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        </label>
        <label>Password
          <span className="cp-pw">
            <input type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)}
              autoComplete={mode === "signin" ? "current-password" : "new-password"} required />
            <button type="button" onClick={() => setShow(!show)}>{show ? "Hide" : "Show"}</button>
          </span>
        </label>
        {mode === "signin" && (
          <button type="button" className="cp-link" onClick={() => { window.location.hash = "forgot"; }}>
            Forgot password?
          </button>
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