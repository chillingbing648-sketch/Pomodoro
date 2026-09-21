import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import BackgroundEngine from "./components/BackgroundEngine";
import BackgroundGallery from "./components/BackgroundGallery";
import {
  STORAGE_KEY,
  DEFAULT_BACKGROUND_ID,
  getBackground,
} from "./data/backgrounds";

const DEFAULT_SETTINGS = { work: 25, short: 5, long: 15 };
const SPOTIFY_PLAYLIST =
  "https://open.spotify.com/embed/playlist/37i9dQZF1DWWQRwui0ExPn?utm_source=generator&theme=0";

function formatTime(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(Number(milliseconds || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function getStoredTasks() {
  try {
    const saved = localStorage.getItem("pomodoro_tasks");
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getStoredBackground() {
  try {
    return getBackground(localStorage.getItem(STORAGE_KEY)).id;
  } catch {
    return DEFAULT_BACKGROUND_ID;
  }
}

export default function App() {
  const [sessionType, setSessionType] = useState("Work");
  const [remainingTime, setRemainingTime] = useState(DEFAULT_SETTINGS.work * 60000);
  const [isRunning, setIsRunning] = useState(false);
  const [workSessions, setWorkSessions] = useState(0);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [backgroundId, setBackgroundId] = useState(getStoredBackground);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [taskInput, setTaskInput] = useState("");
  const [tasks, setTasks] = useState(getStoredTasks);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [brushColor, setBrushColor] = useState("#7c6cff");
  const [brushSize, setBrushSize] = useState(5);

  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const drawingRef = useRef(false);
  const deadlineRef = useRef(null);
  const remainingTimeRef = useRef(DEFAULT_SETTINGS.work * 60000);
  const sessionTypeRef = useRef("Work");
  const settingsRef = useRef(DEFAULT_SETTINGS);
  const workSessionsRef = useRef(0);
  const tasksRef = useRef([]);

  useEffect(() => { sessionTypeRef.current = sessionType; }, [sessionType]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { workSessionsRef.current = workSessions; }, [workSessions]);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  useEffect(() => {
    localStorage.setItem("pomodoro_tasks", JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, backgroundId);
  }, [backgroundId]);

  const showNotification = useCallback((message) => {
    setNotificationMessage(message);
    window.setTimeout(() => setNotificationMessage(""), 3000);
  }, []);

  const sendBrowserNotification = useCallback((title, body) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  }, []);

  const requestNotifications = useCallback(async () => {
    if (!("Notification" in window) || Notification.permission !== "default") return;
    try { await Notification.requestPermission(); } catch { /* optional */ }
  }, []);

  const playCompletionSound = useCallback(() => {
    try {
      const audio = new Audio("https://www.soundjay.com/button/beep-07.wav");
      audio.volume = 0.55;
      audio.play()?.catch(() => {});
    } catch { /* optional */ }
  }, []);

  const addTask = useCallback(() => {
    const title = taskInput.trim();
    if (!title) return;
    setTasks((previous) => [...previous, {
      id: Date.now(),
      title,
      completed: false,
      pomodoros: 0,
    }]);
    setTaskInput("");
  }, [taskInput]);

  const toggleTask = useCallback((taskId) => {
    setTasks((previous) =>
      previous.map((task) =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      )
    );
  }, []);

  const deleteTask = useCallback((taskId) => {
    setTasks((previous) => previous.filter((task) => task.id !== taskId));
  }, []);

  const completeSession = useCallback(() => {
    const currentSession = sessionTypeRef.current;
    const currentSettings = settingsRef.current;
    const currentWorkSessions = workSessionsRef.current;
    const currentTasks = tasksRef.current;

    setIsRunning(false);
    deadlineRef.current = null;
    remainingTimeRef.current = 0;
    setRemainingTime(0);
    playCompletionSound();

    if (currentSession === "Work") {
      const newSessionCount = currentWorkSessions + 1;
      workSessionsRef.current = newSessionCount;
      setWorkSessions(newSessionCount);

      const activeTask = currentTasks.find((task) => !task.completed);
      if (activeTask) {
        setTasks((previous) =>
          previous.map((task) =>
            task.id === activeTask.id
              ? { ...task, pomodoros: task.pomodoros + 1 }
              : task
          )
        );
      }

      const isLongBreak = newSessionCount % 4 === 0;
      const nextType = isLongBreak ? "Long Break" : "Short Break";
      const nextTime = (isLongBreak ? currentSettings.long : currentSettings.short) * 60000;

      sessionTypeRef.current = nextType;
      remainingTimeRef.current = nextTime;
      setSessionType(nextType);
      setRemainingTime(nextTime);

      showNotification(
        isLongBreak
          ? "Long break unlocked. Take some time to reset."
          : "Focus session complete. Short break started."
      );
      sendBrowserNotification(
        isLongBreak ? "Pomodoro Complete" : "Focus Session Complete",
        isLongBreak
          ? "Four focus sessions completed. Long break unlocked."
          : "Your short break is ready."
      );
      return;
    }

    const nextTime = currentSettings.work * 60000;
    sessionTypeRef.current = "Work";
    remainingTimeRef.current = nextTime;
    setSessionType("Work");
    setRemainingTime(nextTime);
    showNotification("Break finished. Ready to focus again.");
    sendBrowserNotification("Break Finished", "Your next focus session is ready.");
  }, [playCompletionSound, showNotification, sendBrowserNotification]);

  useEffect(() => {
    if (!isRunning) return undefined;
    if (deadlineRef.current === null) {
      deadlineRef.current = Date.now() + remainingTimeRef.current;
    }

    const interval = window.setInterval(() => {
      if (deadlineRef.current === null) return;
      const nextRemaining = Math.max(0, deadlineRef.current - Date.now());
      remainingTimeRef.current = nextRemaining;
      setRemainingTime(nextRemaining);

      if (nextRemaining <= 0) {
        window.clearInterval(interval);
        completeSession();
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [isRunning, completeSession]);

  const startTimer = useCallback(() => {
    if (remainingTimeRef.current <= 0) return;
    requestNotifications();
    deadlineRef.current = Date.now() + remainingTimeRef.current;
    setIsRunning(true);
  }, [requestNotifications]);

  const pauseTimer = useCallback(() => {
    if (deadlineRef.current !== null) {
      const currentRemaining = Math.max(0, deadlineRef.current - Date.now());
      remainingTimeRef.current = currentRemaining;
      setRemainingTime(currentRemaining);
    }
    deadlineRef.current = null;
    setIsRunning(false);
  }, []);

  const toggleTimer = useCallback(() => {
    if (isRunning) pauseTimer();
    else startTimer();
  }, [isRunning, pauseTimer, startTimer]);

  const resetTimer = useCallback(() => {
    const nextTime = settingsRef.current.work * 60000;
    deadlineRef.current = null;
    remainingTimeRef.current = nextTime;
    sessionTypeRef.current = "Work";
    workSessionsRef.current = 0;
    setIsRunning(false);
    setSessionType("Work");
    setWorkSessions(0);
    setRemainingTime(nextTime);
    showNotification("Timer reset.");
  }, [showNotification]);

  const applySettings = useCallback(() => {
    const work = Math.min(120, Math.max(1, Number(settings.work) || 25));
    const short = Math.min(60, Math.max(1, Number(settings.short) || 5));
    const long = Math.min(120, Math.max(1, Number(settings.long) || 15));
    const nextSettings = { work, short, long };
    const currentSession = sessionTypeRef.current;
    const nextTime =
      currentSession === "Work"
        ? work * 60000
        : currentSession === "Short Break"
          ? short * 60000
          : long * 60000;

    settingsRef.current = nextSettings;
    remainingTimeRef.current = nextTime;
    deadlineRef.current = null;
    setSettings(nextSettings);
    setRemainingTime(nextTime);
    setIsRunning(false);
    setSettingsOpen(false);
    showNotification("Timer settings updated.");
  }, [settings, showNotification]);

  const handleBackgroundChange = useCallback((nextId) => {
    const safeId = getBackground(nextId).id;
    setBackgroundId(safeId);
    showNotification(`${getBackground(safeId).name} background selected.`);
  }, [showNotification]);

  useEffect(() => {
    if (sessionType !== "Long Break") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.lineCap = "round";
    context.lineJoin = "round";
    contextRef.current = context;
  }, [sessionType]);

  const getCanvasPosition = useCallback((event) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }, []);

  const startDrawing = useCallback((event) => {
    const context = contextRef.current;
    if (!context) return;
    drawingRef.current = true;
    const { x, y } = getCanvasPosition(event);
    context.beginPath();
    context.moveTo(x, y);
    canvasRef.current?.setPointerCapture?.(event.pointerId);
  }, [getCanvasPosition]);

  const draw = useCallback((event) => {
    if (!drawingRef.current) return;
    const context = contextRef.current;
    if (!context) return;
    const { x, y } = getCanvasPosition(event);
    context.lineWidth = Number(brushSize);
    context.strokeStyle = brushColor;
    context.lineTo(x, y);
    context.stroke();
  }, [brushColor, brushSize, getCanvasPosition]);

  const stopDrawing = useCallback(() => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    contextRef.current?.beginPath();
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    const handleKeyboard = (event) => {
      const tag = event.target?.tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
      if (event.code === "Space") {
        event.preventDefault();
        toggleTimer();
      }
      if (event.key.toLowerCase() === "r") resetTimer();
      if (event.key.toLowerCase() === "s") {
        setSettingsOpen((previous) => !previous);
      }
    };
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [toggleTimer, resetTimer]);

  const completedTasks = tasks.filter((task) => task.completed).length;
  const pendingTasks = tasks.length - completedTasks;
  const progress = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;

  return (
    <div className="app-shell">
      <BackgroundEngine backgroundId={backgroundId} />

      <header className="app-header">
        <div className="brand">
          <div className="brand-mark">P</div>
          <div>
            <span className="brand-name">Pomodoro</span>
            <span className="brand-subtitle">Focus workspace</span>
          </div>
        </div>

        <div className="header-actions">
          <div className="session-counter">
            <span>FOCUS SESSIONS</span>
            <strong>{workSessions}</strong>
          </div>
          <button
            className="settings-trigger"
            onClick={() => setSettingsOpen((previous) => !previous)}
            aria-label="Open timer settings"
          >
            Settings
          </button>
        </div>
      </header>

      <main className="dashboard">
        <section className="panel timer-panel">
          <div className="section-label"><span className="status-dot" />{sessionType}</div>

          <div className="timer-heading">
            <h1>Focus Timer</h1>
            <p>Stay present. One session at a time.</p>
          </div>

          <div className={`timer-display ${isRunning ? "timer-running" : ""}`}>
            {formatTime(remainingTime)}
          </div>

          <div className="timer-status">
            {isRunning ? "Session in progress" : "Ready when you are"}
          </div>

          <div className="timer-controls">
            <button className="primary-action" onClick={toggleTimer}>
              {isRunning ? "Pause Focus" : "Start Focus"}
            </button>
            <button className="secondary-action" onClick={resetTimer}>Reset</button>
          </div>

          <div className="timer-meta">
            <div><span>Work</span><strong>{settings.work}m</strong></div>
            <div><span>Short Break</span><strong>{settings.short}m</strong></div>
            <div><span>Long Break</span><strong>{settings.long}m</strong></div>
          </div>

          {settingsOpen && (
            <div className="settings-panel">
              <div className="settings-header">
                <div>
                  <span className="eyebrow">TIMER CONFIGURATION</span>
                  <h3>Session settings</h3>
                </div>
                <button className="close-settings" onClick={() => setSettingsOpen(false)} aria-label="Close settings">×</button>
              </div>

              <div className="settings-grid">
                <label><span>Work</span><input type="number" min="1" max="120" value={settings.work} onChange={(event) => setSettings((p) => ({ ...p, work: event.target.value }))} /></label>
                <label><span>Short break</span><input type="number" min="1" max="60" value={settings.short} onChange={(event) => setSettings((p) => ({ ...p, short: event.target.value }))} /></label>
                <label><span>Long break</span><input type="number" min="1" max="120" value={settings.long} onChange={(event) => setSettings((p) => ({ ...p, long: event.target.value }))} /></label>
              </div>

              <div className="background-settings">
                <div>
                  <span className="eyebrow">ATMOSPHERE</span>
                  <h3>Background Gallery</h3>
                  <p>Choose a visual environment without affecting the timer.</p>
                </div>
                <BackgroundGallery value={backgroundId} onChange={handleBackgroundChange} />
              </div>

              <button className="apply-settings" onClick={applySettings}>Apply Configuration</button>
            </div>
          )}
        </section>

        <section className="panel spotify-panel">
          <div className="spotify-heading">
            <div>
              <span className="eyebrow">FOCUS SOUNDTRACK</span>
              <h2>Study Playlist</h2>
              <p>Keep your focus environment exactly where you want it.</p>
            </div>
            <div className="spotify-symbol">●</div>
          </div>
          <div className="spotify-widget">
            <iframe
              title="Spotify Study Playlist"
              src={SPOTIFY_PLAYLIST}
              width="100%"
              height="352"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
            />
          </div>
        </section>

        <section className="panel tasks-panel">
          <div className="tasks-header">
            <div>
              <span className="eyebrow">TODAY'S WORK</span>
              <h2>Focus Tasks</h2>
              <p>Turn your Pomodoros into visible progress.</p>
            </div>
            <div className="task-progress"><strong>{progress}%</strong><span>{completedTasks}/{tasks.length}</span></div>
          </div>

          <div className="task-input">
            <input
              type="text"
              placeholder="What are you focusing on?"
              value={taskInput}
              onChange={(event) => setTaskInput(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && addTask()}
            />
            <button onClick={addTask}>Add Task</button>
          </div>

          <div className="task-list">
            {tasks.length === 0 ? (
              <div className="empty-tasks">
                <span className="empty-icon">+</span>
                <div><strong>No focus tasks yet</strong><p>Add something you want to complete during your next session.</p></div>
              </div>
            ) : tasks.map((task) => (
              <div className={`task-item ${task.completed ? "task-completed" : ""}`} key={task.id}>
                <button className="task-check" onClick={() => toggleTask(task.id)} aria-label={task.completed ? "Mark task incomplete" : "Complete task"}>
                  {task.completed ? "✓" : ""}
                </button>
                <div className="task-content">
                  <span className="task-title">{task.title}</span>
                  <span className="task-pomodoros">{task.pomodoros} Pomodoro{task.pomodoros === 1 ? "" : "s"}</span>
                </div>
                <button className="task-delete" onClick={() => deleteTask(task.id)} aria-label="Delete task">×</button>
              </div>
            ))}
          </div>

          {tasks.length > 0 && (
            <div className="task-summary"><span>{pendingTasks} remaining</span><span>{completedTasks} completed</span></div>
          )}
        </section>

        <section className="panel break-panel">
          {sessionType !== "Long Break" ? (
            <div className="break-locked">
              <span className="eyebrow">LONG BREAK SPACE</span>
              <h2>Your reset space</h2>
              <p>Complete four focus sessions to unlock the creative break workspace.</p>
              <div className="break-progress"><span style={{ width: `${(workSessions % 4) * 25}%` }} /></div>
              <small>{4 - (workSessions % 4)} sessions until long break</small>
            </div>
          ) : (
            <div className="drawing-workspace">
              <div className="drawing-header">
                <div><span className="eyebrow">LONG BREAK</span><h2>Creative Reset</h2></div>
                <span className="break-badge">Unlocked</span>
              </div>
              <div className="canvas-container">
                <canvas
                  ref={canvasRef}
                  width={900}
                  height={420}
                  onPointerDown={startDrawing}
                  onPointerMove={draw}
                  onPointerUp={stopDrawing}
                  onPointerCancel={stopDrawing}
                  onPointerLeave={stopDrawing}
                />
              </div>
              <div className="drawing-controls">
                <label>Color <input type="color" value={brushColor} onChange={(event) => setBrushColor(event.target.value)} /></label>
                <label className="brush-control">Brush <input type="range" min="1" max="30" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} /></label>
                <button className="clear-canvas" onClick={clearCanvas}>Clear Canvas</button>
              </div>
            </div>
          )}
        </section>
      </main>

      <footer className="app-footer">
        <span><kbd>Space</kbd>Start / Pause</span>
        <span><kbd>R</kbd>Reset</span>
        <span><kbd>S</kbd>Settings</span>
      </footer>

      {notificationMessage && (
        <div className="toast" role="status"><span className="toast-dot" />{notificationMessage}</div>
      )}
    </div>
  );
}
