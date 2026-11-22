import { useState } from "react";
import { api } from "../api.js";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      setDone(await api("/auth/forgot", { method: "POST", body: { email } }));
    } catch (x) { setErr(x.message); }
    setBusy(false);
  }

  const back = () => { window.location.hash = ""; };

  return (
    <div className="cp-login">
      <form className="cp-login-card" onSubmit={submit}>
        <h1 className="cp-login-brand">CostPilot</h1>
        <p className="cp-login-sub">Forgot your password? Enter your email and we will create a reset link.</p>

        {!done ? (
          <>
            <label>Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
            </label>
            {err && <p className="cp-login-err" role="alert">{err}</p>}
            <button className="cp-primary" disabled={busy}>{busy ? "Please wait…" : "Send reset link"}</button>
          </>
        ) : (
          <>
            <p className="cp-login-sub" role="status">{done.message}</p>
            {done.link ? (
              <a className="cp-primary" style={{ textAlign: "center", textDecoration: "none" }} href={done.link}>Open reset page</a>
            ) : (
              <p className="cp-login-sub">No email service is set up yet. Run <code>docker compose logs backend</code> to find the link.</p>
            )}
          </>
        )}

        <button type="button" className="cp-link" onClick={back}>Back to sign in</button>
      </form>
    </div>
  );
}