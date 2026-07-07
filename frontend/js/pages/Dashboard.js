// TRAt Dashboard & Task Tracker Page Component
import { React, html } from '../react-config.js';
const { useState, useEffect, useMemo } = React;

export default function Dashboard({ API }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Navigation & Date contexts
  const [viewMode, setViewMode] = useState('daily'); // 'daily', 'weekly', 'monthly'
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  
  // Form States
  const [isAdding, setIsAdding] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  
  // Quick-Add Inputs
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [priority, setPriority] = useState('Medium');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueTime, setDueTime] = useState('09:00');
  const [recurrence, setRecurrence] = useState('none');

  // Extra stats states
  const [dietEntries, setDietEntries] = useState([]);
  const [studySessions, setStudySessions] = useState([]);
  const [studySubjects, setStudySubjects] = useState([]);

  // Load tasks on mount
  useEffect(() => {
    fetchTasks();
    fetchDietAndStudyStats();
  }, []);

  const fetchDietAndStudyStats = async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const dietData = await API.diet.getAll(todayStr);
      setDietEntries(dietData);

      const sessionsData = await API.study.getSessions();
      setStudySessions(sessionsData);

      const subjectsData = await API.study.getSubjects();
      setStudySubjects(subjectsData);
    } catch (e) {
      console.warn("Failed to load extra dashboard metrics:", e);
    }
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const data = await API.tasks.getAll();
      setTasks(data);
    } catch (err) {
      setError('Could not retrieve tasks. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isSameDay = (date1, date2) => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  };

  const taskMatchesDate = (task, date) => {
    if (!task.due_date) return false;
    const taskDate = new Date(task.due_date);
    if (isSameDay(taskDate, date)) return true;
    
    // Check for daily recurrence
    if (task.recurrence === 'daily') {
      const startOfDayTask = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
      const startOfDayTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      return startOfDayTarget >= startOfDayTask;
    }
    
    // Check for weekly recurrence
    if (task.recurrence === 'weekly') {
      const startOfDayTask = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
      const startOfDayTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      return taskDate.getDay() === date.getDay() && startOfDayTarget >= startOfDayTask;
    }
    
    return false;
  };

  // Quick Task Creation
  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const localDateTimeStr = `${dueDate}T${dueTime || '09:00'}:00`;
    const targetDueDate = new Date(localDateTimeStr);

    const newTaskData = {
      title,
      description,
      category,
      priority,
      due_date: targetDueDate.toISOString(),
      recurrence,
      status: 'todo'
    };

    const tempId = -Math.floor(Math.random() * 1000000);
    const tempTask = { id: tempId, ...newTaskData, created_at: new Date().toISOString() };
    setTasks(prev => [tempTask, ...prev]);

    setTitle('');
    setDescription('');
    setCategory('General');
    setPriority('Medium');
    setRecurrence('none');
    setIsAdding(false);

    try {
      const createdTask = await API.tasks.create(newTaskData);
      setTasks(prev => prev.map(t => t.id === tempId ? createdTask : t));
      triggerNotification('Task Created', `"${title}" has been scheduled.`);
    } catch (err) {
      setTasks(prev => prev.filter(t => t.id !== tempId));
      setError('Failed to create task: ' + err.message);
    }
  };

  // Optimistic Toggle Checkbox
  const handleToggleTask = async (task) => {
    const originalStatus = task.status;
    const newStatus = originalStatus === 'done' ? 'todo' : 'done';

    // If it is a recurring task and we are checking it to 'done'
    if (task.recurrence && task.recurrence !== 'none' && newStatus === 'done') {
      const taskDate = new Date(task.due_date);
      const completedDate = new Date(selectedDate);
      completedDate.setHours(taskDate.getHours(), taskDate.getMinutes(), taskDate.getSeconds());

      const completedTaskData = {
        title: task.title,
        description: task.description,
        category: task.category,
        priority: task.priority,
        due_date: completedDate.toISOString(),
        recurrence: 'none',
        status: 'done'
      };

      const nextDueDate = new Date(task.due_date);
      if (task.recurrence === 'daily') {
        nextDueDate.setDate(nextDueDate.getDate() + 1);
      } else if (task.recurrence === 'weekly') {
        nextDueDate.setDate(nextDueDate.getDate() + 7);
      }

      // Optimistic UI updates
      const tempId = -Math.floor(Math.random() * 1000000);
      const tempCompletedTask = { id: tempId, ...completedTaskData, created_at: new Date().toISOString() };
      
      setTasks(prev => {
        const updated = prev.map(t => t.id === task.id ? { ...t, due_date: nextDueDate.toISOString(), status: 'todo' } : t);
        return [tempCompletedTask, ...updated];
      });

      try {
        const createdCompleted = await API.tasks.create(completedTaskData);
        const updatedMain = await API.tasks.update(task.id, { due_date: nextDueDate.toISOString(), status: 'todo' });
        
        setTasks(prev => prev.map(t => {
          if (t.id === tempId) return createdCompleted;
          if (t.id === task.id) return updatedMain;
          return t;
        }));
        
        triggerNotification('Task Completed', `Great job completing "${task.title}"!`);
      } catch (err) {
        fetchTasks();
        setError('Failed to complete recurring task: ' + err.message);
      }
      return;
    }

    // Normal non-recurring task toggle
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));

    try {
      await API.tasks.update(task.id, { status: newStatus });
      if (newStatus === 'done') {
        triggerNotification('Task Completed', `Great job completing "${task.title}"!`);
      }
    } catch (err) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: originalStatus } : t));
      setError('Connection error. Reverted task status.');
    }
  };

  // Delete Task
  const handleDeleteTask = async (id) => {
    const confirmed = confirm('Are you sure you want to delete this task?');
    if (!confirmed) return;

    const originalTasks = [...tasks];
    setTasks(prev => prev.filter(t => t.id !== id));
    setEditingTask(null);

    try {
      await API.tasks.delete(id);
    } catch (err) {
      setTasks(originalTasks);
      setError('Failed to delete task. Reverted.');
    }
  };

  // Edit Task Save
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingTask.title.trim()) return;

    const originalTasks = [...tasks];
    setTasks(prev => prev.map(t => t.id === editingTask.id ? editingTask : t));
    const targetTask = editingTask;
    setEditingTask(null);

    try {
      await API.tasks.update(targetTask.id, {
        title: targetTask.title,
        description: targetTask.description,
        category: targetTask.category,
        priority: targetTask.priority,
        due_date: new Date(targetTask.due_date).toISOString(),
        recurrence: targetTask.recurrence,
        status: targetTask.status
      });
    } catch (err) {
      setTasks(originalTasks);
      setError('Failed to update task details. Reverted.');
    }
  };

  // Browser Notification Helper
  const triggerNotification = (title, body) => {
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/static/js/logo-192.png'
      });
    }
  };

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const dailyTasks = useMemo(() => {
    return tasks.filter(task => taskMatchesDate(task, selectedDate)).sort((a, b) => {
      const timeDiff = new Date(a.due_date) - new Date(b.due_date);
      if (timeDiff !== 0) return timeDiff;
      const priorityWeights = { High: 3, Medium: 2, Low: 1 };
      return priorityWeights[b.priority] - priorityWeights[a.priority];
    });
  }, [tasks, selectedDate]);

  const weeklyDays = useMemo(() => {
    const startOfWeek = new Date(selectedDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push(d);
    }
    return days;
  }, [selectedDate]);

  const weeklyTasksMap = useMemo(() => {
    const map = {};
    weeklyDays.forEach(day => {
      const dateStr = day.toDateString();
      map[dateStr] = tasks.filter(task => taskMatchesDate(task, day));
    });
    return map;
  }, [tasks, weeklyDays]);

  const monthlyCells = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    let startOffset = firstDayOfMonth.getDay() - 1;
    if (startOffset === -1) startOffset = 6;
    
    const cells = [];
    
    const prevMonthLast = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      cells.push({
        date: new Date(currentYear, currentMonth - 1, prevMonthLast - i),
        isCurrentMonth: false
      });
    }
    
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    for (let i = 1; i <= totalDays; i++) {
      cells.push({
        date: new Date(currentYear, currentMonth, i),
        isCurrentMonth: true
      });
    }
    
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      cells.push({
        date: new Date(currentYear, currentMonth + 1, i),
        isCurrentMonth: false
      });
    }
    
    return cells;
  }, [currentMonth, currentYear]);

  const getDayTaskStats = (date) => {
    const dayTasks = tasks.filter(t => taskMatchesDate(t, date));
    const total = dayTasks.length;
    const completed = dayTasks.filter(t => t.status === 'done').length;
    const density = total === 0 ? 'none' : 
                    completed === total ? 'complete' :
                    (completed / total) > 0.6 ? 'high' :
                    (completed / total) > 0.3 ? 'medium' : 'low';
    return { total, completed, density };
  };

  const metrics = useMemo(() => {
    const today = new Date();
    const todayTasks = tasks.filter(t => taskMatchesDate(t, today));
    
    const todayTotal = todayTasks.length;
    const todayCompleted = todayTasks.filter(t => t.status === 'done').length;
    const completionRate = todayTotal === 0 ? 0 : Math.round((todayCompleted / todayTotal) * 100);

    let streak = 0;
    let checkDate = new Date(today);
    while (true) {
      const dayTasks = tasks.filter(t => taskMatchesDate(t, checkDate));
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

    // Calorie intake metrics
    const caloriesLogged = dietEntries.reduce((acc, curr) => acc + (curr.calories || 0), 0);
    const targetCalories = 2000;
    const dietRate = Math.min(100, Math.round((caloriesLogged / targetCalories) * 100));

    // Study focus metrics
    const todaySessions = studySessions.filter(s => isSameDay(new Date(s.start_time), today));
    const studyHoursCompleted = todaySessions.reduce((acc, curr) => acc + (curr.duration_seconds / 3600.0), 0);
    const studyHoursTarget = studySubjects.reduce((acc, curr) => acc + (curr.target_hours || 0), 0) || 8.0;
    const studyRate = Math.min(100, Math.round((studyHoursCompleted / studyHoursTarget) * 100));

    return { 
      todayTotal, 
      todayCompleted, 
      completionRate, 
      streak,
      caloriesLogged,
      targetCalories,
      dietRate,
      studyHoursCompleted,
      studyHoursTarget,
      studyRate
    };
  }, [tasks, dietEntries, studySessions, studySubjects]);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return html`
    <div className="max-w-7xl mx-auto px-4 py-8 md:px-8">
      
      ${error && html`
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3 text-sm mb-6 flex justify-between items-center animate-fade-in">
          <span>${error}</span>
          <button onClick=${() => setError('')} className="text-red-400 hover:text-red-300 font-bold focus:outline-none">✕</button>
        </div>
      `}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        
        <div className="space-y-6 lg:col-span-1">
          
          
          <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-6">
            <h3 className="text-lg font-bold font-title text-slate-200 border-b border-slate-800 pb-3">Performance Overview</h3>
            
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-2xl">
                🔥
              </div>
              <div>
                <div className="text-2xl font-black font-title text-orange-500">${metrics.streak} Days</div>
                <div className="text-xs text-slate-400 font-medium">Daily Completion Streak</div>
              </div>
            </div>

            
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-slate-400">
                <span>Today's Task Completion</span>
                <span className="text-indigo-400">${metrics.completionRate}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                <div 
                  className="h-full bg-gradient-to-r from-primary-500 to-indigo-500 rounded-full transition-all duration-500" 
                  style=${{ width: `${metrics.completionRate}%` }}
                ></div>
              </div>
              <div className="text-[10px] text-slate-500 text-right">
                ${metrics.todayCompleted} of ${metrics.todayTotal} tasks done
              </div>
            </div>

            
            <div className="space-y-2 border-t border-slate-800/60 pt-4">
              <div className="flex justify-between text-xs font-semibold text-slate-400">
                <span>Study Focus Target</span>
                <span className="text-emerald-400">${metrics.studyRate}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500" 
                  style=${{ width: `${metrics.studyRate}%` }}
                ></div>
              </div>
              <div className="text-[10px] text-slate-500 text-right">
                ${metrics.studyHoursCompleted.toFixed(1)}h of ${metrics.studyHoursTarget.toFixed(1)}h target logged
              </div>
            </div>

            
            <div className="space-y-2 border-t border-slate-800/60 pt-4">
              <div className="flex justify-between text-xs font-semibold text-slate-400">
                <span>Diet Calories Logged</span>
                <span className="text-orange-400">${metrics.dietRate}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                <div 
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-500" 
                  style=${{ width: `${metrics.dietRate}%` }}
                ></div>
              </div>
              <div className="text-[10px] text-slate-500 text-right">
                ${metrics.caloriesLogged} of ${metrics.targetCalories} kcal budget
              </div>
            </div>
          </div>

          
          <div className="glass-card rounded-2xl p-6 border border-white/5">
            ${!isAdding ? html`
              <button
                onClick=${() => setIsAdding(true)}
                className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-primary-600/20 transition-all duration-200 flex items-center justify-center space-x-2"
              >
                <span>Add Task</span>
                <span className="text-lg font-bold">+</span>
              </button>
            ` : html`
              <form onSubmit=${handleCreateTask} className="space-y-4 animate-fade-in">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <h4 className="font-bold text-sm font-title text-slate-300">Quick Add Task</h4>
                  <button type="button" onClick=${() => setIsAdding(false)} className="text-slate-500 hover:text-slate-300">✕</button>
                </div>

                <div>
                  <input
                    type="text"
                    placeholder="Task Title"
                    value=${title}
                    onInput=${(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg glass-input focus:ring-1 focus:ring-primary-500"
                    required
                  />
                </div>

                <div>
                  <textarea
                    placeholder="Description (optional)"
                    value=${description}
                    onInput=${(e) => setDescription(e.target.value)}
                    rows="2"
                    className="w-full px-3 py-2 text-sm rounded-lg glass-input focus:ring-1 focus:ring-primary-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Category</label>
                    <select
                      value=${category}
                      onChange=${(e) => setCategory(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded-lg glass-input"
                    >
                      <option value="General">General</option>
                      <option value="Study">Study</option>
                      <option value="Diet">Diet</option>
                      <option value="Personal">Personal</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Priority</label>
                    <select
                      value=${priority}
                      onChange=${(e) => setPriority(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded-lg glass-input"
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Due Date</label>
                    <input
                      type="date"
                      value=${dueDate}
                      onChange=${(e) => setDueDate(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded-lg glass-input"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Due Time</label>
                    <input
                      type="time"
                      value=${dueTime}
                      onChange=${(e) => setDueTime(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded-lg glass-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Recurrence</label>
                  <select
                    value=${recurrence}
                    onChange=${(e) => setRecurrence(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs rounded-lg glass-input"
                  >
                    <option value="none">None</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs tracking-wider transition-colors"
                >
                  Save Task
                </button>
              </form>
            `}
          </div>

        </div>

        
        <div className="lg:col-span-3 space-y-6">
          
          
          <div className="glass-card rounded-2xl p-4 border border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
            
            
            <div className="flex bg-slate-800/40 p-1.5 rounded-xl border border-slate-700/30">
              <button
                onClick=${() => setViewMode('daily')}
                className=${`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-150 ${viewMode === 'daily' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Daily
              </button>
              <button
                onClick=${() => setViewMode('weekly')}
                className=${`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-150 ${viewMode === 'weekly' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Weekly
              </button>
              <button
                onClick=${() => setViewMode('monthly')}
                className=${`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-150 ${viewMode === 'monthly' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Monthly
              </button>
            </div>

            
            <div className="flex items-center space-x-4">
              <button
                onClick=${() => {
                  if (viewMode === 'daily') {
                    const d = new Date(selectedDate);
                    d.setDate(d.getDate() - 1);
                    setSelectedDate(d);
                  } else if (viewMode === 'weekly') {
                    const d = new Date(selectedDate);
                    d.setDate(d.getDate() - 7);
                    setSelectedDate(d);
                  } else if (viewMode === 'monthly') {
                    if (currentMonth === 0) {
                      setCurrentMonth(11);
                      setCurrentYear(currentYear - 1);
                    } else {
                      setCurrentMonth(currentMonth - 1);
                    }
                  }
                }}
                className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 flex items-center justify-center text-slate-300"
              >
                ◀
              </button>

              <h2 className="text-sm md:text-base font-bold font-title text-slate-200 min-w-[140px] text-center">
                ${viewMode === 'daily' && isSameDay(selectedDate, new Date()) ? 'Today' : ''}
                ${viewMode === 'daily' && !isSameDay(selectedDate, new Date()) ? selectedDate.toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'}) : ''}
                ${viewMode === 'weekly' && `Week of ${weeklyDays[0].toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}`}
                ${viewMode === 'monthly' && `${monthNames[currentMonth]} ${currentYear}`}
              </h2>

              <button
                onClick=${() => {
                  if (viewMode === 'daily') {
                    const d = new Date(selectedDate);
                    d.setDate(d.getDate() + 1);
                    setSelectedDate(d);
                  } else if (viewMode === 'weekly') {
                    const d = new Date(selectedDate);
                    d.setDate(d.getDate() + 7);
                    setSelectedDate(d);
                  } else if (viewMode === 'monthly') {
                    if (currentMonth === 11) {
                      setCurrentMonth(0);
                      setCurrentYear(currentYear + 1);
                    } else {
                      setCurrentMonth(currentMonth + 1);
                    }
                  }
                }}
                className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 flex items-center justify-center text-slate-300"
              >
                ▶
              </button>
            </div>

            
            <button
              onClick=${() => {
                const today = new Date();
                setSelectedDate(today);
                setCurrentMonth(today.getMonth());
                setCurrentYear(today.getFullYear());
              }}
              className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            >
              Today
            </button>
          </div>

          
          <div className="glass-card rounded-2xl p-6 border border-white/5 min-h-[400px]">
            ${loading ? html`
              <div className="flex justify-center items-center h-72">
                <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ` : html`
              <${React.Fragment}>
                
                ${viewMode === 'daily' && html`
                  <div className="space-y-4 animate-fade-in">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-slate-200">Tasks Checklist</h3>
                      <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded-md">${dailyTasks.length} Scheduled</span>
                    </div>

                    ${dailyTasks.length === 0 ? html`
                      <div className="flex flex-col items-center justify-center h-64 text-center">
                        <span className="text-4xl mb-3">📅</span>
                        <h4 className="text-slate-300 font-bold font-title">No Tasks Scheduled</h4>
                        <p className="text-xs text-slate-500 mt-1">Get ahead by adding a new task to your schedule!</p>
                      </div>
                    ` : html`
                      <div className="divide-y divide-slate-800/40">
                        ${dailyTasks.map(task => html`
                          <div 
                            key=${task.id} 
                            className="flex items-center justify-between py-3.5 group hover:bg-slate-800/10 px-2 rounded-lg transition-all duration-150"
                          >
                            <div className="flex items-center space-x-3.5 flex-1 min-w-0 mr-4">
                              <label className="custom-checkbox flex-shrink-0">
                                <input
                                  type="checkbox"
                                  checked=${task.status === 'done'}
                                  onChange=${() => handleToggleTask(task)}
                                />
                                <span className="checkmark"></span>
                              </label>
                              
                              <div className="pl-8 min-w-0" onClick=${() => setEditingTask(task)}>
                                <div className="flex items-center space-x-2">
                                  <span className="text-[10px] font-mono font-bold bg-slate-800 text-primary-400 px-1.5 py-0.5 rounded border border-slate-700/50 flex-shrink-0">
                                    ${new Date(task.due_date).toLocaleTimeString(undefined, {hour: '2-digit', minute:'2-digit', hour12: true})}
                                  </span>
                                  <h4 className=${`font-semibold text-sm cursor-pointer select-none truncate ${
                                    task.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-200'
                                  }`}>
                                    ${task.title}
                                  </h4>
                                </div>
                                ${task.description && html`
                                  <p className="text-xs text-slate-400 truncate mt-0.5 max-w-lg cursor-pointer">
                                    ${task.description}
                                  </p>
                                `}
                              </div>
                            </div>

                            <div className="flex items-center space-x-3">
                              <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-700/50 bg-slate-800/50 text-slate-400 font-semibold">
                                ${task.category}
                              </span>

                              <span className=${`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                task.priority === 'High' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                task.priority === 'Medium' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                                'bg-green-500/10 text-green-400 border border-green-500/20'
                              }`}>
                                ${task.priority}
                              </span>

                              <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-1">
                                <button 
                                  onClick=${() => setEditingTask(task)}
                                  className="p-1 text-slate-500 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-all duration-150"
                                  title="Edit Task"
                                >
                                  ✏️
                                </button>
                                <button 
                                  onClick=${(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                                  className="p-1 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-all duration-150"
                                  title="Delete Task"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          </div>
                        `)}
                      </div>
                    `}
                  </div>
                `}

                
                ${viewMode === 'weekly' && html`
                  <div className="grid grid-cols-1 md:grid-cols-7 gap-4 animate-fade-in">
                    ${weeklyDays.map((day, idx) => {
                      const dayTasks = weeklyTasksMap[day.toDateString()] || [];
                      const isToday = isSameDay(day, new Date());
                      
                      return html`
                        <div 
                          key=${idx}
                          onClick=${() => {
                            setSelectedDate(day);
                            setViewMode('daily');
                          }}
                          className=${`rounded-xl p-3 cursor-pointer transition-all duration-200 border flex flex-col min-h-[220px] ${
                            isToday ? 'bg-primary-500/5 border-primary-500/30' : 'bg-slate-800/20 border-slate-800/80 hover:border-slate-700'
                          }`}
                        >
                          <div className="text-center border-b border-slate-800 pb-2 mb-2 flex justify-between items-center md:flex-col md:gap-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              ${day.toLocaleDateString(undefined, {weekday: 'short'})}
                            </span>
                            <span className=${`text-sm font-black rounded-full w-6 h-6 flex items-center justify-center ${
                              isToday ? 'bg-primary-600 text-white shadow-md' : 'text-slate-300'
                            }`}>
                              ${day.getDate()}
                            </span>
                          </div>

                          <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[140px] pr-0.5">
                            ${dayTasks.length === 0 ? html`
                              <span className="text-[10px] text-slate-600 italic block text-center mt-6">Empty</span>
                            ` : html`
                              ${dayTasks.slice(0, 4).map(task => html`
                                <div 
                                  key=${task.id} 
                                  className=${`p-1.5 rounded-lg text-[10px] truncate font-semibold border ${
                                    task.status === 'done' 
                                      ? 'bg-slate-900/60 border-slate-800/40 text-slate-500 line-through' 
                                      : 'bg-slate-800/80 border-slate-700/40 text-slate-200'
                                  }`}
                                >
                                  ${task.title}
                                </div>
                              `)}
                            `}
                            ${dayTasks.length > 4 && html`
                              <div className="text-[9px] text-center font-bold text-indigo-400 mt-1">
                                + ${dayTasks.length - 4} more
                              </div>
                            `}
                          </div>
                        </div>
                      `;
                    })}
                  </div>
                `}

                
                ${viewMode === 'monthly' && html`
                  <div className="animate-fade-in">
                    <div className="grid grid-cols-7 gap-2 mb-2 text-center">
                      ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(h => html`
                        <span key=${h} className="text-xs font-bold text-slate-500 uppercase tracking-wider">${h}</span>
                      `)}
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                      ${monthlyCells.map((cell, idx) => {
                        const stats = getDayTaskStats(cell.date);
                        const isToday = isSameDay(cell.date, new Date());
                        const isSel = isSameDay(cell.date, selectedDate);
                        
                        return html`
                          <div
                            key=${idx}
                            onClick=${() => {
                              setSelectedDate(cell.date);
                              setViewMode('daily');
                            }}
                            title="${stats.completed}/${stats.total} completed"
                            className=${`aspect-square rounded-xl p-2 cursor-pointer transition-all duration-150 border flex flex-col justify-between ${
                              cell.isCurrentMonth ? '' : 'opacity-30'
                            } ${
                              isSel ? 'ring-2 ring-primary-500 ring-offset-2 ring-offset-darkbg' : ''
                            } ${
                              stats.density === 'none' ? 'density-none' :
                              stats.density === 'low' ? 'density-low' :
                              stats.density === 'medium' ? 'density-medium' :
                              stats.density === 'high' ? 'density-high' : 'density-complete'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <span className=${`text-xs font-bold ${
                                isToday ? 'bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center' : 'text-slate-300'
                              }`}>
                                ${cell.date.getDate()}
                              </span>
                              
                              ${stats.total > 0 && html`
                                <span className="text-[8px] font-extrabold text-slate-400 bg-slate-900/60 px-1 rounded">
                                  ${stats.completed}/${stats.total}
                                </span>
                              `}
                            </div>
                          </div>
                        `;
                      })}
                    </div>
                  </div>
                `}
              </${React.Fragment}>
            `}
          </div>

        </div>

      </div>

      
      ${editingTask && html`
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-card rounded-2xl p-6 border border-white/10 animate-fade-in">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
              <h3 className="font-extrabold font-title text-slate-200">Modify Task Details</h3>
              <button onClick=${() => setEditingTask(null)} className="text-slate-500 hover:text-slate-300">✕</button>
            </div>

            <form onSubmit=${handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Title</label>
                <input
                  type="text"
                  value=${editingTask.title}
                  onInput=${(e) => setEditingTask({...editingTask, title: e.target.value})}
                  className="w-full px-3 py-2 text-sm rounded-lg glass-input"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Description</label>
                <textarea
                  value=${editingTask.description || ''}
                  onInput=${(e) => setEditingTask({...editingTask, description: e.target.value})}
                  rows="3"
                  className="w-full px-3 py-2 text-sm rounded-lg glass-input resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Category</label>
                  <select
                    value=${editingTask.category}
                    onChange=${(e) => setEditingTask({...editingTask, category: e.target.value})}
                    className="w-full px-2 py-1.5 text-xs rounded-lg glass-input"
                  >
                    <option value="General">General</option>
                    <option value="Study">Study</option>
                    <option value="Diet">Diet</option>
                    <option value="Personal">Personal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Priority</label>
                  <select
                    value=${editingTask.priority}
                    onChange=${(e) => setEditingTask({...editingTask, priority: e.target.value})}
                    className="w-full px-2 py-1.5 text-xs rounded-lg glass-input"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                 <div>
                   <label className="block text-xs font-bold text-slate-400 mb-1">Due Date</label>
                   <input
                     type="date"
                     value=${editingTask.due_date ? new Date(editingTask.due_date).toLocaleDateString('en-CA') : ''}
                     onChange=${(e) => {
                       const d = new Date(editingTask.due_date);
                       const timePart = editingTask.due_date ? 
                         `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00` : 
                         '09:00:00';
                       setEditingTask({...editingTask, due_date: e.target.value + 'T' + timePart});
                     }}
                     className="w-full px-2 py-1.5 text-xs rounded-lg glass-input"
                   />
                 </div>

                 <div>
                   <label className="block text-xs font-bold text-slate-400 mb-1">Due Time</label>
                   <input
                     type="time"
                     value=${editingTask.due_date ? (() => {
                       const d = new Date(editingTask.due_date);
                       return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                     })() : '09:00'}
                     onChange=${(e) => {
                       const d = new Date(editingTask.due_date);
                       const datePart = editingTask.due_date ? 
                         d.toLocaleDateString('en-CA') : 
                         new Date().toLocaleDateString('en-CA');
                       setEditingTask({...editingTask, due_date: datePart + 'T' + e.target.value + ':00'});
                     }}
                     className="w-full px-2 py-1.5 text-xs rounded-lg glass-input"
                   />
                 </div>

                 <div>
                   <label className="block text-xs font-bold text-slate-400 mb-1">Recurrence</label>
                   <select
                     value=${editingTask.recurrence}
                     onChange=${(e) => setEditingTask({...editingTask, recurrence: e.target.value})}
                     className="w-full px-2 py-1.5 text-xs rounded-lg glass-input"
                   >
                     <option value="none">None</option>
                     <option value="daily">Daily</option>
                     <option value="weekly">Weekly</option>
                   </select>
                 </div>
               </div>

              <div className="flex space-x-3 pt-4 border-t border-slate-800 mt-6">
                <button
                  type="button"
                  onClick=${() => handleDeleteTask(editingTask.id)}
                  className="px-4 py-2 text-xs rounded-lg bg-red-950/40 text-red-400 border border-red-500/20 hover:bg-red-950/70 transition-colors"
                >
                  Delete Task
                </button>
                <div className="flex-1"></div>
                <button
                  type="button"
                  onClick=${() => setEditingTask(null)}
                  className="px-4 py-2 text-xs rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs rounded-lg bg-primary-600 hover:bg-primary-500 text-white font-bold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      `}
    </div>
  `;
}
