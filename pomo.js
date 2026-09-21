/* =========================================================
   GALAXY POMODORO
   Core Timer + Settings + Doodle Workspace
========================================================= */

/* =========================================================
   1. STATE
========================================================= */

const state = {
  sessionType: "Work",
  workSessions: 0,

  durations: {
    work: 25 * 60 * 1000,
    short: 5 * 60 * 1000,
    long: 15 * 60 * 1000,
  },

  remainingTime: 25 * 60 * 1000,

  isRunning: false,
  timerFrame: null,
  lastTick: null,
};


/* =========================================================
   2. DOM REFERENCES
========================================================= */

const sessionTypeElement =
  document.getElementById("session-type");

const timeElement =
  document.getElementById("time");

const startStopButton =
  document.getElementById("start-stop");

const resetButton =
  document.getElementById("reset");

const workSessionsElement =
  document.getElementById("work-sessions");

const workDurationInput =
  document.getElementById("work-duration");

const shortBreakInput =
  document.getElementById("short-break");

const longBreakInput =
  document.getElementById("long-break");

const applySettingsBtn =
  document.getElementById("apply-settings");


/* =========================================================
   3. TIMER UTILITIES
========================================================= */

function formatTime(milliseconds) {
  const safeTime = Math.max(
    0,
    Number(milliseconds) || 0
  );

  const totalSeconds =
    Math.ceil(safeTime / 1000);

  const hours =
    Math.floor(totalSeconds / 3600);

  const minutes =
    Math.floor((totalSeconds % 3600) / 60);

  const seconds =
    totalSeconds % 60;

  return [
    hours,
    minutes,
    seconds,
  ]
    .map(value =>
      String(value).padStart(2, "0")
    )
    .join(":");
}


function getCurrentDuration() {
  switch (state.sessionType) {
    case "Short Break":
      return state.durations.short;

    case "Long Break":
      return state.durations.long;

    default:
      return state.durations.work;
  }
}


function updateDisplay() {
  timeElement.textContent =
    formatTime(state.remainingTime);

  sessionTypeElement.textContent =
    state.sessionType;

  workSessionsElement.textContent =
    state.workSessions;

  updateTimerStatus();
}


function updateTimerStatus() {
  const statusText =
    document.querySelector(".timer-status span:last-child");

  if (!statusText) return;

  if (state.isRunning) {
    statusText.textContent =
      "Focus session in progress";
  } else if (
    state.remainingTime === getCurrentDuration()
  ) {
    statusText.textContent =
      "Ready to focus";
  } else {
    statusText.textContent =
      "Session paused";
  }
}


/* =========================================================
   4. TIMER ENGINE
========================================================= */

function startTimer() {
  if (state.isRunning) return;

  state.isRunning = true;
  state.lastTick = performance.now();

  startStopButton.textContent = "Pause";

  updateDisplay();

  state.timerFrame =
    requestAnimationFrame(runTimer);
}


function runTimer(timestamp) {
  if (!state.isRunning) return;

  const elapsed =
    timestamp - state.lastTick;

  state.lastTick = timestamp;

  state.remainingTime -= elapsed;

  if (state.remainingTime <= 0) {
    state.remainingTime = 0;

    updateDisplay();

    completeSession();

    return;
  }

  updateDisplay();

  state.timerFrame =
    requestAnimationFrame(runTimer);
}


function pauseTimer() {
  if (!state.isRunning) return;

  state.isRunning = false;

  if (state.timerFrame) {
    cancelAnimationFrame(state.timerFrame);
    state.timerFrame = null;
  }

  state.lastTick = null;

  startStopButton.textContent = "Start";

  updateDisplay();
}


