import { useState } from 'react';
import { getToken, clearToken } from './api.js';
import { useTheme } from './theme.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';

export default function App() {
  const [signedIn, setSignedIn] = useState(Boolean(getToken()));
  const [theme, toggleTheme] = useTheme();

  const handleSignedIn = () => setSignedIn(true);

  if (!signedIn) {
    // Your Login uses onSignedIn; the new Login also accepts onLogin, so pass both.
    return <Login onSignedIn={handleSignedIn} onLogin={handleSignedIn} />;
  }

  return (
    <Dashboard
      theme={theme}
      onToggleTheme={toggleTheme}
      onSignOut={() => {
        clearToken();
        setSignedIn(false);
      }}
    />
  );
}