// 設定：社員は1人（三島理絵）
const EMPLOYEES = [{ id: "e1", name: "三島理絵" }];
const STORAGE_KEY = "timecardRecords";
let currentEditId = null;

document.addEventListener("DOMContentLoaded", () => {
  initSelectors();
  initEvents();
  startClock();
  renderRecords();
  renderSummary();
});

// --- ストレージ ---
function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (e) {
    console.error(e);
    return [];
  }
}

function saveRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

// --- 初期化 ---
function initSelectors() {
  const empSelect = document.getElementById("employeeSelect");
  const filterEmployee = document.getElementById("filterEmployee");
  const opt = new Option(EMPLOYEES[0].name, EMPLOYEES[0].id);
  empSelect.appendChild(opt.cloneNode(true));
  filterEmployee.appendChild(new Option("全員", "all"));
  filterEmployee.appendChild(opt.cloneNode(true));
  filterEmployee.value = "all";

  const today = new Date();
  setSafeValue("dateInput", today.toISOString().slice(0, 10));
  setSafeValue("startInput", "09:00");
  setSafeValue("endInput", "18:00");
  setSafeValue("breakInput", "1.0");
  setSafeValue("overtimeInput", "00:00");
  setSafeValue("monthInput", today.toISOString().slice(0, 7));
}

function initEvents() {
  document.getElementById("saveBtn").addEventListener("click", handleSave);
  document.getElementById("resetBtn").addEventListener("click", () => resetForm(true));
  document.getElementById("monthInput").addEventListener("change", () => {
    renderRecords();
    renderSummary();
  });
  document.getElementById("filterEmployee").addEventListener("change", () => {
    renderRecords();
    renderSummary();
  });
  document.getElementById("csvBtn").addEventListener("click", exportToCSV);
  document.getElementById("printBtn").addEventListener("click", () => window.print());
}

function startClock() {
  const el = document.getElementById("clock");
  const tick = () => (el.textContent = new Date().toLocaleTimeString("ja-JP", { hour12: false }));
  tick();
  setInterval(tick, 1000);
}

// --- 入力系 ---
function handleSave() {
  const employeeId = document.getElementById("employeeSelect").value;
  const employee = EMPLOYEES.find(e => e.id === employeeId);
  const date = document.getElementById("dateInput").value;
  const start = document.getElementById("startInput").value;
  const end = document.getElementById("endInput").value;
  const breakHours = parseFloat(document.getElementById("breakInput").value) || 0;
  const overtimeMinutes = parseHmToMinutes(document.getElementById("overtimeInput").value);

  if (!employee) return showMessage("社員を選択してください。", true);
  if (!date) return showMessage("日付を入力してください。", true);
  if (!start || !end) return showMessage("出勤と退勤の時刻を入力してください。", true);

  const monthInput = document.getElementById("monthInput");
  const recordMonth = date.slice(0, 7);
  if (recordMonth) monthInput.value = recordMonth;

  const records = loadRecords();

  if (currentEditId) {
    const rec = records.find(r => r.id === currentEditId);
    if (rec) {
      rec.employeeId = employee.id;
      rec.employeeName = employee.name;
      rec.date = date;
      rec.start = start;
      rec.end = end;
      rec.breakMinutes = hoursToMinutes(breakHours);
      rec.overtimeMinutes = overtimeMinutes;
    }
    showMessage("レコードを更新しました。");
  } else {
    records.push({
      id: generateId(),
      employeeId: employee.id,
      employeeName: employee.name,
      date,
      start,
      end,
      breakMinutes: hoursToMinutes(breakHours),
      overtimeMinutes
    });
    showMessage("レコードを追加しました。");
  }

  saveRecords(records);
  resetForm(false);
  renderRecords();
  renderSummary();
}

function resetForm(clearMessage) {
  currentEditId = null;
  document.getElementById("saveBtn").textContent = "保存する";
  setSafeValue("startInput", "09:00");
  setSafeValue("endInput", "18:00");
  setSafeValue("breakInput", "1.0");
  setSafeValue("overtimeInput", "00:00");
  if (clearMessage) showMessage("");
}

function loadIntoForm(record) {
  document.getElementById("employeeSelect").value = record.employeeId;
  document.getElementById("dateInput").value = record.date;
  document.getElementById("startInput").value = record.start;
  document.getElementById("endInput").value = record.end;
  document.getElementById("breakInput").value = (record.breakMinutes || 0) / 60;
  document.getElementById("overtimeInput").value = minutesToHm(record.overtimeMinutes || 0);
  currentEditId = record.id;
  document.getElementById("saveBtn").textContent = "更新する";
  showMessage("編集モードです。");
}

function deleteRecord(id) {
  const records = loadRecords().filter(r => r.id !== id);
  saveRecords(records);
  resetForm(true);
  renderRecords();
  renderSummary();
  showMessage("削除しました。");
}

function showMessage(text, isError) {
  const el = document.getElementById("message");
  el.textContent = text;
  el.style.color = isError ? "#dc2626" : "#059669";
}

