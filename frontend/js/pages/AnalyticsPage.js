// TRAt Analytics Dashboard Page Component
import { React, html } from '../react-config.js';
const { useState, useEffect, useMemo } = React;

export default function AnalyticsPage({ API }) {
  const [tasks, setTasks] = useState([]);
  const [diets, setDiets] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const tasksData = await API.tasks.getAll();
      setTasks(tasksData);
      
      const subsData = await API.study.getSubjects();
      setSubjects(subsData);
      
      const sessionsData = await API.study.getSessions();
      setSessions(sessionsData);

      // Fetch diet entries for the last 7 days to compile nutrition metrics
      const dietPromises = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        dietPromises.push(API.diet.getAll(dateStr).catch(() => []));
      }
      const dietResults = await Promise.all(dietPromises);
      setDiets(dietResults.flat());
    } catch (err) {
      setError('Could not retrieve analytics data.');
    } finally {
      setLoading(false);
    }
  };

  // Helper: compare dates only
  const isSameDay = (date1, date2) => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  };

  // 1. Task Completion Stats over the Last 7 Days (SVG Bar Chart Data)
  const taskChartData = useMemo(() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayTasks = tasks.filter(t => t.due_date && isSameDay(new Date(t.due_date), date));
      const total = dayTasks.length;
      const completed = dayTasks.filter(t => t.status === 'done').length;
      const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
      
      data.push({
        label: date.toLocaleDateString(undefined, { weekday: 'short' }),
        percent,
        total,
        completed
      });
    }
    return data;
  }, [tasks]);

  // 2. Study Subject Distribution: Actual vs Planned Hours
  const studyChartData = useMemo(() => {
    const data = [];
    subjects.forEach(sub => {
      const matchedSessions = sessions.filter(s => s.subject_name === sub.name);
      const actualHours = matchedSessions.reduce((acc, curr) => acc + (curr.duration_seconds / 3600.0), 0);
      data.push({
        name: sub.name,
        target: sub.target_hours,
        actual: actualHours,
        priority: sub.priority
      });
    });
    return data;
  }, [subjects, sessions]);

  // 3. Consolidated Streak Counters
  const streaks = useMemo(() => {
    const today = new Date();
    
    // Task Streak (days with 100% completion)
    let taskStreak = 0;
    let checkDate = new Date(today);
    while (true) {
      const dayTasks = tasks.filter(t => t.due_date && isSameDay(new Date(t.due_date), checkDate));
      const hasCompleted = dayTasks.length > 0 && dayTasks.every(t => t.status === 'done');
      if (hasCompleted) {
        taskStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        if (taskStreak === 0 && checkDate.toDateString() === today.toDateString()) {
          checkDate.setDate(checkDate.getDate() - 1);
          continue; // Allow yesterday to hold the streak if today is in progress
        }
        break;
      }
    }

    // Study Streak (days with at least 1 study session logged)
    let studyStreak = 0;
    checkDate = new Date(today);
    while (true) {
      const hasStudied = sessions.some(s => isSameDay(new Date(s.start_time), checkDate));
      if (hasStudied) {
        studyStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        if (studyStreak === 0 && checkDate.toDateString() === today.toDateString()) {
          checkDate.setDate(checkDate.getDate() - 1);
          continue;
        }
        break;
      }
    }

    // Diet Adherence Streak (days with at least 3 logged meals checked done)
    let dietStreak = 0;
    checkDate = new Date(today);
    while (true) {
      const dayMeals = diets.filter(d => isSameDay(new Date(d.date), checkDate));
      const eatenCount = dayMeals.filter(m => m.status === 'done').length;
      if (eatenCount >= 3) {
        dietStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        if (dietStreak === 0 && checkDate.toDateString() === today.toDateString()) {
          checkDate.setDate(checkDate.getDate() - 1);
          continue;
        }
        break;
      }
    }

    return {
      tasks: taskStreak,
      study: studyStreak,
      diet: dietStreak
    };
  }, [tasks, sessions, diets]);

  // Overall KPI cards
  const summaryKPIs = useMemo(() => {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const taskAdherence = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    const totalHoursStudied = sessions.reduce((acc, curr) => acc + (curr.duration_seconds / 3600.0), 0);
    const averageSessionMins = sessions.length === 0 ? 0 : Math.round((totalHoursStudied * 60) / sessions.length);

    return {
      taskAdherence,
      totalHoursStudied,
      averageSessionMins,
      loggedSessionsCount: sessions.length
    };
  }, [tasks, sessions]);

  return html`
    <div className="max-w-7xl mx-auto px-4 py-8 md:px-8">
      
      ${error && html`
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3 text-sm mb-6 flex justify-between items-center">
          <span>${error}</span>
          <button onClick=${() => setError('')} className="text-red-400 hover:text-red-300 font-bold focus:outline-none">✕</button>
        </div>
      `}

      
      <div className="glass-card rounded-2xl p-6 border border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-extrabold font-title tracking-wider text-slate-100">Productivity & Habits Analytics</h2>
          <p className="text-xs text-slate-400 mt-1">Unified view of task success, intensive learning hours, and health habit metrics</p>
        </div>
      </div>

      ${loading ? html`
        <div className="flex justify-center items-center h-96">
          <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ` : html`
        <div className="space-y-8 animate-fade-in">
          
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="glass-card rounded-2xl p-5 border border-white/5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Task Adherence</span>
              <div className="text-3xl font-black font-title text-slate-200">${summaryKPIs.taskAdherence}%</div>
              <span className="text-[10px] text-slate-400 mt-1.5 block">Lifetime completion percentage</span>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-white/5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Hours Studied</span>
              <div className="text-3xl font-black font-title text-indigo-400">${summaryKPIs.totalHoursStudied.toFixed(1)}h</div>
              <span className="text-[10px] text-slate-400 mt-1.5 block">Total logged study hours</span>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-white/5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Average Study Duration</span>
              <div className="text-3xl font-black font-title text-emerald-400">${summaryKPIs.averageSessionMins}m</div>
              <span className="text-[10px] text-slate-400 mt-1.5 block">Average duration of logged focus blocks</span>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-white/5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Study Sessions</span>
              <div className="text-3xl font-black font-title text-orange-400">${summaryKPIs.loggedSessionsCount} Logs</div>
              <span className="text-[10px] text-slate-400 mt-1.5 block">Individual sessions completed</span>
            </div>
          </div>

          
          <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-5">
            <h3 className="text-lg font-bold font-title text-slate-200 border-b border-slate-800 pb-3">Active Habit Streaks</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-center space-x-4 p-4 rounded-xl bg-slate-800/10 border border-slate-800/40">
                <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-2xl">🔥</div>
                <div>
                  <div className="text-xl font-extrabold text-orange-500">${streaks.tasks} Days</div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Task Checklist Streak</span>
                </div>
              </div>

              <div className="flex items-center space-x-4 p-4 rounded-xl bg-slate-800/10 border border-slate-800/40">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-2xl">📚</div>
                <div>
                  <div className="text-xl font-extrabold text-indigo-400">${streaks.study} Days</div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Focus Study Streak</span>
                </div>
              </div>

              <div className="flex items-center space-x-4 p-4 rounded-xl bg-slate-800/10 border border-slate-800/40">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-2xl">🥗</div>
                <div>
                  <div className="text-xl font-extrabold text-emerald-400">${streaks.diet} Days</div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">3+ Meals Adherence Streak</span>
                </div>
              </div>
            </div>
          </div>

          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            
            <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-4">
              <h3 className="text-lg font-bold font-title text-slate-200 border-b border-slate-800 pb-3">
                Task Completion Trend (Past 7 Days)
              </h3>
              
              <div className="flex justify-center items-end h-64 pt-6">
                <svg className="w-full h-full max-h-[220px]" viewBox="0 0 500 220" preserveAspectRatio="none">
                  
                  <line x1="40" y1="20" x2="480" y2="20" stroke="#1e293b" strokeWidth="1" strokeDasharray="3,3" />
                  <line x1="40" y1="100" x2="480" y2="100" stroke="#1e293b" strokeWidth="1" strokeDasharray="3,3" />
                  <line x1="40" y1="180" x2="480" y2="180" stroke="#1e293b" strokeWidth="1" />

                  
                  ${taskChartData.map((item, idx) => {
                    const barWidth = 35;
                    const xGap = (440 - barWidth * 7) / 6;
                    const x = 40 + idx * (barWidth + xGap);
                    const barHeight = Math.max(4, (item.percent / 100) * 160);
                    const y = 180 - barHeight;

                    return html`
                      <g key=${idx}>
                        
                        <rect x=${x} y="20" width=${barWidth} height="160" rx="4" fill="rgba(30, 41, 59, 0.2)" />
                        
                        <rect 
                          x=${x} 
                          y=${y} 
                          width=${barWidth} 
                          height=${barHeight} 
                          rx="4" 
                          fill="url(#indigoGrad)" 
                          className="transition-all duration-500"
                        />
                        
                        <text x=${x + barWidth / 2} y=${y - 6} fill="#a5b4fc" fontSize="9" fontWeight="bold" textAnchor="middle">
                          ${item.percent}%
                        </text>
                        
                        <text x=${x + barWidth / 2} y="205" fill="#64748b" fontSize="10" fontWeight="bold" textAnchor="middle">
                          ${item.label}
                        </text>
                      </g>
                    `;
                  })}
                  
                  
                  <defs>
                    <linearGradient id="indigoGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#818cf8" />
                      <stop offset="100%" stopColor="#4f46e5" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>

            
            <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-5">
              <h3 className="text-lg font-bold font-title text-slate-200 border-b border-slate-800 pb-3">
                Subject Study Performance (Tracked vs Target Hours)
              </h3>

              ${studyChartData.length === 0 ? html`
                <p className="text-xs text-slate-500 text-center py-12 italic">
                  No subject configurations found. Create subjects in the Study tab to view progress bars.
                </p>
              ` : html`
                <div className="space-y-5 py-2 overflow-y-auto max-h-[220px] pr-1">
                  ${studyChartData.map((item, idx) => {
                    const pct = item.target === 0 ? 0 : Math.round((item.actual / item.target) * 100);

                    return html`
                      <div key=${idx} className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs font-semibold">
                          <div className="flex items-center space-x-2">
                            <span className="text-slate-200">${item.name}</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded border border-slate-700 bg-slate-800/60 text-slate-400">
                              Target: ${item.target}h
                            </span>
                          </div>
                          <span className="text-indigo-400 font-bold">
                            Studied: ${item.actual.toFixed(1)}h (${pct}%)
                          </span>
                        </div>
                        
                        <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50 relative">
                          <div 
                            className="h-full bg-gradient-to-r from-primary-500 to-indigo-500 rounded-full transition-all duration-500" 
                            style=${{ width: `${Math.min(100, pct)}%` }}
                          ></div>
                        </div>
                      </div>
                    `;
                  })}
                </div>
              `}
            </div>

          </div>

        </div>
      `}
    </div>
  `;
}
