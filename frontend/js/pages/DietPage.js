// TRAt Diet Tracker Page Component
import { React, html } from '../react-config.js';
const { useState, useEffect, useMemo } = React;

export default function DietPage({ API }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Quick-Add Inputs
  const [description, setDescription] = useState('');
  const [mealType, setMealType] = useState('Breakfast');
  const [mealTime, setMealTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [calories, setCalories] = useState(0);
  const [protein, setProtein] = useState(0);
  const [carbs, setCarbs] = useState(0);
  const [fat, setFat] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [success, setSuccess] = useState('');

  // AI Assistant Chat States
  const [showAIModal, setShowAIModal] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      text: 'Hello! I am your Gemini AI Diet Architect. Ask me anything about your diet, suggest recipes, log meals by saying what you ate, or request calorie estimates!',
      proposed_meals: []
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [proposal, setProposal] = useState(null); // Keep legacy compatibility if needed

  // Load entries for selected date
  useEffect(() => {
    fetchDietEntries();
  }, [selectedDate]);

  const fetchDietEntries = async () => {
    try {
      setLoading(true);
      const dateStr = selectedDate.toISOString().split('T')[0];
      const data = await API.diet.getAll(dateStr);
      setEntries(data);
    } catch (err) {
      setError('Could not retrieve diet logs.');
    } finally {
      setLoading(false);
    }
  };

  const isSameDay = (date1, date2) => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  };

  // Create Manual Diet Entry
  const handleAddEntry = async (e) => {
    e.preventDefault();
    if (!description.trim()) return;

    // Combine day selection with custom meal time selection
    const dateStr = selectedDate.toISOString().split('T')[0];
    const targetDateTime = new Date(`${dateStr}T${mealTime || '12:00'}:00`);

    const newEntryData = {
      meal_type: mealType,
      description,
      calories: parseInt(calories) || 0,
      protein: parseInt(protein) || 0,
      carbs: parseInt(carbs) || 0,
      fat: parseInt(fat) || 0,
      status: 'todo',
      date: targetDateTime.toISOString()
    };

    // Optimistic UI insert
    const tempId = -Math.floor(Math.random() * 100000);
    const tempEntry = { id: tempId, ...newEntryData };
    setEntries(prev => [...prev, tempEntry]);

    // Reset fields
    setDescription('');
    setCalories(0);
    setProtein(0);
    setCarbs(0);
    setFat(0);
    setIsAdding(false);

    try {
      const savedEntry = await API.diet.create(newEntryData);
      setEntries(prev => prev.map(item => item.id === tempId ? savedEntry : item));
    } catch (err) {
      setEntries(prev => prev.filter(item => item.id !== tempId));
      setError('Failed to log diet entry.');
    }
  };

  // Toggle meal check off (eaten)
  const handleToggleEat = async (entry) => {
    const originalStatus = entry.status;
    const newStatus = originalStatus === 'done' ? 'todo' : 'done';

    setEntries(prev => prev.map(item => item.id === entry.id ? { ...item, status: newStatus } : item));

    try {
      await API.diet.update(entry.id, { status: newStatus });
    } catch (err) {
      setEntries(prev => prev.map(item => item.id === entry.id ? { ...item, status: originalStatus } : item));
      setError('Failed to update meal status.');
    }
  };

  // Delete log entry
  const handleDeleteEntry = async (id) => {
    const confirmed = confirm('Delete this diet entry?');
    if (!confirmed) return;

    const original = [...entries];
    setEntries(prev => prev.filter(item => item.id !== id));

    try {
      await API.diet.delete(id);
    } catch (err) {
      setEntries(original);
      setError('Failed to delete diet entry.');
    }
  };

  // Save Edited Diet Entry
  const handleSaveEditEntry = async (e) => {
    e.preventDefault();
    if (!editingEntry.description.trim()) return;

    // Optimistically update local state
    setEntries(prev => prev.map(item => item.id === editingEntry.id ? editingEntry : item));
    const targetEntry = editingEntry;
    setEditingEntry(null);
    setSuccess('Meal updated successfully!');
    setTimeout(() => setSuccess(''), 3000);

    try {
      await API.diet.update(targetEntry.id, {
        meal_type: targetEntry.meal_type,
        description: targetEntry.description,
        calories: parseInt(targetEntry.calories) || 0,
        protein: parseInt(targetEntry.protein) || 0,
        carbs: parseInt(targetEntry.carbs) || 0,
        fat: parseInt(targetEntry.fat) || 0,
        status: targetEntry.status,
        date: targetEntry.date
      });
    } catch (err) {
      setError('Failed to save meal changes.');
      fetchDietEntries();
    }
  };

  // Send Chat message to Gemini Diet Assistant
  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatLoading(true);
    setError('');

    try {
      const history = chatMessages.map(m => ({ role: m.role, text: m.text }));
      const res = await API.ai.chatDiet(userMsg, history);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        text: res.reply,
        proposed_meals: res.proposed_meals || []
      }]);
    } catch (err) {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        text: 'Sorry, I failed to get a response from the Gemini Diet Agent. Please verify your connection/API key.',
        proposed_meals: []
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Log a proposed meal from the AI agent directly to today's log
  const handleLogProposedMeal = async (meal) => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    const timePart = meal.meal_type === 'Breakfast' ? '08:00:00' :
                     meal.meal_type === 'Lunch' ? '13:00:00' :
                     meal.meal_type === 'Dinner' ? '19:00:00' : '16:00:00';
    const targetDateTime = new Date(`${dateStr}T${timePart}`);

    const newEntry = {
      meal_type: meal.meal_type,
      description: meal.description,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
      status: 'todo',
      date: targetDateTime.toISOString()
    };

    // Optimistic UI insert
    const tempId = -Math.floor(Math.random() * 100000);
    setEntries(prev => [...prev, { id: tempId, ...newEntry }]);
    setSuccess(`Logged "${meal.description}" successfully!`);
    setTimeout(() => setSuccess(''), 3000);

    try {
      const saved = await API.diet.create(newEntry);
      setEntries(prev => prev.map(item => item.id === tempId ? saved : item));
    } catch (err) {
      setEntries(prev => prev.filter(item => item.id !== tempId));
      setError('Failed to log recommended meal.');
    }
  };

  // Generate AI Diet Proposal
  const handleGenerateDiet = async (e) => {
    e.preventDefault();
    setGenerating(true);
    setProposal(null);
    setError('');

    try {
      const data = await API.ai.generateDiet(aiGoal, aiPreference, aiRestrictions);
      setProposal(data.meals);
    } catch (err) {
      setError('Gemini failed to generate diet recommendations.');
    } finally {
      setGenerating(false);
    }
  };

  // Accept and save AI proposal
  const handleAcceptProposal = async () => {
    if (!proposal) return;

    try {
      setLoading(true);
      // Batch save
      const promises = proposal.map(meal => {
        const dateStr = selectedDate.toISOString().split('T')[0];
        const timePart = meal.meal_type === 'Breakfast' ? '08:00:00' :
                         meal.meal_type === 'Lunch' ? '13:00:00' :
                         meal.meal_type === 'Dinner' ? '19:00:00' : '16:00:00';
        const targetDateTime = new Date(`${dateStr}T${timePart}`);
        return API.diet.create({
          meal_type: meal.meal_type,
          description: meal.description,
          calories: meal.calories,
          protein: meal.protein,
          carbs: meal.carbs,
          fat: meal.fat,
          status: 'todo',
          date: targetDateTime.toISOString()
        });
      });
      
      const savedMeals = await Promise.all(promises);
      setEntries(prev => [...prev, ...savedMeals]);
      setShowAIModal(false);
      setProposal(null);
    } catch (err) {
      setError('Failed to save AI diet recommendations.');
    } finally {
      setLoading(false);
    }
  };

  // Calculate Aggregated Consumed vs Goal Macros
  const totals = useMemo(() => {
    const defaultGoals = { calories: 2200, protein: 140, carbs: 240, fat: 70 };
    
    // Eaten totals
    const eaten = entries.filter(e => e.status === 'done').reduce((acc, curr) => {
      acc.calories += curr.calories;
      acc.protein += curr.protein;
      acc.carbs += curr.carbs;
      acc.fat += curr.fat;
      return acc;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

    // Total planned
    const planned = entries.reduce((acc, curr) => {
      acc.calories += curr.calories;
      acc.protein += curr.protein;
      acc.carbs += curr.carbs;
      acc.fat += curr.fat;
      return acc;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

    return {
      eaten,
      planned,
      goals: defaultGoals
    };
  }, [entries]);

  return html`
    <div className="max-w-7xl mx-auto px-4 py-8 md:px-8">
      
      ${error && html`
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3 text-sm mb-6 flex justify-between items-center animate-fade-in">
          <span>${error}</span>
          <button onClick=${() => setError('')} className="text-red-400 hover:text-red-300 font-bold focus:outline-none">✕</button>
        </div>
      `}

      ${success && html`
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg p-3 text-sm mb-6 flex justify-between items-center animate-fade-in">
          <span>${success}</span>
          <button onClick=${() => setSuccess('')} className="text-emerald-400 hover:text-emerald-300 font-bold focus:outline-none">✕</button>
        </div>
      `}

      
      <div className="glass-card rounded-2xl p-6 border border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-extrabold font-title tracking-wider text-slate-100">Diet Planner & Tracker</h2>
          <p className="text-xs text-slate-400 mt-1">Nourish your body, optimize exam energy, and balance nutrition</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick=${() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() - 1);
              setSelectedDate(d);
            }}
            className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 flex items-center justify-center text-slate-300"
          >
            ◀
          </button>
          
          <span className="text-base font-bold font-title text-slate-200 min-w-[130px] text-center">
            ${isSameDay(selectedDate, new Date()) ? 'Today' : selectedDate.toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}
          </span>
          
          <button
            onClick=${() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() + 1);
              setSelectedDate(d);
            }}
            className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 flex items-center justify-center text-slate-300"
          >
            ▶
          </button>

          <button
            onClick=${() => setShowAIModal(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-accent to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs tracking-wider shadow-lg shadow-emerald-500/20 flex items-center space-x-1.5"
          >
            <span>Ask Gemini AI</span>
            <span className="text-xs">✨</span>
          </button>
        </div>
      </div>

      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-6">
            <h3 className="text-lg font-bold font-title text-slate-200 border-b border-slate-800 pb-3">Daily Nutrition</h3>

            
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-slate-400">
                <span>Calories (kcal)</span>
                <span className="text-emerald-400">${totals.eaten.calories} / ${totals.goals.calories}</span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300" 
                  style=${{ width: `${Math.min(100, (totals.eaten.calories / totals.goals.calories) * 100)}%` }}
                ></div>
              </div>
            </div>

            
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-slate-400">
                <span>Protein (g)</span>
                <span className="text-indigo-400">${totals.eaten.protein}g / ${totals.goals.protein}g</span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-blue-400 rounded-full transition-all duration-300" 
                  style=${{ width: `${Math.min(100, (totals.eaten.protein / totals.goals.protein) * 100)}%` }}
                ></div>
              </div>
            </div>

            
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-slate-400">
                <span>Carbs (g)</span>
                <span className="text-orange-400">${totals.eaten.carbs}g / ${totals.goals.carbs}g</span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                <div 
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all duration-300" 
                  style=${{ width: `${Math.min(100, (totals.eaten.carbs / totals.goals.carbs) * 100)}%` }}
                ></div>
              </div>
            </div>

            
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-slate-400">
                <span>Fats (g)</span>
                <span className="text-red-400">${totals.eaten.fat}g / ${totals.goals.fat}g</span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                <div 
                  className="h-full bg-gradient-to-r from-red-500 to-pink-400 rounded-full transition-all duration-300" 
                  style=${{ width: `${Math.min(100, (totals.eaten.fat / totals.goals.fat) * 100)}%` }}
                ></div>
              </div>
            </div>
          </div>

          
          <div className="glass-card rounded-2xl p-6 border border-white/5">
            ${!isAdding ? html`
              <button
                onClick=${() => setIsAdding(true)}
                className="w-full py-3 rounded-xl bg-slate-800 border border-slate-700/50 hover:bg-slate-700 text-slate-200 font-bold text-xs tracking-wider transition-colors"
              >
                Log Meal Manually
              </button>
            ` : html`
              <form onSubmit=${handleAddEntry} className="space-y-4 animate-fade-in">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <h4 className="font-bold text-sm font-title text-slate-300">Log Manual Meal</h4>
                  <button type="button" onClick=${() => setIsAdding(false)} className="text-slate-500 hover:text-slate-300">✕</button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Meal Category</label>
                    <select
                      value=${mealType}
                      onChange=${(e) => setMealType(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded-lg glass-input"
                    >
                      <option value="Breakfast">Breakfast</option>
                      <option value="Lunch">Lunch</option>
                      <option value="Dinner">Dinner</option>
                      <option value="Snack">Snack</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Meal Time</label>
                    <input
                      type="time"
                      value=${mealTime}
                      onChange=${(e) => setMealTime(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded-lg glass-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Scrambled eggs and toast"
                    value=${description}
                    onInput=${(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg glass-input"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Calories (kcal)</label>
                    <input
                      type="number"
                      value=${calories}
                      onInput=${(e) => setCalories(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded-lg glass-input"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Protein (g)</label>
                    <input
                      type="number"
                      value=${protein}
                      onInput=${(e) => setProtein(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded-lg glass-input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Carbs (g)</label>
                    <input
                      type="number"
                      value=${carbs}
                      onInput=${(e) => setCarbs(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded-lg glass-input"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Fat (g)</label>
                    <input
                      type="number"
                      value=${fat}
                      onInput=${(e) => setFat(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded-lg glass-input"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs tracking-wider transition-colors"
                >
                  Log Entry
                </button>
              </form>
            `}
          </div>
        </div>

        
        <div className="lg:col-span-3">
          <div className="glass-card rounded-2xl p-6 border border-white/5 min-h-[450px]">
            ${loading ? html`
              <div className="flex justify-center items-center h-80">
                <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ` : html`
              <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-slate-800/60 pb-3">
                  <h3 className="font-bold text-slate-200">Meal Plan Log</h3>
                  <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded-md">
                    ${entries.length} Entries Logged
                  </span>
                </div>

                ${entries.length === 0 ? html`
                  <div className="flex flex-col items-center justify-center h-72 text-center">
                    <span className="text-4xl mb-3">🥗</span>
                    <h4 className="text-slate-300 font-bold font-title">No Meals Logged</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Log your meals manually or click "Ask Gemini AI" to generate a tailored routine!
                    </p>
                  </div>
                ` : html`
                  <div className="divide-y divide-slate-800/40 space-y-4">
                    ${['Breakfast', 'Lunch', 'Dinner', 'Snack'].map(mealGroup => {
                      const mealEntries = entries.filter(e => e.meal_type === mealGroup)
                                                 .sort((a, b) => new Date(a.date) - new Date(b.date));
                      if (mealEntries.length === 0) return null;

                      return html`
                        <div key=${mealGroup} className="pt-4 first:pt-0">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                            ${mealGroup}
                          </h4>
                          <div className="space-y-3">
                            ${mealEntries.map(entry => html`
                              <div 
                                key=${entry.id}
                                className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/10 border border-slate-800/40 hover:border-slate-700/40 transition-colors group"
                              >
                                <div className="flex items-center space-x-3.5 flex-1 min-w-0 mr-4">
                                  <label className="custom-checkbox flex-shrink-0">
                                    <input
                                      type="checkbox"
                                      checked=${entry.status === 'done'}
                                      onChange=${() => handleToggleEat(entry)}
                                    />
                                    <span className="checkmark"></span>
                                  </label>

                                  <div className="pl-8 min-w-0">
                                    <p className=${'font-semibold text-sm select-none flex items-center ' + (
                                      entry.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-200'
                                    )}>
                                      <span className="text-[10px] font-mono font-bold bg-slate-800/80 text-emerald-400 px-1.5 py-0.5 rounded border border-slate-700/40 mr-2 flex-shrink-0">
                                        ${new Date(entry.date).toLocaleTimeString(undefined, {hour: '2-digit', minute:'2-digit', hour12: true})}
                                      </span>
                                      ${entry.description}
                                    </p>
                                    
                                    <div className="flex items-center space-x-3 text-[10px] text-slate-500 mt-1">
                                      <span className="text-emerald-400 font-medium">${entry.calories} kcal</span>
                                      <span>P: ${entry.protein}g</span>
                                      <span>C: ${entry.carbs}g</span>
                                      <span>F: ${entry.fat}g</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex space-x-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-150">
                                   <button
                                     onClick=${() => setEditingEntry(entry)}
                                     className="p-1.5 text-slate-500 hover:text-primary-400 rounded-lg hover:bg-slate-800/50"
                                     title="Edit Meal"
                                   >
                                     ✏️
                                   </button>
                                   <button
                                     onClick=${() => handleDeleteEntry(entry.id)}
                                     className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800/50"
                                     title="Delete Meal"
                                   >
                                     🗑️
                                   </button>
                                 </div>
                              </div>
                            `)}
                          </div>
                        </div>
                      `;
                    })}
                  </div>
                `}
              </div>
            `}
          </div>
        </div>

      </div>

      
      ${showAIModal && html`
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl glass-card rounded-2xl p-6 border border-white/10 animate-fade-in flex flex-col h-[85vh]">
            
            <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4 flex-shrink-0">
              <div className="flex items-center space-x-2">
                <span className="text-xl">✨</span>
                <h3 className="font-extrabold font-title text-lg text-slate-200">Gemini AI Diet Architect</h3>
              </div>
              <button onClick=${() => setShowAIModal(false)} className="text-slate-500 hover:text-slate-300">✕</button>
            </div>

            <div className="flex-grow overflow-y-auto space-y-4 pr-1 mb-4">
              ${chatMessages.map((msg, index) => html`
                <div key=${index} className=${`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div 
                    className=${`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-gradient-to-r from-primary-600 to-indigo-600 text-white rounded-br-none' 
                        : 'bg-slate-800/60 border border-slate-700/30 text-slate-200 rounded-bl-none'
                    }`}
                  >
                    ${msg.text}
                  </div>

                  ${msg.proposed_meals && msg.proposed_meals.length > 0 && html`
                    <div className="w-full max-w-[85%] mt-2 space-y-2">
                      ${msg.proposed_meals.map((meal, mealIdx) => html`
                        <div key=${mealIdx} className="p-3.5 rounded-xl border border-emerald-500/25 bg-emerald-500/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="text-[9px] font-black uppercase bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded">
                                ${meal.meal_type}
                              </span>
                              <span className="text-xs font-bold text-slate-300">${meal.calories} kcal</span>
                            </div>
                            <p className="text-xs font-semibold text-slate-200 leading-snug">${meal.description}</p>
                            <div className="flex space-x-2 text-[9px] text-slate-500 mt-1 font-medium">
                              <span>P: ${meal.protein}g</span>
                              <span>C: ${meal.carbs}g</span>
                              <span>F: ${meal.fat}g</span>
                            </div>
                          </div>
                          
                          <button
                            onClick=${() => handleLogProposedMeal(meal)}
                            className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] tracking-wide flex-shrink-0 transition-colors"
                          >
                            + Log Meal
                          </button>
                        </div>
                      `)}
                    </div>
                  `}
                </div>
              `)}
              
              ${chatLoading && html`
                <div className="flex items-center space-x-2 text-slate-400 text-xs pl-2">
                  <span className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></span>
                  <span>Gemini is thinking...</span>
                </div>
              `}
            </div>

            <form onSubmit=${handleSendChatMessage} className="flex space-x-3 pt-3 border-t border-slate-800/80 flex-shrink-0">
              <input
                type="text"
                value=${chatInput}
                onInput=${(e) => setChatInput(e.target.value)}
                placeholder="Suggest recipes, ask calorie values, or type what you ate to log it..."
                className="flex-grow px-4 py-3 text-xs rounded-xl glass-input focus:ring-1 focus:ring-primary-500"
                disabled=${chatLoading}
                required
              />
              <button
                type="submit"
                disabled=${chatLoading || !chatInput.trim()}
                className="px-5 py-3 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold text-xs tracking-wide transition-colors"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      `}

      ${editingEntry && html`
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit=${handleSaveEditEntry} className="w-full max-w-md glass-card rounded-2xl p-6 border border-white/10 animate-fade-in space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-extrabold font-title text-base text-slate-200">Edit Logged Meal</h3>
              <button type="button" onClick=${() => setEditingEntry(null)} className="text-slate-500 hover:text-slate-300">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Meal Period</label>
                <select
                  value=${editingEntry.meal_type}
                  onChange=${(e) => setEditingEntry({...editingEntry, meal_type: e.target.value})}
                  className="w-full px-2 py-1.5 text-xs rounded-lg glass-input"
                >
                  <option value="Breakfast">Breakfast</option>
                  <option value="Lunch">Lunch</option>
                  <option value="Dinner">Dinner</option>
                  <option value="Snack">Snack</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Meal Time</label>
                <input
                  type="time"
                  value=${(() => {
                    const d = new Date(editingEntry.date);
                    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
                  })()}
                  onChange=${(e) => {
                    const d = new Date(editingEntry.date);
                    const datePart = d.toLocaleDateString('en-CA');
                    setEditingEntry({...editingEntry, date: new Date(datePart + 'T' + e.target.value + ':00').toISOString()});
                  }}
                  className="w-full px-2 py-1.5 text-xs rounded-lg glass-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Description</label>
              <input
                type="text"
                value=${editingEntry.description}
                onInput=${(e) => setEditingEntry({...editingEntry, description: e.target.value})}
                className="w-full px-3 py-2 text-xs rounded-lg glass-input"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Calories (kcal)</label>
                <input
                  type="number"
                  value=${editingEntry.calories}
                  onInput=${(e) => setEditingEntry({...editingEntry, calories: parseInt(e.target.value) || 0})}
                  className="w-full px-2 py-1.5 text-xs rounded-lg glass-input"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Protein (g)</label>
                <input
                  type="number"
                  value=${editingEntry.protein}
                  onInput=${(e) => setEditingEntry({...editingEntry, protein: parseInt(e.target.value) || 0})}
                  className="w-full px-2 py-1.5 text-xs rounded-lg glass-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Carbs (g)</label>
                <input
                  type="number"
                  value=${editingEntry.carbs}
                  onInput=${(e) => setEditingEntry({...editingEntry, carbs: parseInt(e.target.value) || 0})}
                  className="w-full px-2 py-1.5 text-xs rounded-lg glass-input"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Fat (g)</label>
                <input
                  type="number"
                  value=${editingEntry.fat}
                  onInput=${(e) => setEditingEntry({...editingEntry, fat: parseInt(e.target.value) || 0})}
                  className="w-full px-2 py-1.5 text-xs rounded-lg glass-input"
                />
              </div>
            </div>

            <div className="flex space-x-3 pt-3 border-t border-slate-800 mt-6">
              <button
                type="button"
                onClick=${() => setEditingEntry(null)}
                className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs tracking-wider transition-colors"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      `}
    </div>
  `;
}
