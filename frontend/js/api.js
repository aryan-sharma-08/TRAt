// TRAt API Integration Wrapper

const API_BASE = '/api';

function getHeaders() {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request(url, options = {}) {
  options.headers = { ...getHeaders(), ...options.headers };
  
  try {
    const response = await fetch(url, options);
    
    if (response.status === 401) {
      // Session expired or invalid token
      localStorage.removeItem('token');
      // Trigger a window event so React can react to auth expiration
      window.dispatchEvent(new Event('auth_expired'));
    }
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.detail || 'An error occurred';
      throw new Error(message);
    }
    
    if (response.status === 204) return null;
    return response.json();
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}

// Sync offline updates when returning online
async function syncOfflineUpdates() {
  if (!navigator.onLine) return;
  
  const taskUpdatesStr = localStorage.getItem('offline_task_updates');
  if (taskUpdatesStr) {
    const queue = JSON.parse(taskUpdatesStr);
    const failed = [];
    
    for (const update of queue) {
      try {
        const response = await fetch(`${API_BASE}/tasks/${update.id}`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify(update.data)
        });
        if (!response.ok) throw new Error('Sync failed');
      } catch (err) {
        failed.push(update);
      }
    }
    
    if (failed.length > 0) {
      localStorage.setItem('offline_task_updates', JSON.stringify(failed));
    } else {
      localStorage.removeItem('offline_task_updates');
      console.log('[PWA Sync] All offline task updates synced successfully.');
    }
  }
}

// Window network status listeners
window.addEventListener('online', syncOfflineUpdates);
setTimeout(syncOfflineUpdates, 1500); // Check on startup

export const API = {
  auth: {
    async register(email, password) {
      const data = await request(`${API_BASE}/auth/register`, {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      localStorage.setItem('token', data.access_token);
      return data.user;
    },
    
    async login(email, password) {
      const data = await request(`${API_BASE}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      localStorage.setItem('token', data.access_token);
      return data.user;
    },
    
    async me() {
      return request(`${API_BASE}/auth/me`);
    },
    
    logout() {
      localStorage.removeItem('token');
      window.dispatchEvent(new Event('auth_expired'));
    }
  },
  
  tasks: {
    async getAll() {
      return request(`${API_BASE}/tasks`);
    },
    
    async create(task) {
      return request(`${API_BASE}/tasks`, {
        method: 'POST',
        body: JSON.stringify(task)
      });
    },
    
    async update(id, taskData) {
      if (!navigator.onLine) {
        // Queue task updates locally when offline
        const taskUpdatesStr = localStorage.getItem('offline_task_updates') || '[]';
        const queue = JSON.parse(taskUpdatesStr);
        const filtered = queue.filter(item => item.id !== id);
        filtered.push({ id, data: taskData });
        localStorage.setItem('offline_task_updates', JSON.stringify(filtered));
        console.log(`[PWA Offline] Queued task update locally for task ${id}`);
        return { id, ...taskData };
      }
      
      return request(`${API_BASE}/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(taskData)
      });
    },
    
    async delete(id) {
      return request(`${API_BASE}/tasks/${id}`, {
        method: 'DELETE'
      });
    }
  },

  diet: {
    async getAll(dateStr) {
      return request(`${API_BASE}/diet?date=${dateStr}`);
    },
    
    async create(entry) {
      return request(`${API_BASE}/diet`, {
        method: 'POST',
        body: JSON.stringify(entry)
      });
    },
    
    async update(id, entryData) {
      return request(`${API_BASE}/diet/${id}`, {
        method: 'PUT',
        body: JSON.stringify(entryData)
      });
    },
    
    async delete(id) {
      return request(`${API_BASE}/diet/${id}`, {
        method: 'DELETE'
      });
    }
  },

  study: {
    async getSubjects() {
      return request(`${API_BASE}/study/subjects`);
    },
    
    async createSubject(subject) {
      return request(`${API_BASE}/study/subjects`, {
        method: 'POST',
        body: JSON.stringify(subject)
      });
    },
    
    async updateSubject(id, subjectData) {
      return request(`${API_BASE}/study/subjects/${id}`, {
        method: 'PUT',
        body: JSON.stringify(subjectData)
      });
    },
    
    async deleteSubject(id) {
      return request(`${API_BASE}/study/subjects/${id}`, {
        method: 'DELETE'
      });
    },
    
    async getBlocks() {
      return request(`${API_BASE}/study/blocks`);
    },
    
    async createBlock(block) {
      return request(`${API_BASE}/study/blocks`, {
        method: 'POST',
        body: JSON.stringify(block)
      });
    },
    
    async deleteBlock(id) {
      return request(`${API_BASE}/study/blocks/${id}`, {
        method: 'DELETE'
      });
    },
    
    async getSessions() {
      return request(`${API_BASE}/study/sessions`);
    },
    
    async logSession(sessionData) {
      return request(`${API_BASE}/study/sessions`, {
        method: 'POST',
        body: JSON.stringify(sessionData)
      });
    }
  },

  ai: {
    async generateSchedule(goals, hours) {
      return request(`${API_BASE}/ai/schedule`, {
        method: 'POST',
        body: JSON.stringify({ goals, available_hours: String(hours) })
      });
    },
    
    async generateDiet(goal, preference, restrictions) {
      return request(`${API_BASE}/ai/diet`, {
        method: 'POST',
        body: JSON.stringify({ goal, preference, restrictions })
      });
    },
    
    async chatDiet(message, history) {
      return request(`${API_BASE}/ai/diet/chat`, {
        method: 'POST',
        body: JSON.stringify({ message, history })
      });
    },
    
    async rebalanceStudy(goals) {
      return request(`${API_BASE}/ai/rebalance`, {
        method: 'POST',
        body: JSON.stringify({ goals })
      });
    }
  }
};
export default API;
