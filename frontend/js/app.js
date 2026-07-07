// TRAt App Coordinator & Main Renderer
import { React, ReactDOM, html } from './react-config.js';
import API from './api.js';
import Navbar from './components/Navbar.js';
import AuthPage from './pages/AuthPage.js';
import Dashboard from './pages/Dashboard.js';
import DietPage from './pages/DietPage.js';
import StudyPage from './pages/StudyPage.js';
import AnalyticsPage from './pages/AnalyticsPage.js';
import ShareCardModal from './components/ShareCardModal.js';

const { useState, useEffect } = React;

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('dashboard');
  
  // Share Card Global States
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareTasks, setShareTasks] = useState([]);
  const [shareSessions, setShareSessions] = useState([]);
  const [shareStreaks, setShareStreaks] = useState(0);

  useEffect(() => {
    // Check if user is logged in
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const userData = await API.auth.me();
          setUser(userData);
        } catch (err) {
          console.error("Auth check failed:", err);
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };
    checkAuth();
    
    // Auth expired listener
    const handleAuthExpired = () => {
      setUser(null);
      setCurrentPage('dashboard');
    };
    window.addEventListener('auth_expired', handleAuthExpired);
    return () => window.removeEventListener('auth_expired', handleAuthExpired);
  }, []);

  const isSameDay = (date1, date2) => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  };

  const handleOpenShare = async () => {
    setIsShareOpen(true);
    try {
      const tasksData = await API.tasks.getAll();
      const sessionsData = await API.study.getSessions();
      setShareTasks(tasksData);
      setShareSessions(sessionsData);
      
      // Calculate daily completion streak in-memory for share card
      const today = new Date();
      let streak = 0;
      let checkDate = new Date(today);
      while (true) {
        const dayTasks = tasksData.filter(t => t.due_date && isSameDay(new Date(t.due_date), checkDate));
        const hasCompleted = dayTasks.length > 0 && dayTasks.every(t => t.status === 'done');
        if (hasCompleted) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          if (streak === 0 && checkDate.toDateString() === today.toDateString()) {
            checkDate.setDate(checkDate.getDate() - 1);
            continue;
          }
          break;
        }
      }
      setShareStreaks(streak);
    } catch (err) {
      console.error("Could not fetch fresh datasets for share card:", err);
    }
  };

  const handleLogout = () => {
    API.auth.logout();
  };

  if (loading) {
    return html`
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        <h2 className="text-xl font-bold font-title tracking-wider text-slate-300">TRAt Loading...</h2>
      </div>
    `;
  }

  return html`
    <div className="min-h-screen bg-darkbg text-slate-100 flex flex-col">
      <${Navbar} 
        user=${user} 
        onLogout=${handleLogout} 
        currentPage=${currentPage} 
        setCurrentPage=${setCurrentPage} 
        onOpenShare=${handleOpenShare} 
      />
      <main className="flex-grow">
        ${user ? html`
          ${currentPage === 'dashboard' && html`<${Dashboard} API=${API} />`}
          ${currentPage === 'diet' && html`<${DietPage} API=${API} />`}
          ${currentPage === 'study' && html`<${StudyPage} API=${API} />`}
          ${currentPage === 'analytics' && html`<${AnalyticsPage} API=${API} />`}
        ` : html`
          <${AuthPage} onAuthSuccess=${setUser} API=${API} />
        `}
      </main>
      
      <${ShareCardModal} 
        isOpen=${isShareOpen} 
        onClose=${() => setIsShareOpen(false)} 
        tasks=${shareTasks} 
        sessions=${shareSessions} 
        streaksCount=${shareStreaks} 
      />
    </div>
  `;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(html`<${App} />`);
