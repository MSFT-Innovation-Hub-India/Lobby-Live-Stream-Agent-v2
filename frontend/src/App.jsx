import LobbyDashboard from './components/LobbyDashboard';
import AgentChat from './components/AgentChat';
import './App.css';

function App() {
  const path = window.location.pathname;
  if (path === '/agent') return <AgentChat />;
  return <LobbyDashboard />;
}

export default App;
