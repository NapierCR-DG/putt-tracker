/* ===== Putt Tracker — App ===== */

/* ----- Routing ----- */

let currentSession = null; // active session state

function navigate(hash) {
  window.location.hash = hash;
}

function route() {
  const hash = window.location.hash || "#/";
  const app = document.getElementById("app");

  if (hash === "#/") renderHome(app);
  else if (hash === "#/session/new") renderNewSession(app);
  else if (hash === "#/session/active") renderActiveSession(app);
  else if (hash === "#/session/summary") renderSessionSummary(app);
  else if (hash === "#/history") renderHistory(app);
  else if (hash.startsWith("#/history/")) {
    const id = hash.replace("#/history/", "");
    renderSessionDetail(app, id);
  }
  else renderHome(app);
}

window.addEventListener("hashchange", route);

/* ----- Helpers ----- */

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function formatTime(iso) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function percentColor(pct) {
  if (pct >= 70) return "green";
  if (pct >= 40) return "orange";
  return "red";
}

/* ===== Pages ===== */

/* ----- Home ----- */
function renderHome(app) {
  const today = getTodayStats();
  const allSessions = getSessions();
  const recent = allSessions.slice(-5).reverse();

  app.innerHTML = `
    <div class="app-header">
      <span class="logo-icon">🥏</span>
      <h1>Putt Tracker</h1>
    </div>
    <div class="fade-in">
      ${allSessions.length > 0 ? `
        <div class="stat-grid stat-grid-3" style="margin-bottom:20px">
          <div class="stat-card">
            <div class="stat-val">${today.sessions}</div>
            <div class="stat-label">Today</div>
          </div>
          <div class="stat-card">
            <div class="stat-val ${today.putts > 0 ? percentColor(today.percent) : ""}">${today.putts > 0 ? today.percent + "%" : "—"}</div>
            <div class="stat-label">Today's %</div>
          </div>
          <div class="stat-card">
            <div class="stat-val">${today.putts}</div>
            <div class="stat-label">Putts</div>
          </div>
        </div>
      ` : `
        <div class="empty-state" style="padding:30px 20px">
          <div class="empty-state-icon">🥏</div>
          <h3>Ready to practice?</h3>
          <p>Start your first putting session to begin tracking your progress.</p>
        </div>
      `}

      <button class="btn-primary" onclick="navigate('#/session/new')" style="margin-bottom:12px">
        Start Session
      </button>
      <button class="btn-secondary" onclick="navigate('#/history')">
        View History
      </button>

      ${recent.length > 0 ? `
        <div style="margin-top:24px">
          <div class="section-title">Recent Sessions</div>
          <div class="card" style="padding:4px 14px">
            ${recent.map(s => {
              const st = computeSessionStats(s);
              return `<div class="session-item" onclick="navigate('#/history/${s.id}')">
                <div class="session-percent ${percentColor(st.makePercent)}">${st.makePercent}%</div>
                <div class="session-info">
                  <div class="session-date">${formatDate(s.date)}</div>
                  <div class="session-meta">${st.total} putts · ${st.makes} makes</div>
                </div>
                <span class="session-mode ${s.mode}">${s.mode}</span>
              </div>`;
            }).join("")}
          </div>
        </div>
      ` : ""}
    </div>
  `;
}

