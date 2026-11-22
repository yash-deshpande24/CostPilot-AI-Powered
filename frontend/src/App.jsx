import { useEffect, useState } from 'react';
import { getToken, clearToken } from './api.js';
import { useTheme } from './theme.js';
import { toast } from './toast.js';
import Toaster from './components/Toaster.jsx';
import Login from './pages/Login.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';

export default function App() {
  const [signedIn, setSignedIn] = useState(Boolean(getToken()));
  const [theme, toggleTheme] = useTheme();
  const [hash, setHash] = useState(window.location.hash.slice(1));

  useEffect(() => {
    const onHash = () => setHash(window.location.hash.slice(1));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // After login, always open the Home page first.
  const handleSignedIn = () => {
    window.location.hash = 'home';
    setSignedIn(true);
  };

  // Called with 'expired' when the server rejects the token. Button clicks pass no text.
  const handleSignOut = (reason) => {
    clearToken();
    window.location.hash = '';
    setSignedIn(false);
    if (reason === 'expired') toast('Your session expired. Please sign in again.', 'info');
    else toast('Signed out successfully.');
  };

  let page;
  if (!signedIn) {
    if (hash === 'forgot') page = <ForgotPassword />;
    else if (hash.startsWith('reset/')) page = <ResetPassword token={hash.slice(6)} />;
    else page = <Login onSignedIn={handleSignedIn} onLogin={handleSignedIn} />;
  } else {
    page = <Dashboard theme={theme} onToggleTheme={toggleTheme} onSignOut={handleSignOut} />;
  }

  return (
    <>
      {page}
      <Toaster />
    </>
  );
}