function toggleTimer() {
  if (state.isRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
}


/* =========================================================
   5. SESSION MANAGEMENT
========================================================= */

function completeSession() {
  state.isRunning = false;

  if (state.timerFrame) {
    cancelAnimationFrame(state.timerFrame);
    state.timerFrame = null;
  }

  if (state.sessionType === "Work") {
    state.workSessions += 1;

    state.sessionType =
      state.workSessions % 4 === 0
        ? "Long Break"
        : "Short Break";
  } else {
    state.sessionType = "Work";
  }

  state.remainingTime =
    getCurrentDuration();

  updateDisplay();

  toggleDoodlePad();

  playCompletionSound();

  /*
    Give the user a moment to see the completed
    session before automatically starting the next one.
  */
  startStopButton.textContent = "Start";

  setTimeout(() => {
    if (!state.isRunning) {
      startTimer();
    }
  }, 1200);
}


function resetTimer() {
  pauseTimer();

  state.sessionType = "Work";
  state.workSessions = 0;
  state.remainingTime =
    state.durations.work;

  startStopButton.textContent = "Start";

  toggleDoodlePad();

  updateDisplay();
}


/* =========================================================
   6. TIMER CONTROLS
========================================================= */

startStopButton.addEventListener(
  "click",
  toggleTimer
);

resetButton.addEventListener(
  "click",
  resetTimer
);


/* =========================================================
   7. CUSTOM SESSION SETTINGS
========================================================= */

function readDuration(input, fallback, min, max) {
  const value =
    Number.parseInt(input.value, 10);

  if (
    Number.isNaN(value) ||
    value < min ||
    value > max
  ) {
    input.value = fallback / 60000;
    return fallback;
  }

  return value * 60000;
}


function applySettings() {
  state.durations.work =
    readDuration(
      workDurationInput,
      25 * 60000,
      1,
      60
    );

  state.durations.short =
    readDuration(
      shortBreakInput,
      5 * 60000,
      1,
      30
    );

  state.durations.long =
    readDuration(
      longBreakInput,
      15 * 60000,
      1,
      60
    );

  pauseTimer();

  state.remainingTime =
    getCurrentDuration();

  updateDisplay();

  showSettingsSuccess();
}


function showSettingsSuccess() {
  if (!applySettingsBtn) return;

  const originalText =
    applySettingsBtn.textContent;

  applySettingsBtn.textContent =
    "Timer Updated";

  applySettingsBtn.classList.add(
    "settings-success"
  );

  setTimeout(() => {
    applySettingsBtn.textContent =
      originalText;

    applySettingsBtn.classList.remove(
      "settings-success"
    );
  }, 1800);
}


applySettingsBtn.addEventListener(
  "click",
  applySettings
);


/* =========================================================
   8. COMPLETION SOUND
========================================================= */

function playCompletionSound() {
  try {
    const audio =
      new Audio(
        "https://www.soundjay.com/button/beep-07.wav"
      );

    audio.volume = 0.45;

    const playback =
      audio.play();

    if (playback?.catch) {
      playback.catch(() => {
        /*
          Browser autoplay restrictions may block
          external audio. Timer functionality continues.
        */
      });
    }
  } catch (error) {
    console.warn(
      "Completion sound unavailable.",
      error
    );
  }
}


/* =========================================================
   9. DOODLE CANVAS
========================================================= */

const canvas =
  document.getElementById("doodle-pad");

const ctx =
  canvas?.getContext("2d");

const colorPicker =
  document.getElementById("color-picker");

const brushSize =
  document.getElementById("brush-size");

const clearBtn =
  document.getElementById("clear-canvas");

const drawingWorkspace =
  document.getElementById(
    "drawing-workspace"
  );

const focusMessage =
  document.getElementById(
    "focus-message"
  );

let isDrawing = false;


/* =========================================================
   10. CANVAS HELPERS
========================================================= */

function clearCanvas() {
  if (!canvas || !ctx) return;

  ctx.save();

  ctx.fillStyle = "#ffffff";

  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  ctx.restore();
}


function getCanvasPosition(event) {
  const rect =
    canvas.getBoundingClientRect();

  const scaleX =
    canvas.width / rect.width;

  const scaleY =
    canvas.height / rect.height;

  return {
    x:
      (event.clientX - rect.left) *
      scaleX,

    y:
      (event.clientY - rect.top) *
      scaleY,
  };
}


function startDrawing(event) {
  if (!ctx) return;

  isDrawing = true;

  const position =
    getCanvasPosition(event);

  ctx.beginPath();

  ctx.moveTo(
    position.x,
    position.y
  );

  canvas.setPointerCapture?.(
    event.pointerId
  );
}


function draw(event) {
  if (!isDrawing || !ctx) return;

  const position =
    getCanvasPosition(event);

  ctx.lineWidth =
    Number(brushSize.value) || 5;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle =
    colorPicker.value;

  ctx.lineTo(
    position.x,
    position.y
  );

  ctx.stroke();

  ctx.beginPath();

  ctx.moveTo(
    position.x,
    position.y
  );
}


function stopDrawing(event) {
  if (!isDrawing) return;

  isDrawing = false;

  ctx?.beginPath();

  canvas.releasePointerCapture?.(
    event.pointerId
  );
}


/* =========================================================
   11. CANVAS EVENTS
========================================================= */

if (canvas) {
  canvas.addEventListener(
    "pointerdown",
    startDrawing
  );

  canvas.addEventListener(
    "pointermove",
    draw
  );

  canvas.addEventListener(
    "pointerup",
    stopDrawing
  );

  canvas.addEventListener(
    "pointercancel",
    stopDrawing
  );

  canvas.addEventListener(
    "pointerleave",
    stopDrawing
  );
}

clearBtn?.addEventListener(
  "click",
  clearCanvas
);


/* =========================================================
   12. LONG BREAK WORKSPACE
========================================================= */

function toggleDoodlePad() {
  if (
    state.sessionType === "Long Break"
  ) {
    focusMessage?.classList.add(
      "hidden"
    );

    drawingWorkspace?.classList.remove(
      "hidden"
    );
  } else {
    focusMessage?.classList.remove(
      "hidden"
    );

    drawingWorkspace?.classList.add(
      "hidden"
    );
  }
}


/* =========================================================
   13. INITIALIZATION
========================================================= */

clearCanvas();

toggleDoodlePad();

updateDisplay();