const STORAGE_KEY = "cyber-cow-worker-state";
const RELEASE_INIT_KEY = "cyber-cow-release-initialized-v1";
const WORK_DAYS_PER_MONTH = 21.75;
const DRAG_HOLD_MS = 120;
const DRAG_MOVE_THRESHOLD = 1;
const PRIVATE_SALARY_INPUTS = ["monthlySalary", "overtimeRate", "performancePay", "bonusPay"];

const elements = {
  durationText: document.querySelector("#durationText"),
  earningsText: document.querySelector("#earningsText"),
  clockInBtn: document.querySelector("#clockInBtn"),
  fishLockBtn: document.querySelector("#fishLockBtn"),
  clockOutBtn: document.querySelector("#clockOutBtn"),
  settingsBtn: document.querySelector("#settingsBtn"),
  closeAppBtn: document.querySelector("#closeAppBtn"),
  exitDialog: document.querySelector("#exitDialog"),
  cancelExitBtn: document.querySelector("#cancelExitBtn"),
  quitAndClearBtn: document.querySelector("#quitAndClearBtn"),
  hideBackgroundBtn: document.querySelector("#hideBackgroundBtn"),
  settingsPanel: document.querySelector("#settingsPanel"),
  settingsHomeView: document.querySelector("#settingsHomeView"),
  salarySettingsView: document.querySelector("#salarySettingsView"),
  salarySettingsBtn: document.querySelector("#salarySettingsBtn"),
  resetTodayBtn: document.querySelector("#resetTodayBtn"),
  backSettingsBtn: document.querySelector("#backSettingsBtn"),
  closeSettingsBtn: document.querySelector("#closeSettingsBtn"),
  closeSalarySettingsBtn: document.querySelector("#closeSalarySettingsBtn"),
  workStartTime: document.querySelector("#workStartTime"),
  workEndTime: document.querySelector("#workEndTime"),
  monthlySalary: document.querySelector("#monthlySalary"),
  overtimeRate: document.querySelector("#overtimeRate"),
  performancePay: document.querySelector("#performancePay"),
  bonusPay: document.querySelector("#bonusPay"),
  hourlyRateText: document.querySelector("#hourlyRateText"),
  overtimeRateText: document.querySelector("#overtimeRateText"),
  salarySummaryText: document.querySelector("#salarySummaryText"),
  privacyMode: document.querySelector("#privacyMode"),
};

const todayKey = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

initializeReleaseStorage();

let state = loadState();
let dragHoldTimer = null;
let dragStartPoint = null;
let isDragReady = false;
let isDraggingWindow = false;
let dragFrame = null;

window.setInterval(render, 1000);

elements.clockInBtn.addEventListener("click", () => {
  ensureToday();
  if (state.activeStartedAt) return;

  state.activeStartedAt = Date.now();
  saveState();
  render();
});

elements.clockOutBtn.addEventListener("click", () => {
  ensureToday();
  if (!state.activeStartedAt) return;

  stopActiveWork();
  saveState();
  render();
});

elements.fishLockBtn.addEventListener("click", enterLockMode);

elements.settingsBtn.addEventListener("click", () => {
  syncSettingsFields();
  showSettingsView("home");
  elements.settingsPanel.classList.add("open");
  elements.settingsPanel.setAttribute("aria-hidden", "false");
});

elements.closeAppBtn.addEventListener("click", () => {
  showExitDialog();
});

elements.cancelExitBtn.addEventListener("click", closeExitDialog);
elements.quitAndClearBtn.addEventListener("click", quitAndClearApp);
elements.hideBackgroundBtn.addEventListener("click", hideToBackground);

elements.exitDialog.addEventListener("click", (event) => {
  if (event.target === elements.exitDialog) {
    closeExitDialog();
  }
});

elements.salarySettingsBtn.addEventListener("click", () => {
  syncSettingsFields();
  showSettingsView("salary");
});
elements.resetTodayBtn.addEventListener("click", resetTodayData);

elements.backSettingsBtn.addEventListener("click", () => {
  showSettingsView("home");
});
elements.closeSettingsBtn.addEventListener("click", closeSettings);
elements.closeSalarySettingsBtn.addEventListener("click", closeSettings);

elements.settingsPanel.addEventListener("click", (event) => {
  if (event.target === elements.settingsPanel) {
    closeSettings();
  }
});

elements.privacyMode.addEventListener("change", () => {
  state.privacyMode = elements.privacyMode.checked;
  saveState();
  render();
});

window.addEventListener("mousedown", (event) => {
  if (event.button !== 0 || isDragBlocked(event.target)) return;

  dragStartPoint = getScreenPoint(event);
  isDragReady = false;
  isDraggingWindow = false;
  dragHoldTimer = window.setTimeout(() => {
    isDragReady = true;
    isDraggingWindow = true;
    document.body.classList.add("window-dragging");
    window.cyberCow?.beginWindowDrag?.();
  }, DRAG_HOLD_MS);
});