/* ----- New Session ----- */
function renderNewSession(app) {
  const selectedMode = currentSession?.mode || "";

  app.innerHTML = `
    <div class="app-header">
      <span class="logo-icon">🥏</span>
      <h1>Putt Tracker</h1>
    </div>
    <div class="fade-in">
      <button class="back-link" onclick="navigate('#/')">← Back</button>
      <h2 style="font-size:20px;font-weight:700;margin-bottom:4px">New Session</h2>
      <p style="font-size:13px;color:var(--text2);margin-bottom:16px">Choose your session type</p>

      <div class="mode-cards">
        <div class="mode-card ${selectedMode === 'target' ? 'selected' : ''}" id="modeTarget">
          <h3>🎯 Target Mode</h3>
          <p>60 putts — 10 from each distance (10ft, 15ft, 20ft, 25ft, 30ft, 33ft). Auto-advances through distances.</p>
        </div>
        <div class="mode-card ${selectedMode === 'free' ? 'selected' : ''}" id="modeFree">
          <h3>🏌️ Free Mode</h3>
          <p>Putt freely at any distance. End the session whenever you're done.</p>
        </div>
      </div>

      <button class="btn-primary" id="startBtn" ${!selectedMode ? 'disabled' : ''}>Start Putting</button>
    </div>
  `;

  document.getElementById("modeTarget").addEventListener("click", () => {
    currentSession = { mode: "target" };
    renderNewSession(app);
  });
  document.getElementById("modeFree").addEventListener("click", () => {
    currentSession = { mode: "free" };
    renderNewSession(app);
  });
  document.getElementById("startBtn").addEventListener("click", () => {
    if (!currentSession?.mode) return;
    currentSession = {
      id: createSessionId(),
      date: new Date().toISOString(),
      mode: currentSession.mode,
      targetCount: currentSession.mode === "target" ? TARGET_TOTAL : null,
      putts: [],
      notes: "",
    };
    navigate("#/session/active");
  });
}

/* ----- Active Session ----- */
function renderActiveSession(app) {
  if (!currentSession) { navigate("#/"); return; }

  const isTarget = currentSession.mode === "target";
  const putts = currentSession.putts;
  const total = putts.length;
  const makes = putts.filter(p => p.made).length;
  const misses = total - makes;
  const pct = total > 0 ? Math.round((makes / total) * 100) : 0;

  // Target mode state
  let currentDistIndex = 0;
  let currentDistPutts = [];
  if (isTarget) {
    currentDistIndex = Math.min(Math.floor(total / TARGET_PER_DISTANCE), DISTANCES.length - 1);
    const startIdx = currentDistIndex * TARGET_PER_DISTANCE;
    currentDistPutts = putts.slice(startIdx, startIdx + TARGET_PER_DISTANCE);
  }

  // Free mode — track selected distance
  if (!isTarget && !currentSession._selectedDist) {
    currentSession._selectedDist = DISTANCES[0];
  }

  const currentDist = isTarget ? DISTANCES[currentDistIndex] : currentSession._selectedDist;
  const puttNumAtDist = isTarget ? (total % TARGET_PER_DISTANCE) + 1 : null;
  const isComplete = isTarget && total >= TARGET_TOTAL;

  if (isComplete) {
    navigate("#/session/summary");
    return;
  }

  app.innerHTML = `
    <div class="app-header">
      <span class="logo-icon">🥏</span>
      <h1>Putt Tracker</h1>
    </div>
    <div class="fade-in" id="sessionView">
      ${isTarget ? `
        <div class="distance-progress">
          <div class="current-dist">${currentDist}ft</div>
          <div class="dist-count">Putt ${puttNumAtDist > TARGET_PER_DISTANCE ? TARGET_PER_DISTANCE : puttNumAtDist} of ${TARGET_PER_DISTANCE}</div>
          <div class="distance-dots">
            ${DISTANCES.map((d, i) => {
              let cls = "distance-dot";
              if (i < currentDistIndex) cls += " done";
              else if (i === currentDistIndex) cls += " active";
              return `<div class="${cls}" title="${d}ft"></div>`;
            }).join("")}
          </div>
          <div class="putt-dots" style="margin-top:8px">
            ${Array.from({length: TARGET_PER_DISTANCE}, (_, i) => {
              const putt = currentDistPutts[i];
              let cls = "putt-dot";
              if (putt) cls += putt.made ? " made" : " missed";
              return `<div class="${cls}"></div>`;
            }).join("")}
          </div>
        </div>
      ` : `
        <div class="distance-bar">
          ${DISTANCES.map(d =>
            `<button class="dist-btn ${d === currentDist ? 'active' : ''}" data-dist="${d}">${d}ft</button>`
          ).join("")}
        </div>
      `}

      <div class="putt-buttons">
        <button class="putt-btn putt-btn-make" id="makeBtn">
          ✓
          <span>Make</span>
        </button>
        <button class="putt-btn putt-btn-miss" id="missBtn">
          ✕
          <span>Miss</span>
        </button>
      </div>

      <div class="live-stats">
        <div class="live-stat">
          <div class="live-stat-val">${total}${isTarget ? '/' + TARGET_TOTAL : ''}</div>
          <div class="live-stat-label">Putts</div>
        </div>
        <div class="live-stat">
          <div class="live-stat-val" style="color:var(--green)">${makes}</div>
          <div class="live-stat-label">Makes</div>
        </div>
        <div class="live-stat">
          <div class="live-stat-val" style="color:var(--red)">${misses}</div>
          <div class="live-stat-label">Misses</div>
        </div>
        <div class="live-stat">
          <div class="live-stat-val" style="color:var(--orange)">${pct}%</div>
          <div class="live-stat-label">Make %</div>
        </div>
      </div>

      ${!isTarget ? `
        <button class="btn-secondary" id="endBtn" style="margin-top:12px" ${total === 0 ? 'disabled' : ''}>End Session</button>
      ` : ""}

      <button class="btn-ghost" id="discardBtn" style="margin-top:8px;width:100%;text-align:center;color:var(--text3)">Discard Session</button>
    </div>
  `;

  // Bind events
  function recordPutt(made) {
    currentSession.putts.push({ distance: currentDist, made });
    const view = document.getElementById("sessionView");
    if (view) {
      view.classList.remove("flash-make", "flash-miss");
      void view.offsetWidth; // force reflow
      view.classList.add(made ? "flash-make" : "flash-miss");
    }
    renderActiveSession(app);
  }

  document.getElementById("makeBtn").addEventListener("click", () => recordPutt(true));
  document.getElementById("missBtn").addEventListener("click", () => recordPutt(false));

  if (!isTarget) {
    document.querySelectorAll(".dist-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        currentSession._selectedDist = parseInt(btn.dataset.dist);
        renderActiveSession(app);
      });
    });
    document.getElementById("endBtn")?.addEventListener("click", () => {
      navigate("#/session/summary");
    });
  }

  document.getElementById("discardBtn").addEventListener("click", () => {
    if (total === 0 || confirm("Discard this session? Data will be lost.")) {
      currentSession = null;
      navigate("#/");
    }
  });
}

