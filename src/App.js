import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Lock, ChevronLeft, ChevronRight, Download, Upload, Moon, Sun } from 'lucide-react';
import { onAuthStateChange, loginUser, registerUser, logoutUser, saveUserData, subscribeToUserData } from './firebase';

export default function TaskTracker() {
  const [confetti, setConfetti] = useState([]);
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [tasks, setTasks] = useState([]);
  const [taskInput, setTaskInput] = useState('');
  const [completedDates, setCompletedDates] = useState({});
  const [dayTasks, setDayTasks] = useState({});
  const [dayTaskLocks, setDayTaskLocks] = useState({});
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [backupMessage, setBackupMessage] = useState('');
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const [isRegister, setIsRegister] = useState(false);

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  // Check Firebase auth state and load data
  useEffect(() => {
    let unsubscribeListener = null;
    
    const unsubscribeAuth = onAuthStateChange((currentUser) => {
      // Unsubscribe from previous listener if exists
      if (unsubscribeListener) {
        unsubscribeListener();
      }

      if (currentUser) {
        setUser(currentUser);
        setIsLoggedIn(true);
        // Subscribe to real-time data updates
        unsubscribeListener = subscribeToUserData(currentUser.uid, (data) => {
          if (data) {
            setTasks(data.tasks || []);
            setCompletedDates(data.completedDates || {});
            setDayTasks(data.dayTasks || {});
            setDayTaskLocks(data.dayTaskLocks || {});
          }
        });
      } else {
        setUser(null);
        setIsLoggedIn(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeListener) {
        unsubscribeListener();
      }
    };
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('taskTrackerData');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setTasks(data.tasks || []);
        setCompletedDates(data.completedDates || {});
        setDayTasks(data.dayTasks || {});
        setDayTaskLocks(data.dayTaskLocks || {});
      } catch (e) {
        console.log('Could not load data');
      }
    }
  }, []);

  // Save data to Firebase when it changes
  useEffect(() => {
    if (!user || !isLoggedIn) return;

    saveUserData(user.uid, {
      tasks,
      completedDates,
      dayTasks,
      dayTaskLocks,
      lastUpdated: new Date().toISOString()
    });
  }, [tasks, completedDates, dayTasks, dayTaskLocks, user, isLoggedIn]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      await loginUser(username, password);
      setUsername('');
      setPassword('');
    } catch (error) {
      setAuthError(error.message);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      await registerUser(username, password);
      setUsername('');
      setPassword('');
    } catch (error) {
      setAuthError(error.message);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    setTasks([]);
    setCompletedDates({});
    setDayTasks({});
    setDayTaskLocks({});
    setCurrentStreak(0);
    setLongestStreak(0);
    setSelectedDate(new Date());
    localStorage.removeItem('taskTrackerData');
  };

  const formatDateKey = useCallback((date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const getTasksForDate = useCallback((date) => {
    const dateStr = formatDateKey(date);
    const daySpecificTasks = dayTasks[dateStr] || [];
    const dayLocks = dayTaskLocks[dateStr] || {};

    return daySpecificTasks.map(id => {
      const task = tasks.find(t => t.id === id);
      if (task) {
        const isLocked = dayLocks[id] === true;
        return { ...task, lockedForDay: isLocked };
      }
      return null;
    }).filter(Boolean);
  }, [formatDateKey, tasks, dayTasks, dayTaskLocks]);

  const handleAddTask = () => {
    if (!taskInput.trim()) return;

    const newTask = {
      id: Date.now(),
      name: taskInput.trim(),
      dateCreated: formatDateKey(selectedDate)
    };

    const dateStr = formatDateKey(selectedDate);
    setTasks([...tasks, newTask]);
    setDayTasks({
      ...dayTasks,
      [dateStr]: [...(dayTasks[dateStr] || []), newTask.id]
    });
    setTaskInput('');
  };

  const handleToggleComplete = (taskId, e) => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const selectedStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    
    if (selectedStart > todayStart) return;

    const dateStr = formatDateKey(selectedDate);
    const completed = completedDates[dateStr] || [];

    if (completed.includes(taskId)) {
      setCompletedDates({
        ...completedDates,
        [dateStr]: completed.filter(id => id !== taskId)
      });
    } else {
      const newCompleted = [...completed, taskId];
      setCompletedDates({
        ...completedDates,
        [dateStr]: newCompleted
      });

      const tasksForDay = getTasksForDate(selectedDate);
      if (newCompleted.length === tasksForDay.length && tasksForDay.length > 0) {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        createConfetti(x, y);
      }
    }
  };

  const createConfetti = (x, y) => {
    const newConfetti = Array.from({ length: 30 }, () => ({
      id: Math.random(),
      left: x,
      top: y,
      delay: Math.random() * 0.1,
      duration: 2 + Math.random() * 1,
      angle: Math.random() * 360,
      distance: 100 + Math.random() * 150
    }));

    setConfetti(newConfetti);
    setTimeout(() => setConfetti([]), 3000);
  };

  const handleToggleLockForDay = (taskId) => {
    const dateStr = formatDateKey(selectedDate);
    const dayLocks = dayTaskLocks[dateStr] || {};
    const isCurrentlyLocked = dayLocks[taskId] || false;
    const task = tasks.find(t => t.id === taskId);

    if (task) {
      const tomorrow = new Date(selectedDate);
      tomorrow.setDate(tomorrow.getDate() + 1);

      if (!isCurrentlyLocked) {
        const updatedTasks = [...tasks];
        const updatedDayTasks = { ...dayTasks };
        const updatedDayTaskLocks = { ...dayTaskLocks };

        for (let day = 1; day <= 365; day++) {
          const futureDate = new Date(selectedDate);
          futureDate.setDate(futureDate.getDate() + day);
          const futureDateStr = formatDateKey(futureDate);

          const newTaskId = Date.now() + day;
          const newTaskCopy = {
            ...task,
            id: newTaskId,
            dateCreated: futureDateStr
          };

          updatedTasks.push(newTaskCopy);

          if (!updatedDayTasks[futureDateStr]) {
            updatedDayTasks[futureDateStr] = [];
          }
          updatedDayTasks[futureDateStr].push(newTaskId);

          if (!updatedDayTaskLocks[futureDateStr]) {
            updatedDayTaskLocks[futureDateStr] = {};
          }
          updatedDayTaskLocks[futureDateStr][newTaskId] = true;
        }

        setTasks(updatedTasks);
        setDayTasks(updatedDayTasks);
        setDayTaskLocks(updatedDayTaskLocks);
      } else {
        const updatedTasks = tasks.filter(t => t.id !== taskId);
        const updatedDayTasks = { ...dayTasks };
        const updatedDayTaskLocks = { ...dayTaskLocks };
        const newCompleted = { ...completedDates };

        Object.keys(updatedDayTasks).forEach(dateStr => {
          const [year, month, day] = dateStr.split('-').map(Number);
          const checkDate = new Date(year, month - 1, day);

          if (checkDate >= tomorrow) {
            updatedDayTasks[dateStr] = updatedDayTasks[dateStr].filter(id => {
              const t = tasks.find(task => task.id === id);
              return !(t && t.name === task.name);
            });
          }
        });

        Object.keys(updatedDayTaskLocks).forEach(dateStr => {
          const [year, month, day] = dateStr.split('-').map(Number);
          const checkDate = new Date(year, month - 1, day);

          if (checkDate >= tomorrow) {
            const updated = { ...updatedDayTaskLocks[dateStr] };
            delete updated[taskId];
            updatedDayTaskLocks[dateStr] = updated;
          }
        });

        Object.keys(newCompleted).forEach(date => {
          newCompleted[date] = newCompleted[date].filter(id => {
            const t = updatedTasks.find(task => task.id === id);
            return t !== undefined;
          });
        });

        setTasks(updatedTasks);
        setDayTasks(updatedDayTasks);
        setDayTaskLocks(updatedDayTaskLocks);
        setCompletedDates(newCompleted);
      }
    }

    setDayTaskLocks(prev => ({
      ...prev,
      [dateStr]: {
        ...prev[dateStr],
        [taskId]: !isCurrentlyLocked
      }
    }));
  };

  const handleDeleteTask = (taskId) => {
    setTasks(tasks.filter(t => t.id !== taskId));
    const newDayTasks = { ...dayTasks };
    Object.keys(newDayTasks).forEach(date => {
      newDayTasks[date] = newDayTasks[date].filter(id => id !== taskId);
    });
    setDayTasks(newDayTasks);

    const newCompleted = { ...completedDates };
    Object.keys(newCompleted).forEach(date => {
      newCompleted[date] = newCompleted[date].filter(id => id !== taskId);
    });
    setCompletedDates(newCompleted);
  };

  const getDateStatus = (date) => {
    const tasksForDay = getTasksForDate(date);
    if (tasksForDay.length === 0) return 'empty';

    const dateStr = formatDateKey(date);
    const completed = completedDates[dateStr] || [];
    const validCompleted = completed.filter(id => tasksForDay.find(t => t.id === id));

    if (validCompleted.length === tasksForDay.length && tasksForDay.length > 0) return 'complete';
    if (validCompleted.length > 0) return 'partial';
    return 'none';
  };

  useEffect(() => {
    const today = new Date();
    let current = 0;
    let longest = 0;
    let tempStreak = 0;

    for (let day = 0; day < 365; day++) {
      const date = new Date(today);
      date.setDate(date.getDate() - day);
      const dateStr = formatDateKey(date);

      const tasksForDay = getTasksForDate(date);
      const completed = completedDates[dateStr] || [];
      const validCompleted = completed.filter(id => tasksForDay.find(t => t.id === id));

      if (tasksForDay.length > 0 && validCompleted.length === tasksForDay.length) {
        tempStreak++;
        if (day === 0) current = tempStreak;
      } else {
        if (tempStreak > longest) longest = tempStreak;
        tempStreak = 0;
      }
    }
    if (tempStreak > longest) longest = tempStreak;

    setCurrentStreak(current);
    setLongestStreak(longest);
  }, [tasks, completedDates, dayTasks, dayTaskLocks, getTasksForDate, formatDateKey]);

  const downloadBackup = () => {
    const backup = {
      tasks,
      completedDates,
      dayTasks,
      dayTaskLocks,
      backupDate: new Date().toISOString()
    };

    const dataStr = JSON.stringify(backup, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `task-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();

    setBackupMessage('✓ Backup downloaded successfully!');
    setTimeout(() => setBackupMessage(''), 3000);
  };

  const uploadBackup = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const backup = JSON.parse(e.target.result);
        setTasks(backup.tasks || []);
        setCompletedDates(backup.completedDates || {});
        setDayTasks(backup.dayTasks || {});
        setDayTaskLocks(backup.dayTaskLocks || {});
        setBackupMessage('✓ Backup restored successfully!');
        setTimeout(() => setBackupMessage(''), 3000);
      } catch (error) {
        setBackupMessage('✗ Error restoring backup. File may be corrupted.');
        setTimeout(() => setBackupMessage(''), 3000);
      }
    };
    reader.readAsText(file);
  };

  const renderCalendar = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const statusColors = {
      complete: 'bg-green-500',
      partial: 'bg-yellow-400',
      none: 'bg-gray-300',
      empty: 'bg-gray-200'
    };

    return (
      <div>
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={() => setSelectedDate(new Date(year, month - 1, 1))}
            className={`p-1 rounded transition ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
          >
            <ChevronLeft size={20} />
          </button>
          <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
            {firstDay.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </h3>
          <button
            onClick={() => setSelectedDate(new Date(year, month + 1, 1))}
            className={`p-1 rounded transition ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-4">
          {weekDays.map(day => (
            <div key={day} className={`text-center text-xs font-bold py-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {day}
            </div>
          ))}
          {days.map((day, idx) => {
            if (!day) {
              return <div key={`empty-${idx}`} className="aspect-square"></div>;
            }

            const status = getDateStatus(day);
            const isSelected = day.toDateString() === selectedDate.toDateString();
            const today = new Date();
            const isToday = day.toDateString() === today.toDateString();

            return (
              <button
                key={idx}
                onClick={() => setSelectedDate(day)}
                className={`aspect-square rounded flex items-center justify-center font-semibold text-sm transition ${
                  statusColors[status]
                } ${isSelected ? 'ring-2 ring-purple-500' : ''} ${
                  isToday ? 'ring-2 ring-blue-500' : ''
                } hover:opacity-80`}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>

        <div className={`text-xs space-y-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>All complete</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-400 rounded"></div>
            <span>Partial</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-300 rounded"></div>
            <span>None</span>
          </div>
        </div>
      </div>
    );
  };

  const tasksForDay = getTasksForDate(selectedDate);
  const dateStr = formatDateKey(selectedDate);
  const completed = completedDates[dateStr] || [];
  const validCompleted = completed.filter(id => tasksForDay.find(t => t.id === id));
  const progress = tasksForDay.length > 0 ? Math.round((validCompleted.length / tasksForDay.length) * 100) : 0;

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-lg shadow-2xl p-8">
          <h1 className="text-3xl font-bold text-gray-800 text-center mb-8">Task Tracker</h1>
          
          <form onSubmit={isRegister ? handleRegister : handleLogin} className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your email"
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
            {authError && <p className="text-red-500 text-sm">{authError}</p>}
            <button
              type="submit"
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 rounded-lg transition"
            >
              {isRegister ? 'Create Account' : 'Login'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-600">
            {isRegister ? 'Already have an account? ' : "Don't have an account? "}
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setAuthError('');
              }}
              className="text-blue-500 hover:text-blue-600 font-semibold"
            >
              {isRegister ? 'Login' : 'Sign up'}
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gradient-to-br from-gray-900 to-gray-800' : 'bg-gradient-to-br from-slate-900 to-slate-800'} p-4 md:p-6`}>
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white">Task Tracker - Daily Goals</h1>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`p-2 rounded-lg transition ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-slate-700 hover:bg-slate-600'}`}
          >
            {darkMode ? <Sun size={20} className="text-yellow-400" /> : <Moon size={20} className="text-gray-300" />}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6 relative`} data-confetti-target>
              {confetti.map(c => (
                <div
                  key={c.id}
                  className="fixed pointer-events-none"
                  style={{
                    left: `${c.left}px`,
                    top: `${c.top}px`,
                    width: '10px',
                    height: '10px',
                    backgroundColor: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'][Math.floor(Math.random() * 5)],
                    borderRadius: '50%',
                    animation: `confetti-fall ${c.duration}s ease-out ${c.delay}s forwards`,
                    '--angle': `${c.angle}deg`,
                    '--distance': `${c.distance}px`
                  }}
                />
              ))}
              <style>{`
                @keyframes confetti-fall {
                  to {
                    transform: translate(calc(cos(var(--angle)) * var(--distance)), calc(sin(var(--angle)) * var(--distance))) rotateZ(720deg);
                    opacity: 0;
                  }
                }
              `}</style>

              <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'} mb-1`}>
                {selectedDate.toDateString() === new Date().toDateString() ? 'Today' : selectedDate.toDateString()}
              </h2>
              {selectedDate.toDateString() === new Date().toDateString() && (
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-4`}>{selectedDate.toDateString()}</p>
              )}

              <div className="mb-6">
                <div className={`flex justify-between text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-2`}>
                  <span>Tasks Progress</span>
                  <span>{validCompleted.length} / {tasksForDay.length}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div className="bg-green-500 h-3 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                </div>
              </div>

              <div className="space-y-3 mb-8 max-h-96 overflow-y-auto">
                {tasksForDay.length === 0 ? (
                  <p className={`text-center py-8 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>No tasks for this day. Add one below!</p>
                ) : (
                  tasksForDay.map(task => {
                    const isCompleted = validCompleted.includes(task.id);
                    return (
                      <div
                        key={task.id}
                        className={`flex items-center gap-3 p-4 rounded-lg transition ${
                          isCompleted ? (darkMode ? 'bg-green-900' : 'bg-green-100') : (darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-50 hover:bg-gray-100')
                        }`}
                      >
                        <button
                          onClick={(e) => handleToggleComplete(task.id, e)}
                          disabled={selectedDate > new Date()}
                          className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition ${
                            isCompleted ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-500'
                          } ${selectedDate > new Date() ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                        >
                          {isCompleted && (
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                            </svg>
                          )}
                        </button>

                        <span className={`flex-1 ${isCompleted ? (darkMode ? 'line-through text-gray-500' : 'line-through text-gray-400') : (darkMode ? 'text-gray-200' : 'text-gray-800')}`}>
                          {task.name}
                        </span>

                        <button
                          onClick={() => handleToggleLockForDay(task.id)}
                          className={`flex-shrink-0 transition cursor-pointer ${
                            task.lockedForDay ? 'text-amber-600 hover:text-amber-700' : 'text-gray-400 hover:text-gray-600'
                          }`}
                        >
                          <Lock size={18} />
                        </button>

                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          disabled={task.lockedForDay}
                          className={`flex-shrink-0 transition ${
                            task.lockedForDay ? 'text-gray-300 cursor-not-allowed' : 'text-red-500 hover:text-red-700'
                          }`}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              <div className={`border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'} pt-6 mt-6`}>
                <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-3`}>Add New Task</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={taskInput}
                    onChange={(e) => setTaskInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTask();
                      }
                    }}
                    placeholder="Type a task name..."
                    className={`flex-1 px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 ${
                      darkMode 
                        ? 'bg-gray-700 text-white border-gray-600 focus:border-blue-500 focus:ring-blue-900' 
                        : 'border-gray-300 text-gray-800 focus:border-blue-500 focus:ring-blue-200'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={handleAddTask}
                    className="bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white px-6 py-3 rounded-lg transition font-semibold flex items-center gap-2 flex-shrink-0"
                  >
                    <Plus size={18} />
                    Add
                  </button>
                </div>
                <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'} mt-2`}>💡 Lock an important task to copy it to all future days</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
              <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-800'} mb-4`}>Progress Calendar</h3>
              {renderCalendar()}
            </div>

            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
              <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-800'} mb-4`}>Streaks</h3>
              <div className="space-y-4">
                <div className={`p-4 rounded-lg border-l-4 ${darkMode ? 'bg-green-900 border-green-500' : 'bg-green-50 border-green-500'}`}>
                  <p className={`text-sm ${darkMode ? 'text-green-300' : 'text-gray-600'}`}>Current Streak</p>
                  <p className={`text-3xl font-bold ${darkMode ? 'text-green-400' : 'text-green-600'}`}>{currentStreak}</p>
                  <p className={`text-xs ${darkMode ? 'text-green-400' : 'text-gray-500'}`}>days</p>
                </div>
                <div className={`p-4 rounded-lg border-l-4 ${darkMode ? 'bg-blue-900 border-blue-500' : 'bg-blue-50 border-blue-500'}`}>
                  <p className={`text-sm ${darkMode ? 'text-blue-300' : 'text-gray-600'}`}>Longest Streak</p>
                  <p className={`text-3xl font-bold ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>{longestStreak}</p>
                  <p className={`text-xs ${darkMode ? 'text-blue-400' : 'text-gray-500'}`}>days</p>
                </div>
              </div>
            </div>

            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
              <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-800'} mb-4`}>Data Backup</h3>
              <div className="flex gap-3">
                <button
                  onClick={downloadBackup}
                  className="flex-1 flex items-center justify-center gap-1 bg-green-500 hover:bg-green-600 text-white px-2 py-2 text-sm rounded-lg transition font-semibold"
                >
                  <Download size={14} />
                  Download
                </button>
                <label className="flex-1">
                  <button
                    type="button"
                    className="w-full flex items-center justify-center gap-1 bg-blue-500 hover:bg-blue-600 text-white px-2 py-2 text-sm rounded-lg transition font-semibold"
                  >
                    <Upload size={14} />
                    Restore
                  </button>
                  <input
                    type="file"
                    accept=".json"
                    onChange={uploadBackup}
                    className="hidden"
                  />
                </label>
              </div>
              {backupMessage && (
                <p className={`text-sm mt-3 text-center ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{backupMessage}</p>
              )}
            </div>

            <button
              onClick={handleLogout}
              className={`w-full px-4 py-2 rounded-lg transition font-semibold ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-500 hover:bg-gray-600 text-white'}`}
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}