window.addEventListener("mousemove", (event) => {
  if (!dragStartPoint || !isDragReady) return;

  const point = getScreenPoint(event);
  const deltaX = point.x - dragStartPoint.x;
  const deltaY = point.y - dragStartPoint.y;
  const movedEnough = Math.hypot(deltaX, deltaY) >= DRAG_MOVE_THRESHOLD;

  if (isDraggingWindow && movedEnough) {
    scheduleWindowDragMove();
  }
});

window.addEventListener("mouseup", stopWindowDrag);
window.addEventListener("mouseleave", stopWindowDrag);
window.addEventListener("blur", stopWindowDrag);

[
  elements.workStartTime,
  elements.workEndTime,
  elements.monthlySalary,
  elements.overtimeRate,
  elements.performancePay,
  elements.bonusPay,
].forEach((input) => {
  input.addEventListener("input", () => {
    state.salary.workStart = normalizeTime(elements.workStartTime.value, "08:00");
    state.salary.workEnd = normalizeTime(elements.workEndTime.value, "17:30");
    state.salary.monthly = normalizeMoney(elements.monthlySalary.value);
    state.salary.overtimeRate = normalizeMoney(elements.overtimeRate.value);
    state.salary.performance = normalizeMoney(elements.performancePay.value);
    state.salary.bonus = normalizeMoney(elements.bonusPay.value);
    saveState();
    render();
  });
});

window.addEventListener("beforeunload", saveState);

syncSettingsFields();
render();

function loadState() {
  const fallback = {
    date: todayKey(),
    workedMs: 0,
    activeStartedAt: null,
    salary: {
      workStart: "08:00",
      workEnd: "17:30",
      monthly: 8000,
      overtimeRate: 50,
      performance: 0,
      bonus: 0,
    },
    privacyMode: false,
  };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return normalizeState({ ...fallback, ...saved });
  } catch {
    return fallback;
  }
}

function initializeReleaseStorage() {
  if (localStorage.getItem(RELEASE_INIT_KEY) === "1") return;

  localStorage.removeItem(STORAGE_KEY);
  localStorage.setItem(RELEASE_INIT_KEY, "1");
}

function normalizeState(nextState) {
  const salary = normalizeSalary(nextState);
  const baseState = {
    date: todayKey(),
    workedMs: 0,
    activeStartedAt: null,
    salary,
    privacyMode: Boolean(nextState.privacyMode),
  };

  if (nextState.date !== todayKey()) {
    return baseState;
  }

  return {
    ...baseState,
    date: nextState.date,
    workedMs: Number(nextState.workedMs) || 0,
    activeStartedAt: nextState.activeStartedAt ? Number(nextState.activeStartedAt) : null,
  };
}

function normalizeSalary(nextState) {
  const salary = nextState.salary || {};
  const oldHourlyRate = normalizeMoney(nextState.hourlyRate);
  const oldMonthlyFromHourly = oldHourlyRate * getMonthlyStandardHours("08:00", "17:30");

  return {
    workStart: normalizeTime(salary.workStart, "08:00"),
    workEnd: normalizeTime(salary.workEnd, "17:30"),
    monthly: normalizeMoney(salary.monthly || oldMonthlyFromHourly || 8000),
    overtimeRate: normalizeMoney(salary.overtimeRate ?? salary.overtime ?? 50),
    performance: normalizeMoney(salary.performance),
    bonus: normalizeMoney(salary.bonus),
  };
}