/* ----- Session Summary ----- */
function renderSessionSummary(app) {
  if (!currentSession) { navigate("#/"); return; }

  const stats = computeSessionStats(currentSession);

  app.innerHTML = `
    <div class="app-header">
      <span class="logo-icon">🥏</span>
      <h1>Putt Tracker</h1>
    </div>
    <div class="fade-in">
      <h2 style="font-size:20px;font-weight:700;margin-bottom:4px;text-align:center">Session Complete!</h2>
      <p style="font-size:13px;color:var(--text2);margin-bottom:20px;text-align:center">
        ${currentSession.mode === "target" ? "Target" : "Free"} session · ${formatDate(currentSession.date)}
      </p>

      <div class="stat-grid stat-grid-4">
        <div class="stat-card">
          <div class="stat-val">${stats.total}</div>
          <div class="stat-label">Total</div>
        </div>
        <div class="stat-card">
          <div class="stat-val green">${stats.makes}</div>
          <div class="stat-label">Makes</div>
        </div>
        <div class="stat-card">
          <div class="stat-val red">${stats.misses}</div>
          <div class="stat-label">Misses</div>
        </div>
        <div class="stat-card">
          <div class="stat-val ${percentColor(stats.makePercent)}">${stats.makePercent}%</div>
          <div class="stat-label">Make %</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">By Distance</div>
        <div class="dist-table">
          ${DISTANCES.map(d => {
            const ds = stats.byDistance[d];
            if (!ds) return "";
            const barColor = ds.percent >= 70 ? "var(--green)" : ds.percent >= 40 ? "var(--orange)" : "var(--red)";
            return `<div class="dist-row">
              <div class="dist-row-label">${d}ft</div>
              <div class="dist-bar-wrap">
                <div class="dist-bar" style="width:${ds.percent}%;background:${barColor}"></div>
              </div>
              <div class="dist-row-pct" style="color:${barColor}">${ds.percent}%</div>
            </div>`;
          }).join("")}
        </div>
      </div>

      <div class="card">
        <div class="card-title">Session Notes (optional)</div>
        <textarea class="notes-input" id="notesInput" placeholder="Windy day, worked on spin putts...">${currentSession.notes || ""}</textarea>
      </div>

      <button class="btn-primary" id="saveBtn" style="margin-bottom:10px">Save Session</button>
      <button class="btn-ghost" id="discardSummaryBtn" style="width:100%;text-align:center;color:var(--text3)">Discard</button>
    </div>
  `;

  document.getElementById("saveBtn").addEventListener("click", () => {
    currentSession.notes = document.getElementById("notesInput").value.trim();
    // Remove internal state before saving
    delete currentSession._selectedDist;
    saveSession(currentSession);
    currentSession = null;
    navigate("#/");
  });

  document.getElementById("discardSummaryBtn").addEventListener("click", () => {
    if (confirm("Discard this session? Data will be lost.")) {
      currentSession = null;
      navigate("#/");
    }
  });
}

