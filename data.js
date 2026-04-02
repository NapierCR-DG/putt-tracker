/* ===== Putt Tracker — Data Layer ===== */

const DISTANCES = [10, 15, 20, 25, 30, 33];
const TARGET_PER_DISTANCE = 10;
const TARGET_TOTAL = DISTANCES.length * TARGET_PER_DISTANCE; // 60
const STORAGE_KEY = "puttSessions";

/* ----- CRUD ----- */

function getSessions() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

function saveSession(session) {
  const sessions = getSessions();
  sessions.push(session);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function deleteSession(id) {
  const sessions = getSessions().filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function createSessionId() {
  return "session_" + Date.now();
}

/* ----- Stats Computation ----- */

function computeSessionStats(session) {
  const putts = session.putts || [];
  const total = putts.length;
  const makes = putts.filter(p => p.made).length;
  const misses = total - makes;
  const makePercent = total > 0 ? Math.round((makes / total) * 100) : 0;

  const byDistance = {};
  DISTANCES.forEach(d => {
    const atDist = putts.filter(p => p.distance === d);
    const distMakes = atDist.filter(p => p.made).length;
    if (atDist.length > 0) {
      byDistance[d] = {
        total: atDist.length,
        makes: distMakes,
        misses: atDist.length - distMakes,
        percent: Math.round((distMakes / atDist.length) * 100),
      };
    }
  });

  return { total, makes, misses, makePercent, byDistance };
}

function getFilteredSessions(days) {
  const sessions = getSessions();
  if (!days) return sessions; // "all time"
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return sessions.filter(s => new Date(s.date).getTime() > cutoff);
}

function computeAggregateStats(sessions) {
  let totalPutts = 0, totalMakes = 0;
  const byDistance = {};
  DISTANCES.forEach(d => { byDistance[d] = { total: 0, makes: 0 }; });

  let bestSession = null;
  let bestPercent = -1;

  sessions.forEach(s => {
    const stats = computeSessionStats(s);
    totalPutts += stats.total;
    totalMakes += stats.makes;

    if (stats.makePercent > bestPercent && stats.total > 0) {
      bestPercent = stats.makePercent;
      bestSession = s;
    }

    Object.entries(stats.byDistance).forEach(([d, ds]) => {
      byDistance[d].total += ds.total;
      byDistance[d].makes += ds.makes;
    });
  });

  const overallPercent = totalPutts > 0 ? Math.round((totalMakes / totalPutts) * 100) : 0;

  const distanceBreakdown = {};
  DISTANCES.forEach(d => {
    const dd = byDistance[d];
    distanceBreakdown[d] = {
      total: dd.total,
      makes: dd.makes,
      misses: dd.total - dd.makes,
      percent: dd.total > 0 ? Math.round((dd.makes / dd.total) * 100) : 0,
    };
  });

  return {
    sessionCount: sessions.length,
    totalPutts,
    totalMakes,
    totalMisses: totalPutts - totalMakes,
    overallPercent,
    bestSession,
    bestPercent: bestPercent >= 0 ? bestPercent : 0,
    distanceBreakdown,
  };
}

function getTodayStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sessions = getSessions().filter(s => new Date(s.date) >= today);
  let putts = 0, makes = 0;
  sessions.forEach(s => {
    const st = computeSessionStats(s);
    putts += st.total;
    makes += st.makes;
  });
  return { sessions: sessions.length, putts, makes, percent: putts > 0 ? Math.round((makes / putts) * 100) : 0 };
}
