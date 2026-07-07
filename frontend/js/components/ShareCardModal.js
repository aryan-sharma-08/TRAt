// TRAt Shareable Progress Cards Component
import { React, html } from '../react-config.js';
const { useState, useEffect, useRef } = React;

export default function ShareCardModal({ isOpen, onClose, tasks, sessions, streaksCount }) {
  const [showTasks, setShowTasks] = useState(true);
  const [showStudy, setShowStudy] = useState(true);
  const [showStreaks, setShowStreaks] = useState(true);
  const [theme, setTheme] = useState('dark'); // 'dark', 'sunset', 'emerald'
  const [aspectRatio, setAspectRatio] = useState('1:1'); // '1:1', '9:16', '16:9'
  
  const canvasRef = useRef(null);

  // Compile stats for today
  const stats = useEffect(() => {
    // Generate/Draw canvas every time an option changes
    if (isOpen) {
      setTimeout(drawCard, 100);
    }
  }, [isOpen, showTasks, showStudy, showStreaks, theme, aspectRatio]);

  const isSameDay = (date1, date2) => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  };

  // Stats calculators
  const taskStats = () => {
    const today = new Date();
    const todayTasks = tasks.filter(t => t.due_date && isSameDay(new Date(t.due_date), today));
    const total = todayTasks.length;
    const completed = todayTasks.filter(t => t.status === 'done').length;
    return { total, completed };
  };

  const studyStats = () => {
    const today = new Date();
    const todaySessions = sessions.filter(s => isSameDay(new Date(s.start_time), today));
    const hours = todaySessions.reduce((acc, curr) => acc + (curr.duration_seconds / 3600.0), 0);
    return { hours };
  };

  // Canvas drawing routine
  const drawCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Dimensions based on ratio selection
    let w = 1080, h = 1080;
    if (aspectRatio === '9:16') {
      w = 1080;
      h = 1920;
    } else if (aspectRatio === '16:9') {
      w = 1920;
      h = 1080;
    }

    canvas.width = w;
    canvas.height = h;

    // Clear Canvas
    ctx.clearRect(0, 0, w, h);

    // 1. Draw Background Gradient
    const grad = ctx.createLinearGradient(0, 0, w, h);
    if (theme === 'sunset') {
      grad.addColorStop(0, '#f97316'); // Orange-500
      grad.addColorStop(1, '#7c3aed'); // Purple-600
    } else if (theme === 'emerald') {
      grad.addColorStop(0, '#064e3b'); // Emerald-900
      grad.addColorStop(1, '#0f766e'); // Teal-700
    } else {
      // Dark Slate space
      grad.addColorStop(0, '#0b0f19'); // Dark background
      grad.addColorStop(1, '#1e1b4b'); // Indigo-950
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 2. Draw Subtle background decor circles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
    ctx.beginPath();
    ctx.arc(w / 3, h / 3, w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w - w / 4, h - h / 4, w / 3, 0, Math.PI * 2);
    ctx.fill();

    // 3. Draw Brand header
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    
    // T Logo icon box
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(80, 80, 110, 110, 24);
    ctx.fill();
    ctx.stroke();
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 70px Outfit, Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('T', 135, 160);

    // Brand Name Text
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'extrabold 56px Outfit, Inter, sans-serif';
    ctx.fillText('TRAt', 215, 130);
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.font = 'medium 26px Inter, sans-serif';
    ctx.fillText('TASK & ROUTINE ASSISTANT', 215, 170);

    // 4. Draw Cards for stats
    const tStats = taskStats();
    const sStats = studyStats();
    
    let currentY = aspectRatio === '9:16' ? 380 : 280;
    const cardGap = 40;
    const cardH = 200;
    const cardW = w - 160;

    const drawStatBox = (title, val, emoji) => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.roundRect(80, currentY, cardW, cardH, 24);
      ctx.fill();
      ctx.stroke();

      // Emoji
      ctx.font = '64px Inter, Apple Color Emoji, sans-serif';
      ctx.fillText(emoji, 130, currentY + 120);

      // Title
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = 'bold 24px Inter, sans-serif';
      ctx.fillText(title.toUpperCase(), 230, currentY + 75);

      // Value
      ctx.fillStyle = '#ffffff';
      ctx.font = 'extrabold 48px Outfit, Inter, sans-serif';
      ctx.fillText(val, 230, currentY + 140);

      currentY += cardH + cardGap;
    };

    if (showTasks) {
      drawStatBox('Tasks Checklist', `${tStats.completed} of ${tStats.total} Tasks Completed`, '✅');
    }
    if (showStudy) {
      drawStatBox('Intensive Study Tracker', `${sStats.hours.toFixed(1)} Hours Studied Today`, '📚');
    }
    if (showStreaks) {
      drawStatBox('Habit Streak', `${streaksCount} Days Streak Active`, '🔥');
    }

    // 5. Footer watermark
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = 'bold 22px Inter, sans-serif';
    ctx.fillText('Personal Routine & Productivity Card', w / 2, h - 110);
    ctx.font = 'medium 18px Inter, sans-serif';
    ctx.fillText('Build habits and log schedules at TRAt', w / 2, h - 80);
  };

  // Download Action
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `trat_progress_${new Date().toISOString().split('T')[0]}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Web Share Action
  const handleShare = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.toBlob(async (blob) => {
      const file = new File([blob], 'progress.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'My Daily Progress on TRAt',
            text: 'Here is my routine progress tracked with TRAt today!'
          });
        } catch (err) {
          console.warn('Native sharing failed or was aborted by user.');
        }
      } else {
        alert('Web Share API for images is not supported on this browser. Downloading image instead!');
        handleDownload();
      }
    }, 'image/png');
  };

  if (!isOpen) return null;

  return html`
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl glass-card rounded-2xl p-6 border border-white/10 animate-fade-in max-h-[95vh] overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        
        
        <div className="space-y-6">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <h3 className="font-extrabold font-title text-slate-200">Share Progress Card</h3>
            <button onClick=${onClose} className="text-slate-500 hover:text-slate-300 md:hidden">✕</button>
          </div>

          
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select Card Metrics</h4>
            <div className="space-y-2">
              <label className="flex items-center space-x-3 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked=${showTasks}
                  onChange=${(e) => setShowTasks(e.target.checked)}
                  className="w-4 h-4 rounded accent-primary-500"
                />
                <span>Include Task Adherence</span>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked=${showStudy}
                  onChange=${(e) => setShowStudy(e.target.checked)}
                  className="w-4 h-4 rounded accent-primary-500"
                />
                <span>Include Study Hours</span>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked=${showStreaks}
                  onChange=${(e) => setShowStreaks(e.target.checked)}
                  className="w-4 h-4 rounded accent-primary-500"
                />
                <span>Include Habit Streak</span>
              </label>
            </div>
          </div>

          
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select Theme</h4>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick=${() => setTheme('dark')}
                className=${`py-2 rounded-xl text-xs font-bold border ${theme === 'dark' ? 'bg-primary-600/10 border-primary-500 text-slate-200' : 'border-slate-800 text-slate-400'}`}
              >
                Dark Space
              </button>
              <button
                onClick=${() => setTheme('sunset')}
                className=${`py-2 rounded-xl text-xs font-bold border ${theme === 'sunset' ? 'bg-primary-600/10 border-primary-500 text-slate-200' : 'border-slate-800 text-slate-400'}`}
              >
                Sunset Glow
              </button>
              <button
                onClick=${() => setTheme('emerald')}
                className=${`py-2 rounded-xl text-xs font-bold border ${theme === 'emerald' ? 'bg-primary-600/10 border-primary-500 text-slate-200' : 'border-slate-800 text-slate-400'}`}
              >
                Emerald Calm
              </button>
            </div>
          </div>

          
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select Aspect Ratio</h4>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick=${() => setAspectRatio('1:1')}
                className=${`py-2 rounded-xl text-xs font-bold border ${aspectRatio === '1:1' ? 'bg-primary-600/10 border-primary-500 text-slate-200' : 'border-slate-800 text-slate-400'}`}
              >
                Square (1:1)
              </button>
              <button
                onClick=${() => setAspectRatio('9:16')}
                className=${`py-2 rounded-xl text-xs font-bold border ${aspectRatio === '9:16' ? 'bg-primary-600/10 border-primary-500 text-slate-200' : 'border-slate-800 text-slate-400'}`}
              >
                Story (9:16)
              </button>
              <button
                onClick=${() => setAspectRatio('16:9')}
                className=${`py-2 rounded-xl text-xs font-bold border ${aspectRatio === '16:9' ? 'bg-primary-600/10 border-primary-500 text-slate-200' : 'border-slate-800 text-slate-400'}`}
              >
                Landscape (16:9)
              </button>
            </div>
          </div>

          
          <div className="flex space-x-3 pt-6 border-t border-slate-800">
            <button
              onClick=${onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 font-bold text-xs"
            >
              Cancel
            </button>
            <div className="flex-1"></div>
            <button
              onClick=${handleDownload}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700"
            >
              Download PNG
            </button>
            <button
              onClick=${handleShare}
              className="px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs shadow-lg shadow-primary-600/20"
            >
              Share Card
            </button>
          </div>
        </div>

        
        <div className="flex flex-col items-center justify-center bg-slate-900/50 rounded-2xl border border-slate-850 p-4 min-h-[300px] relative">
          <button onClick=${onClose} className="absolute right-4 top-4 text-slate-500 hover:text-slate-300 hidden md:block">✕</button>
          
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Live Preview</span>
          
          <div className="w-full flex justify-center max-h-[60vh] overflow-hidden">
            <canvas
              ref=${canvasRef}
              className="max-w-full max-h-[50vh] object-contain shadow-2xl rounded-2xl border border-slate-700/60"
            ></canvas>
          </div>
        </div>

      </div>
    </div>
  `;
}