function ensureToday() {
  state = normalizeState(state);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function stopActiveWork() {
  if (!state.activeStartedAt) return;

  state.workedMs += Date.now() - state.activeStartedAt;
  state.activeStartedAt = null;
}

function enterLockMode() {
  ensureToday();
  stopActiveWork();
  closeSettings();
  saveState();
  render();
  window.cyberCow?.lockSystem?.();
}

function showExitDialog() {
  closeSettings();
  elements.exitDialog.classList.add("open");
  elements.exitDialog.setAttribute("aria-hidden", "false");
}

function closeExitDialog() {
  elements.exitDialog.classList.remove("open");
  elements.exitDialog.setAttribute("aria-hidden", "true");
}

function quitAndClearApp() {
  saveState();
  window.cyberCow?.quitAndClearApp?.();
}

function hideToBackground() {
  closeExitDialog();
  saveState();
  window.cyberCow?.hideToBackground?.();
}

function resetTodayData() {
  state.workedMs = 0;
  state.activeStartedAt = null;
  state.date = todayKey();
  saveState();
  render();
}

function closeSettings() {
  elements.settingsPanel.classList.remove("open");
  elements.settingsPanel.setAttribute("aria-hidden", "true");
}

function showSettingsView(view) {
  const isSalaryView = view === "salary";
  elements.settingsHomeView.classList.toggle("active", !isSalaryView);
  elements.salarySettingsView.classList.toggle("active", isSalaryView);
}

function getWorkedMs() {
  ensureToday();
  const activeMs = state.activeStartedAt ? Date.now() - state.activeStartedAt : 0;
  return state.workedMs + activeMs;
}

function getDailyStandardMs() {
  return Math.max(1, getTimeRangeMinutes(state.salary.workStart, state.salary.workEnd)) * 60000;
}

function getMonthlyStandardHours(startTime, endTime) {
  return (Math.max(1, getTimeRangeMinutes(startTime, endTime)) / 60) * WORK_DAYS_PER_MONTH;
}

function getHourlyRate() {
  const totalMonthlyIncome = state.salary.monthly + state.salary.performance + state.salary.bonus;
  return totalMonthlyIncome / getMonthlyStandardHours(state.salary.workStart, state.salary.workEnd);
}

function getTodayEarnings(workedMs) {
  const regularMs = Math.min(workedMs, getDailyStandardMs());
  const overtimeMs = Math.max(0, workedMs - getDailyStandardMs());
  const regularIncome = (regularMs / 3600000) * getHourlyRate();
  const overtimeIncome = (overtimeMs / 3600000) * state.salary.overtimeRate;
  return regularIncome + overtimeIncome;
}

function render() {
  const workedMs = getWorkedMs();
  const isWorking = Boolean(state.activeStartedAt);
  const hourlyRate = getHourlyRate();
  const earnings = getTodayEarnings(workedMs);

  elements.durationText.textContent = formatDuration(workedMs);
  elements.earningsText.textContent = state.privacyMode ? "****" : formatMoney(earnings);
  elements.clockInBtn.disabled = isWorking;
  elements.clockOutBtn.disabled = !isWorking;
  applySalaryInputPrivacy();
  elements.hourlyRateText.textContent = `${formatMoney(hourlyRate)}/小时`;
  elements.overtimeRateText.textContent = state.privacyMode ? "****" : `${formatMoney(state.salary.overtimeRate)}/小时`;
  elements.salarySummaryText.textContent = state.privacyMode
    ? `${state.salary.workStart}-${state.salary.workEnd} · ****`
    : `${state.salary.workStart}-${state.salary.workEnd} · ${formatMoney(hourlyRate)}/小时`;
  elements.privacyMode.checked = state.privacyMode;
}

function applySalaryInputPrivacy() {
  PRIVATE_SALARY_INPUTS.forEach((key) => {
    const input = elements[key];
    input.type = state.privacyMode ? "text" : "number";
    input.readOnly = state.privacyMode;
    input.value = state.privacyMode ? "******" : state.salary[getSalaryFieldName(key)];
  });
}

function syncSettingsFields() {
  elements.workStartTime.value = state.salary.workStart;
  elements.workEndTime.value = state.salary.workEnd;
  elements.monthlySalary.value = state.salary.monthly;
  elements.overtimeRate.value = state.salary.overtimeRate;
  elements.performancePay.value = state.salary.performance;
  elements.bonusPay.value = state.salary.bonus;
  applySalaryInputPrivacy();
}

function getSalaryFieldName(inputKey) {
  const fields = {
    monthlySalary: "monthly",
    overtimeRate: "overtimeRate",
    performancePay: "performance",
    bonusPay: "bonus",
  };
  return fields[inputKey];
}

function getTimeRangeMinutes(startTime, endTime) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return end > start ? end - start : end + 1440 - start;
}

function timeToMinutes(time) {
  const [hour, minute] = normalizeTime(time, "00:00").split(":").map(Number);
  return hour * 60 + minute;
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function formatMoney(value) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(value);
}

function normalizeMoney(value) {
  const money = Number(value);
  return Number.isFinite(money) && money >= 0 ? money : 0;
}

function normalizeTime(value, fallback) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback;
}

function getScreenPoint(event) {
  return {
    x: event.screenX,
    y: event.screenY,
  };
}

function isDragBlocked(target) {
  return Boolean(
    target.closest(
      "button, input, label, .actions, .switch, .exit-dialog",
    ),
  );
}

function stopWindowDrag() {
  window.clearTimeout(dragHoldTimer);
  window.cancelAnimationFrame(dragFrame);
  dragHoldTimer = null;
  dragFrame = null;
  dragStartPoint = null;
  isDragReady = false;

  if (!isDraggingWindow) return;

  isDraggingWindow = false;
  document.body.classList.remove("window-dragging");
  window.cyberCow?.stopWindowDrag?.();
}

function scheduleWindowDragMove() {
  if (dragFrame) return;

  dragFrame = window.requestAnimationFrame(() => {
    dragFrame = null;
    window.cyberCow?.moveWindowDrag?.();
  });
}