/* ----- History ----- */
let historyFilter = null; // null = all time

function renderHistory(app) {
  const sessions = getFilteredSessions(historyFilter);
  const agg = computeAggregateStats(sessions);

  const filterLabel = historyFilter === 7 ? "7d" : historyFilter === 14 ? "14d" : historyFilter === 30 ? "30d" : "All";

  app.innerHTML = `
    <div class="app-header">
      <span class="logo-icon">🥏</span>
      <h1>Putt Tracker</h1>
    </div>
    <div class="fade-in">
      <button class="back-link" onclick="navigate('#/')">← Back</button>
      <h2 style="font-size:20px;font-weight:700;margin-bottom:16px">History & Stats</h2>

      <div class="tabs">
        <div class="tab ${historyFilter === 7 ? 'active' : ''}" data-filter="7">7d</div>
        <div class="tab ${historyFilter === 14 ? 'active' : ''}" data-filter="14">14d</div>
        <div class="tab ${historyFilter === 30 ? 'active' : ''}" data-filter="30">30d</div>
        <div class="tab ${historyFilter === null ? 'active' : ''}" data-filter="all">All</div>
      </div>

      ${sessions.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">📊</div>
          <h3>No sessions yet</h3>
          <p>Complete a putting session to see your stats here.</p>
        </div>
      ` : `
        <div class="stat-grid stat-grid-4">
          <div class="stat-card">
            <div class="stat-val">${agg.sessionCount}</div>
            <div class="stat-label">Sessions</div>
          </div>
          <div class="stat-card">
            <div class="stat-val">${agg.totalPutts}</div>
            <div class="stat-label">Putts</div>
          </div>
          <div class="stat-card">
            <div class="stat-val ${percentColor(agg.overallPercent)}">${agg.overallPercent}%</div>
            <div class="stat-label">Make %</div>
          </div>
          <div class="stat-card">
            <div class="stat-val ${percentColor(agg.bestPercent)}">${agg.bestPercent}%</div>
            <div class="stat-label">Best</div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Make % by Distance</div>
          <div class="dist-table">
            ${DISTANCES.map(d => {
              const ds = agg.distanceBreakdown[d];
              if (!ds || ds.total === 0) return "";
              const barColor = ds.percent >= 70 ? "var(--green)" : ds.percent >= 40 ? "var(--orange)" : "var(--red)";
              return `<div class="dist-row">
                <div class="dist-row-label">${d}ft</div>
                <div class="dist-bar-wrap">
                  <div class="dist-bar" style="width:${ds.percent}%;background:${barColor}"></div>
                </div>
                <div class="dist-row-pct" style="color:${barColor}">${ds.percent}%</div>
              </div>`;
            }).join("")}
          </div>
        </div>

        <div style="margin-top:8px">
          <div class="section-title">Sessions</div>
          <div class="card" style="padding:4px 14px">
            ${sessions.slice().reverse().map(s => {
              const st = computeSessionStats(s);
              return `<div class="session-item" onclick="navigate('#/history/${s.id}')">
                <div class="session-percent ${percentColor(st.makePercent)}">${st.makePercent}%</div>
                <div class="session-info">
                  <div class="session-date">${formatDate(s.date)} · ${formatTime(s.date)}</div>
                  <div class="session-meta">${st.total} putts · ${st.makes}/${st.total} makes</div>
                </div>
                <span class="session-mode ${s.mode}">${s.mode}</span>
              </div>`;
            }).join("")}
          </div>
        </div>
      `}
    </div>
  `;

  // Bind tab clicks
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const f = tab.dataset.filter;
      historyFilter = f === "all" ? null : parseInt(f);
      renderHistory(app);
    });
  });
}

/* ----- Session Detail ----- */
function renderSessionDetail(app, sessionId) {
  const sessions = getSessions();
  const session = sessions.find(s => s.id === sessionId);
  if (!session) { navigate("#/history"); return; }

  const stats = computeSessionStats(session);

  app.innerHTML = `
    <div class="app-header">
      <span class="logo-icon">🥏</span>
      <h1>Putt Tracker</h1>
    </div>
    <div class="fade-in">
      <button class="back-link" onclick="navigate('#/history')">← Back to History</button>
      <h2 style="font-size:20px;font-weight:700;margin-bottom:4px">${formatDate(session.date)}</h2>
      <p style="font-size:13px;color:var(--text2);margin-bottom:16px">
        ${formatTime(session.date)} · <span class="session-mode ${session.mode}" style="display:inline">${session.mode}</span> session
      </p>

      <div class="stat-grid stat-grid-4">
        <div class="stat-card">
          <div class="stat-val">${stats.total}</div>
          <div class="stat-label">Total</div>
        </div>
        <div class="stat-card">
          <div class="stat-val green">${stats.makes}</div>
          <div class="stat-label">Makes</div>
        </div>
        <div class="stat-card">
          <div class="stat-val red">${stats.misses}</div>
          <div class="stat-label">Misses</div>
        </div>
        <div class="stat-card">
          <div class="stat-val ${percentColor(stats.makePercent)}">${stats.makePercent}%</div>
          <div class="stat-label">Make %</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">By Distance</div>
        <div class="dist-table">
          ${DISTANCES.map(d => {
            const ds = stats.byDistance[d];
            if (!ds) return "";
            const barColor = ds.percent >= 70 ? "var(--green)" : ds.percent >= 40 ? "var(--orange)" : "var(--red)";
            return `<div class="dist-row">
              <div class="dist-row-label">${d}ft</div>
              <div class="dist-bar-wrap">
                <div class="dist-bar" style="width:${ds.percent}%;background:${barColor}"></div>
              </div>
              <div class="dist-row-pct" style="color:${barColor}">${ds.percent}%</div>
            </div>`;
          }).join("")}
        </div>
      </div>

      ${session.notes ? `
        <div class="card">
          <div class="card-title">Notes</div>
          <p style="font-size:13px;color:var(--text2);white-space:pre-wrap">${session.notes}</p>
        </div>
      ` : ""}

      <button class="btn-danger" id="deleteBtn" style="width:100%;margin-top:8px">Delete Session</button>
    </div>
  `;

  document.getElementById("deleteBtn").addEventListener("click", () => {
    if (confirm("Delete this session? This cannot be undone.")) {
      deleteSession(sessionId);
      navigate("#/history");
    }
  });
}

/* ----- Init ----- */
route();
