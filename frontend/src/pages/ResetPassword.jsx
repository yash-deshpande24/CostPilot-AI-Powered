import { useState } from "react";
import { api } from "../api.js";
import { toast } from "../toast.js";

export default function ResetPassword({ token }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (pw.length < 8) return setErr("Password needs at least 8 characters.");
    if (pw !== pw2) return setErr("The two passwords do not match.");
    setBusy(true);
    try {
      await api("/auth/reset", { method: "POST", body: { token, password: pw } });
      toast("Password changed successfully.");
      setDone(true);
    } catch (x) { setErr(x.message); }
    setBusy(false);
  }

  const toSignIn = () => { window.location.hash = ""; };

  return (
    <div className="cp-login">
      <form className="cp-login-card" onSubmit={submit}>
        <h1 className="cp-login-brand">CostPilot</h1>
        {done ? (
          <>
            <p className="cp-login-sub" role="status">Your password was changed. You can sign in now.</p>
            <button type="button" className="cp-primary" onClick={toSignIn}>Go to sign in</button>
          </>
        ) : (
          <>
            <p className="cp-login-sub">Choose a new password (8+ characters).</p>
            <label>New password
              <span className="cp-pw">
                <input type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" required />
                <button type="button" onClick={() => setShow(!show)}>{show ? "Hide" : "Show"}</button>
              </span>
            </label>
            <label>Confirm new password
              <input type={show ? "text" : "password"} value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" required />
            </label>
            {err && <p className="cp-login-err" role="alert">{err}</p>}
            <button className="cp-primary" disabled={busy}>{busy ? "Saving…" : "Change password"}</button>
            <button type="button" className="cp-link" onClick={toSignIn}>Back to sign in</button>
          </>
        )}
      </form>
    </div>
  );
}