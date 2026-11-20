import { useState } from 'react';
import { getToken, clearToken } from './api.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';

export default function App() {
  const [signedIn, setSignedIn] = useState(Boolean(getToken()));

  if (!signedIn) return <Login onSignedIn={() => setSignedIn(true)} />;
  return (
    <Dashboard
      onSignOut={() => {
        clearToken();
        setSignedIn(false);
      }}
    />
  );
}