// --- 表示 ---
function renderRecords() {
  const tbody = document.querySelector("#recordsTable tbody");
  tbody.innerHTML = "";
  const records = getRecordsByMonth(document.getElementById("monthInput").value, document.getElementById("filterEmployee").value);

  records.forEach(rec => {
    const workMin = calcWorkMinutes(rec.start, rec.end, rec.breakMinutes);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${rec.date}</td>
      <td>${rec.employeeName}</td>
      <td>${rec.start}</td>
      <td>${rec.end}</td>
      <td>${formatMinutes(rec.breakMinutes)}</td>
      <td>${formatMinutes(rec.overtimeMinutes)}</td>
      <td>${workMin >= 0 ? formatMinutes(workMin) : "-"}</td>
      <td class="actions-cell">
        <button class="mini" data-action="edit" data-id="${rec.id}" type="button">編集</button>
        <button class="mini ghost" data-action="delete" data-id="${rec.id}" type="button">削除</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("button").forEach(btn => {
    const id = btn.dataset.id;
    if (btn.dataset.action === "edit") {
      btn.addEventListener("click", () => {
        const record = records.find(r => r.id === id);
        if (record) loadIntoForm(record);
      });
    } else {
      btn.addEventListener("click", () => {
        const ok = confirm("このレコードを削除しますか？");
        if (ok) deleteRecord(id);
      });
    }
  });
}

function renderSummary() {
  const filterEmpSelect = document.getElementById("filterEmployee");
  const selectedEmpText = filterEmpSelect.options[filterEmpSelect.selectedIndex]?.text || "";
  const filterValue = filterEmpSelect.value;
  const titleEl = document.getElementById("summaryTitle");
  const displayName = filterValue === "all" && EMPLOYEES.length === 1
    ? EMPLOYEES[0].name
    : selectedEmpText;
  titleEl.textContent = displayName ? `${displayName} さんの月次集計` : "月次集計";

  const tbody = document.querySelector("#summaryTable tbody");
  tbody.innerHTML = "";
  const summary = getMonthlySummary(document.getElementById("monthInput").value, document.getElementById("filterEmployee").value);

  summary.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.date}</td>
      <td>${row.start}</td>
      <td>${row.end}</td>
      <td>${formatMinutes(row.breakMinutes)}</td>
      <td>${row.workMinutes >= 0 ? formatMinutes(row.workMinutes) : "-"}</td>
      <td>${formatMinutes(row.overtimeMinutes)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// --- データ処理 ---
function getRecordsByMonth(monthValue, employeeId) {
  if (!monthValue) return [];
  const parts = monthValue.split("-");
  if (parts.length < 2) return [];
  const year = Number(parts[0]);
  const month = Number(parts[1]);

  return loadRecords()
    .filter(rec => {
      const d = new Date(rec.date);
      const matchMonth = d.getFullYear() === year && d.getMonth() + 1 === month;
      const matchEmp = employeeId === "all" || rec.employeeId === employeeId;
      return matchMonth && matchEmp;
    })
    .sort((a, b) => (a.date === b.date ? a.start.localeCompare(b.start) : a.date.localeCompare(b.date)));
}

function getMonthlySummary(monthValue, employeeId) {
  return getRecordsByMonth(monthValue, employeeId).map(rec => ({
    date: rec.date,
    employeeName: rec.employeeName,
    start: rec.start,
    end: rec.end,
    breakMinutes: rec.breakMinutes || 0,
    overtimeMinutes: rec.overtimeMinutes || 0,
    workMinutes: calcWorkMinutes(rec.start, rec.end, rec.breakMinutes)
  }));
}

function calcWorkMinutes(start, end, breakMinutes) {
  if (!start || !end) return -1;
  const diff = parseTimeToMinutes(end) - parseTimeToMinutes(start) - (breakMinutes || 0);
  return diff < 0 ? -1 : diff;
}

// --- CSV ---
function exportToCSV() {
  const month = document.getElementById("monthInput").value;
  const employeeId = document.getElementById("filterEmployee").value;
  const summary = getMonthlySummary(month, employeeId);
  if (!summary.length) return;

  const header = ["日付", "社員名", "出勤", "退勤", "休憩", "実働", "残業"];
  const rows = summary.map(r => [
    r.date,
    r.employeeName,
    r.start,
    r.end,
    formatMinutes(r.breakMinutes),
    r.workMinutes >= 0 ? formatMinutes(r.workMinutes) : "",
    formatMinutes(r.overtimeMinutes)
  ]);
  const csv = "\uFEFF" + [header, ...rows].map(r => r.map(s => `"${(s || "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `timecard_${month}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// --- ユーティリティ ---
function parseTimeToMinutes(hm) {
  const [h, m] = (hm || "00:00").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function hoursToMinutes(hours) {
  return Math.max(0, Math.round((hours || 0) * 60));
}

function formatMinutes(min) {
  const safe = Math.max(0, Math.round(min || 0));
  const h = String(Math.floor(safe / 60)).padStart(2, "0");
  const m = String(safe % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function generateId() {
  return `r_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function parseHmToMinutes(hm) {
  const [h, m] = (hm || "00:00").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToHm(min) {
  const h = String(Math.floor((min || 0) / 60)).padStart(2, "0");
  const m = String((min || 0) % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function setSafeValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}
