// TRAt Study Scheduler & Focus Timer Page Component
import { React, html } from '../react-config.js';
const { useState, useEffect, useMemo, useRef } = React;

export default function StudyPage({ API }) {
  const [subjects, setSubjects] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Subject CRUD states
  const [showSubModal, setShowSubModal] = useState(false);
  const [subName, setSubName] = useState('');
  const [subTarget, setSubTarget] = useState(2.0);
  const [subPriority, setSubPriority] = useState('Medium');
  const [subExamDate, setSubExamDate] = useState('');

  // Time Tracker (Timer) States
  const [activeSubject, setActiveSubject] = useState(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerStartTime, setTimerStartTime] = useState(null);
  const [isFocusMode, setIsFocusMode] = useState(false);
  
  // Pomodoro Interval states
  const [pomodoroLength, setPomodoroLength] = useState(25); // Minutes
  const [timerMode, setTimerMode] = useState('stopwatch'); // 'stopwatch', 'pomodoro'
  const intervalId = useRef(null);

  // AI Rebalance States
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiGoals, setAiGoals] = useState('Prepare for final examinations');
  const [rebalancing, setRebalancing] = useState(false);
  const [proposal, setProposal] = useState(null); // Rebalance proposal object

  useEffect(() => {
    fetchStudyData();
  }, []);

  const fetchStudyData = async () => {
    try {
      setLoading(true);
      const subsData = await API.study.getSubjects();
      setSubjects(subsData);
      
      const blocksData = await API.study.getBlocks();
      setBlocks(blocksData);
      
      const sessionsData = await API.study.getSessions();
      setSessions(sessionsData);
    } catch (err) {
      setError('Could not retrieve study information.');
    } finally {
      setLoading(false);
    }
  };

  // Timer Tick coordination
  useEffect(() => {
    if (isTimerRunning) {
      intervalId.current = setInterval(() => {
        setTimerSeconds(prev => {
          if (timerMode === 'pomodoro' && prev <= 1) {
            // Pomodoro finished!
            setIsTimerRunning(false);
            clearInterval(intervalId.current);
            handleFinishSession();
            playNotificationSound();
            triggerBrowserAlert('Pomodoro Session Complete!', 'Time to take a short break.');
            return 0;
          }
          return timerMode === 'pomodoro' ? prev - 1 : prev + 1;
        });
      }, 1000);
    } else {
      if (intervalId.current) clearInterval(intervalId.current);
    }
    return () => { if (intervalId.current) clearInterval(intervalId.current); };
  }, [isTimerRunning, timerMode]);

  const triggerBrowserAlert = (title, body) => {
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/static/js/logo-192.png' });
    }
  };

  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(520, audioCtx.currentTime); // C5 note
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.warn('Audio Context sound play blocked by browser.');
    }
  };

  // Start Tracker
  const handleStartSession = () => {
    if (!activeSubject) {
      alert('Please select a subject first!');
      return;
    }
    
    setTimerStartTime(new Date());
    if (timerMode === 'pomodoro') {
      setTimerSeconds(pomodoroLength * 60);
    } else {
      setTimerSeconds(0);
    }
    setIsTimerRunning(true);
    setIsFocusMode(true); // Enter immersive focus mode
  };

  // Stop Timer & Save log
  const handleFinishSession = async () => {
    setIsTimerRunning(false);
    setIsFocusMode(false);
    
    const endTime = new Date();
    const duration = timerMode === 'pomodoro' 
      ? (pomodoroLength * 60 - timerSeconds) 
      : timerSeconds;

    if (duration < 10) {
      alert('Study session was too short (under 10 seconds). Session not logged.');
      setTimerSeconds(0);
      return;
    }

    const matchedSubject = subjects.find(s => s.name === activeSubject);

    const sessionLog = {
      subject_id: matchedSubject ? matchedSubject.id : null,
      subject_name: activeSubject,
      start_time: timerStartTime.toISOString(),
      end_time: endTime.toISOString(),
      duration_seconds: duration
    };

    try {
      const savedSession = await API.study.logSession(sessionLog);
      setSessions(prev => [savedSession, ...prev]);
      alert(`Logged: Studied ${matchedSubject ? matchedSubject.name : activeSubject} for ${Math.round(duration/60)} minutes.`);
    } catch (err) {
      setError('Failed to log tracked study session.');
    } finally {
      setTimerSeconds(0);
      setTimerStartTime(null);
    }
  };

  // Cancel tracking
  const handleCancelSession = () => {
    if (confirm('Discard this study session?')) {
      setIsTimerRunning(false);
      setIsFocusMode(false);
      setTimerSeconds(0);
      setTimerStartTime(null);
    }
  };

  // Create Subject
  const handleCreateSubject = async (e) => {
    e.preventDefault();
    if (!subName.trim()) return;

    const newSubData = {
      name: subName,
      target_hours: parseFloat(subTarget) || 2.0,
      priority: subPriority,
      exam_date: subExamDate ? new Date(subExamDate).toISOString() : null
    };

    try {
      const created = await API.study.createSubject(newSubData);
      setSubjects(prev => [...prev, created]);
      setSubName('');
      setSubExamDate('');
      setShowSubModal(false);
    } catch (err) {
      setError('Failed to create study subject.');
    }
  };

  // Delete Subject
  const handleDeleteSubject = async (id) => {
    if (!confirm('Delete this subject and all its sessions?')) return;
    try {
      await API.study.deleteSubject(id);
      setSubjects(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      setError('Failed to delete subject.');
    }
  };

  // Ask Gemini to Rebalance Study Schedule
  const handleAIRebalance = async (e) => {
    e.preventDefault();
    setRebalancing(true);
    setProposal(null);
    setError('');

    try {
      const data = await API.ai.rebalanceStudy(aiGoals);
      setProposal(data);
    } catch (err) {
      setError('Gemini failed to rebalance schedule.');
    } finally {
      setRebalancing(false);
    }
  };

  // Apply AI rebalance plan
  const handleApplyRebalance = async () => {
    if (!proposal) return;

    try {
      setLoading(true);
      
      // 1. Update target hours of matching subjects
      const updatePromises = proposal.rebalanced_target_hours.map(item => {
        const match = subjects.find(s => s.name.toLowerCase() === item.subject_name.toLowerCase());
        if (match) {
          return API.study.updateSubject(match.id, { target_hours: item.target_hours });
        }
        return Promise.resolve(null);
      });

      // 2. Clear old blocks and save proposed new blocks
      const clearBlockPromises = blocks.map(b => API.study.deleteBlock(b.id));
      await Promise.all([...updatePromises, ...clearBlockPromises]);

      const createBlockPromises = proposal.proposed_blocks.map(b => {
        return API.study.createBlock({
          subject_name: b.subject_name,
          start_time: b.start_time,
          end_time: b.end_time,
          day_of_week: b.day_of_week
        });
      });

      const newBlocks = await Promise.all(createBlockPromises);
      setBlocks(newBlocks);
      
      // Reload subjects to reflect updated targets
      const reloadedSubs = await API.study.getSubjects();
      setSubjects(reloadedSubs);

      setShowAIModal(false);
      setProposal(null);
      alert('AI Rebalancing study schedule applied successfully!');
    } catch (err) {
      setError('Failed to apply AI rebalancing slots.');
    } finally {
      setLoading(false);
    }
  };

  // Helper formatting hh:mm:ss
  const formatTime = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Summarize actual studied hours per subject
  const subjectStats = useMemo(() => {
    const map = {};
    subjects.forEach(s => {
      map[s.name] = { target: s.target_hours, actual: 0.0, priority: s.priority };
    });

    sessions.forEach(s => {
      if (map[s.subject_name]) {
        map[s.subject_name].actual += s.duration_seconds / 3600.0;
      }
    });

    return map;
  }, [subjects, sessions]);

  // Days of week names for block parsing
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return html`
    <div className="max-w-7xl mx-auto px-4 py-8 md:px-8">
      
      
      ${isFocusMode && html`
        <div className="fixed inset-0 bg-slate-950/98 z-50 flex flex-col items-center justify-center p-6 animate-fade-in">
          <div className="text-center space-y-8 max-w-lg">
            <span className="text-xs font-black uppercase tracking-widest text-primary-500 bg-primary-500/10 px-3 py-1 rounded-full pulse-glow">
              Focus Session Active
            </span>
            
            <div>
              <h2 className="text-5xl font-black font-title text-slate-100 tracking-wider">
                ${activeSubject}
              </h2>
              <p className="text-sm text-slate-500 mt-2 italic">Hustle hard. No distractions.</p>
            </div>

            <div className="text-7xl md:text-8xl font-black text-slate-200 tracking-widest font-mono select-none">
              ${formatTime(timerSeconds)}
            </div>

            <div className="flex justify-center space-x-4">
              <button
                onClick=${handleCancelSession}
                className="px-6 py-3 rounded-xl border border-red-500/20 bg-red-950/20 text-red-400 font-bold hover:bg-red-950/40 text-sm transition-all"
              >
                Discard
              </button>
              <button
                onClick=${handleFinishSession}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 text-white font-bold text-sm transition-all shadow-lg shadow-primary-500/20"
              >
                Finish Session
              </button>
            </div>
          </div>
        </div>
      `}

      ${error && html`
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3 text-sm mb-6 flex justify-between items-center">
          <span>${error}</span>
          <button onClick=${() => setError('')} className="text-red-400 hover:text-red-300 font-bold focus:outline-none">✕</button>
        </div>
      `}

      
      <div className="glass-card rounded-2xl p-6 border border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-extrabold font-title tracking-wider text-slate-100">Study Scheduler & Timers</h2>
          <p className="text-xs text-slate-400 mt-1">Design intensive 10-12 hours/day routine structures and log study times</p>
        </div>

        <div className="flex space-x-3">
          <button
            onClick=${() => setShowSubModal(true)}
            className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold text-xs"
          >
            + Add Subject
          </button>
          
          <button
            onClick=${() => setShowAIModal(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-accent to-emerald-600 text-white font-bold text-xs tracking-wider shadow-lg shadow-emerald-500/20 flex items-center space-x-1.5"
          >
            <span>AI Scheduler Rebalance</span>
            <span>✨</span>
          </button>
        </div>
      </div>

      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        
        <div className="space-y-6 lg:col-span-1">
          
          
          <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-6 text-center relative">
            <h3 className="text-lg font-bold font-title text-slate-200 border-b border-slate-800 pb-3 text-left">Focus Control</h3>
            
            
            <div className="flex bg-slate-800/40 p-1 rounded-lg max-w-[200px] mx-auto border border-slate-700/40">
              <button
                onClick=${() => setTimerMode('stopwatch')}
                className=${`flex-1 py-1 rounded text-[10px] font-bold ${timerMode === 'stopwatch' ? 'bg-primary-600 text-white' : 'text-slate-400'}`}
              >
                Stopwatch
              </button>
              <button
                onClick=${() => setTimerMode('pomodoro')}
                className=${`flex-1 py-1 rounded text-[10px] font-bold ${timerMode === 'pomodoro' ? 'bg-primary-600 text-white' : 'text-slate-400'}`}
              >
                Pomodoro
              </button>
            </div>

            
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 text-left">Subject</label>
              <select
                value=${activeSubject || ''}
                onChange=${(e) => setActiveSubject(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg glass-input"
              >
                <option value="">Select Subject to Track...</option>
                ${subjects.map(s => html`
                  <option key=${s.id} value=${s.name}>${s.name}</option>
                `)}
              </select>
            </div>

            
            ${timerMode === 'pomodoro' && html`
              <div className="flex justify-center items-center space-x-3 text-xs text-slate-400">
                <span>Duration:</span>
                <input
                  type="number"
                  min="5"
                  max="120"
                  value=${pomodoroLength}
                  onChange=${(e) => setPomodoroLength(parseInt(e.target.value) || 25)}
                  className="w-16 px-2 py-1 rounded glass-input text-center font-bold"
                />
                <span>mins</span>
              </div>
            `}

            
            <div className="text-5xl font-black text-slate-300 font-mono tracking-widest py-3">
              ${timerMode === 'pomodoro' && !isTimerRunning ? formatTime(pomodoroLength * 60) : formatTime(timerSeconds)}
            </div>

            <button
              onClick=${handleStartSession}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 text-white font-bold text-xs tracking-wider shadow-lg shadow-primary-600/30"
            >
              Start Focus Session
            </button>
          </div>

          
          <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-4">
            <h3 className="text-lg font-bold font-title text-slate-200 border-b border-slate-800 pb-3">Subjects & Daily Targets</h3>
            
            ${subjects.length === 0 ? html`
              <p className="text-xs text-slate-500 text-center py-4 italic">No subjects added. Click "+ Add Subject" to get started.</p>
            ` : html`
              <div className="space-y-3">
                ${subjects.map(sub => {
                  const stat = subjectStats[sub.name] || { target: sub.target_hours, actual: 0 };
                  const percent = stat.target === 0 ? 0 : Math.round((stat.actual / stat.target) * 100);

                  return html`
                    <div key=${sub.id} className="p-3.5 rounded-xl bg-slate-800/10 border border-slate-800/40 flex justify-between items-center group">
                      <div className="flex-1 min-w-0 mr-4">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-bold text-sm text-slate-200 truncate">${sub.name}</h4>
                          <span className=${`text-[9px] px-1.5 rounded font-black border ${
                            sub.priority === 'High' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                            sub.priority === 'Medium' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                            'bg-green-500/10 text-green-400 border-green-500/20'
                          }`}>
                            ${sub.priority}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-3 text-[10px] text-slate-500 mt-1">
                          <span>Target: ${sub.target_hours}h/day</span>
                          <span className="text-indigo-400 font-semibold">Tracked: ${stat.actual.toFixed(1)}h</span>
                        </div>

                        <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                          <div className="h-full bg-primary-500 rounded-full" style=${{ width: `${Math.min(100, percent)}%` }}></div>
                        </div>
                      </div>

                      <button
                        onClick=${() => handleDeleteSubject(sub.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 rounded transition-all"
                      >
                        🗑️
                      </button>
                    </div>
                  `;
                })}
              </div>
            `}
          </div>

        </div>

        
        <div className="lg:col-span-2 space-y-6">
          
          <div className="glass-card rounded-2xl p-6 border border-white/5 min-h-[500px] space-y-6">
            <div className="flex justify-between items-center border-b border-slate-800/60 pb-3">
              <h3 className="font-bold text-slate-200 font-title text-lg">Weekly Block Schedule</h3>
              <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded-md">
                ${blocks.length} Blocks Configured
              </span>
            </div>

            ${blocks.length === 0 ? html`
              <div className="flex flex-col items-center justify-center h-80 text-center">
                <span className="text-4xl mb-3">📅</span>
                <h4 className="text-slate-300 font-bold font-title">No Slots Configured</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Use "AI Scheduler Rebalance" to automatically design a time-blocked study slot sequence based on exam dates and targets!
                </p>
              </div>
            ` : html`
              <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                ${daysOfWeek.map((dayName, dayIdx) => {
                  const dayBlocks = blocks.filter(b => b.day_of_week === dayIdx).sort((a,b) => a.start_time.localeCompare(b.start_time));

                  return html`
                    <div key=${dayName} className="rounded-xl border border-slate-800 bg-slate-900/10 p-3 flex flex-col min-h-[220px]">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3 text-center border-b border-slate-850 pb-1">
                        ${dayName.slice(0,3)}
                      </span>
                      
                      <div className="space-y-2 flex-1 overflow-y-auto max-h-[200px] pr-0.5">
                        ${dayBlocks.length === 0 ? html`
                          <span className="text-[9px] text-slate-600 italic block text-center mt-8">Empty</span>
                        ` : html`
                          ${dayBlocks.map(block => html`
                            <div key=${block.id} className="p-1.5 rounded bg-slate-850 border border-slate-800 text-[10px] text-slate-200 relative group">
                              <div className="font-bold truncate">${block.subject_name}</div>
                              <div className="text-[8px] text-slate-500 mt-0.5">${block.start_time} - ${block.end_time}</div>
                              
                              <button
                                onClick=${async () => {
                                  try {
                                    await API.study.deleteBlock(block.id);
                                    setBlocks(prev => prev.filter(b => b.id !== block.id));
                                  } catch (e) {
                                    alert('Failed to delete block.');
                                  }
                                }}
                                className="absolute right-1 top-1 text-[8px] text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100"
                              >
                                ✕
                              </button>
                            </div>
                          `)}
                        `}
                      </div>
                    </div>
                  `;
                })}
              </div>
            `}
          </div>

        </div>

      </div>

      
      ${showSubModal && html`
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-card rounded-2xl p-6 border border-white/10 animate-fade-in">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
              <h3 className="font-extrabold font-title text-slate-200">Add Study Subject</h3>
              <button onClick=${() => setShowSubModal(false)} className="text-slate-500 hover:text-slate-300">✕</button>
            </div>

            <form onSubmit=${handleCreateSubject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Subject Name</label>
                <input
                  type="text"
                  placeholder="e.g. Physics, Data Structures"
                  value=${subName}
                  onInput=${(e) => setSubName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg glass-input"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Target Hours/Day</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="12"
                    value=${subTarget}
                    onChange=${(e) => setSubTarget(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs rounded-lg glass-input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Priority</label>
                  <select
                    value=${subPriority}
                    onChange=${(e) => setSubPriority(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs rounded-lg glass-input"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Exam Date (optional)</label>
                <input
                  type="date"
                  value=${subExamDate}
                  onChange=${(e) => setSubExamDate(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs rounded-lg glass-input"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs tracking-wider transition-colors mt-4"
              >
                Create Subject
              </button>
            </form>
          </div>
        </div>
      `}

      
      ${showAIModal && html`
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl glass-card rounded-2xl p-6 border border-white/10 animate-fade-in max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-5">
              <div className="flex items-center space-x-2">
                <span className="text-xl">✨</span>
                <h3 className="font-extrabold font-title text-lg text-slate-200">Gemini Intensive Study Planner</h3>
              </div>
              <button onClick=${() => { setShowAIModal(false); setProposal(null); }} className="text-slate-500 hover:text-slate-300">✕</button>
            </div>

            ${!proposal ? html`
              <form onSubmit=${handleAIRebalance} className="space-y-4">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Gemini will analyze your subject target parameters, exam deadlines, and actual study logs to structure a balanced weekly block schedule totaling 10-12 hours per day.
                </p>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Current Study Goals / Target Exam Focus</label>
                  <textarea
                    placeholder="e.g. Master algorithms before my exam on July 20th; prioritize Mathematics."
                    value=${aiGoals}
                    onInput=${(e) => setAiGoals(e.target.value)}
                    rows="3"
                    className="w-full px-3 py-2 text-xs rounded-lg glass-input resize-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled=${rebalancing}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-accent to-emerald-600 text-white font-bold text-xs tracking-wider shadow-md hover:from-emerald-500 hover:to-teal-500 transition-all flex items-center justify-center space-x-2"
                >
                  ${rebalancing ? html`
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Rebalancing Study Routine...</span>
                  ` : html`
                    <span>Generate Structured Rebalancing</span>
                  `}
                </button>
              </form>
            ` : html`
              <!-- Proposal List Display -->
              <div className="space-y-5 animate-fade-in">
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg p-3 text-xs">
                  <strong>Gemini Proposal Ready:</strong> Applying this plan will re-configure subject daily hours and replace all calendar study blocks.
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Proposed Daily Targets</h4>
                    <div className="space-y-2">
                      ${proposal.rebalanced_target_hours.map((item, idx) => html`
                        <div key=${idx} className="flex justify-between items-center p-2 rounded-lg bg-slate-900/40 border border-slate-800 text-xs">
                          <span className="font-bold text-slate-200">${item.subject_name}</span>
                          <span className="text-indigo-400 font-bold">${item.target_hours} hrs/day</span>
                        </div>
                      `)}
                    </div>
                  </div>

                  
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Proposed Weekly Blocks</h4>
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      ${proposal.proposed_blocks.map((block, idx) => html`
                        <div key=${idx} className="p-2 rounded-lg bg-slate-900/40 border border-slate-800 text-[10px] flex justify-between items-center">
                          <div>
                            <span className="font-bold text-slate-200 block">${block.subject_name}</span>
                            <span className="text-slate-500">${block.start_time} - ${block.end_time}</span>
                          </div>
                          <span className="text-slate-400 font-bold">${daysOfWeek[block.day_of_week].slice(0,3)}</span>
                        </div>
                      `)}
                    </div>
                  </div>

                </div>

                <div className="flex space-x-3 pt-4 border-t border-slate-800">
                  <button
                    onClick=${() => setProposal(null)}
                    className="px-4 py-2.5 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 text-xs font-bold"
                  >
                    Adjust Goal
                  </button>
                  <div className="flex-1"></div>
                  <button
                    onClick=${handleApplyRebalance}
                    className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                  >
                    Accept & Apply Plan
                  </button>
                </div>
              </div>
            `}
          </div>
        </div>
      `}
    </div>
  `;
}
