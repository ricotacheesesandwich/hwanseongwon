import { useEffect } from 'react';
import LoginView from './components/LoginView.jsx';
import AppShell from './components/AppShell.jsx';
import ModalRoot from './components/ModalRoot.jsx';
import { mountGameEngine } from './legacy/gameEngine.js';

export default function App() {
  useEffect(() => mountGameEngine(), []);

  return (
    <>
      <LoginView />
      <AppShell />
      <ModalRoot />
    </>
  );
}
