// TRAt Navigation Bar Component
import { html } from '../react-config.js';

export default function Navbar({ user, onLogout, currentPage, setCurrentPage, onOpenShare }) {
  return html`
    <nav className="glass border-b border-darkborder sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center space-x-3 cursor-pointer" onClick=${() => user && setCurrentPage('dashboard')}>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-primary-500/20">
          <span className="font-extrabold font-title text-xl text-white">T</span>
        </div>
        <span className="font-extrabold font-title text-2xl tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-slate-100 to-slate-300">TRAt</span>
      </div>
      
      ${user && html`
        <div className="flex items-center space-x-6">
          <div className="hidden md:flex space-x-2">
            <button 
              onClick=${() => setCurrentPage('dashboard')}
              className=${`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                currentPage === 'dashboard' ? 'bg-primary-600/10 text-primary-500' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Tasks
            </button>
            <button 
              onClick=${() => setCurrentPage('diet')}
              className=${`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                currentPage === 'diet' ? 'bg-primary-600/10 text-primary-500' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Diet Tracker
            </button>
            <button 
              onClick=${() => setCurrentPage('study')}
              className=${`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                currentPage === 'study' ? 'bg-primary-600/10 text-primary-500' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Study Scheduler
            </button>
            <button 
              onClick=${() => setCurrentPage('analytics')}
              className=${`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                currentPage === 'analytics' ? 'bg-primary-600/10 text-primary-500' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Analytics
            </button>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="hidden sm:inline text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-800 text-slate-300 max-w-[180px] truncate border border-slate-700/50">
              ${user.email}
            </span>
            <button
              onClick=${onOpenShare}
              className="px-4 py-2 rounded-lg font-semibold text-sm bg-gradient-to-tr from-primary-600 to-indigo-500 hover:from-primary-500 hover:to-indigo-500 text-white transition-all duration-200 shadow-md shadow-primary-500/10"
            >
              Share Card
            </button>
            <button
              onClick=${onLogout}
              className="px-4 py-2 rounded-lg font-semibold text-sm bg-slate-800 hover:bg-slate-700 border border-slate-700/50 text-slate-200 transition-all duration-200 hover:border-red-500/30 hover:text-red-400"
            >
              Log Out
            </button>
          </div>
        </div>
      `}
    </nav>
  `;
}
