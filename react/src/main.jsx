import { createRoot } from 'react-dom/client';
import App from './App.jsx';

import './styles/01-foundation.css';
import './styles/02-app-shell.css';
import './styles/03-map-and-teams.css';
import './styles/04-spirit-theme.css';
import './styles/05-admin-operations.css';
import './styles/06-feature-overrides.css';

createRoot(document.getElementById('root')).render(<App />);
