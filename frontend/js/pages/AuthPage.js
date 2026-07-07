// TRAt Auth Page Component
import { React, html } from '../react-config.js';
const { useState } = React;

export default function AuthPage({ onAuthSuccess, API }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      let user;
      if (isLogin) {
        user = await API.auth.login(email, password);
      } else {
        user = await API.auth.register(email, password);
      }
      onAuthSuccess(user);
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return html`
    <div className="relative flex items-center justify-center min-h-[calc(100vh-80px)] px-4">
      
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-primary-600/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md glass-card rounded-2xl p-8 border border-white/5 animate-fade-in relative z-10">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold font-title bg-clip-text text-transparent bg-gradient-to-r from-slate-100 to-indigo-200">
            ${isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-slate-400 mt-2 text-sm">
            ${isLogin ? 'Manage your daily routines and tasks with ease' : 'Join TRAt and streamline your study, diet, and routines'}
          </p>
        </div>

        ${error && html`
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3 text-sm mb-6 flex items-start space-x-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>${error}</span>
          </div>
        `}

        <form onSubmit=${handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Email Address</label>
            <div className="relative">
              <input
                type="email"
                value=${email}
                onInput=${(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl glass-input pl-10 focus:ring-2 focus:ring-primary-500/30 transition-all duration-200"
                required
              />
              <svg className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.206" />
              </svg>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Password</label>
            <div className="relative">
              <input
                type="password"
                value=${password}
                onInput=${(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl glass-input pl-10 focus:ring-2 focus:ring-primary-500/30 transition-all duration-200"
                required
              />
              <svg className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>

          <button
            type="submit"
            disabled=${loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-primary-600/30 active:scale-[0.99] transition-all duration-150 flex items-center justify-center space-x-2"
          >
            ${loading ? html`
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ` : html`
              <${React.Fragment}>
                <span>${isLogin ? 'Log In' : 'Sign Up'}</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </${React.Fragment}>
            `}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-800 text-center">
          <p className="text-sm text-slate-400">
            ${isLogin ? "Don't have an account?" : 'Already have an account?'}
            <button
              onClick=${() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="ml-1.5 text-primary-500 hover:text-primary-400 font-bold focus:outline-none transition-colors"
            >
              ${isLogin ? 'Create one' : 'Log in here'}
            </button>
          </p>
        </div>
      </div>
    </div>
  `;
}
