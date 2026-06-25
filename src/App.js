import { useState, useEffect, useRef } from "react";
import "./App.css";


function buildRoundRobin(players, mode, minGames = 8) {
  const results = [];
  let matchId = Date.now();

  const gameCount = {};
  const partnerCount = {};  
  const opponentCount = {};  
  const lastMatchIndex = {}; 

  players.forEach(p => {
    gameCount[p] = 0;
    partnerCount[p] = {};
    opponentCount[p] = {};
    lastMatchIndex[p] = -99;
  });

  const getPartner = (a, b) => (partnerCount[a][b] || 0);
  const getOpponent = (a, b) => (opponentCount[a][b] || 0);
  const restRequired = 1;
  const hasRested = (p, currentIdx) => (currentIdx - lastMatchIndex[p]) > restRequired;

  const addMatch = (t1, t2) => {
    const idx = results.length;
    results.push({
      id: matchId++,
      type: mode,
      t1: [...t1],
      t2: [...t2],
      done: false,
      winner: null,
    });
    [...t1, ...t2].forEach(p => {
      gameCount[p]++;
      lastMatchIndex[p] = idx;
    });
    if (mode === "doubles") {
      [t1, t2].forEach(team => {
        if (team.length === 2) {
          partnerCount[team[0]][team[1]] = (partnerCount[team[0]][team[1]] || 0) + 1;
          partnerCount[team[1]][team[0]] = (partnerCount[team[1]][team[0]] || 0) + 1;
        }
      });
    }
    t1.forEach(a => t2.forEach(b => {
      opponentCount[a][b] = (opponentCount[a][b] || 0) + 1;
      opponentCount[b][a] = (opponentCount[b][a] || 0) + 1;
    }));
  };

  const MAX_ITER = 10000;
  let iter = 0;

  while (players.some(p => gameCount[p] < minGames) && iter < MAX_ITER) {
    iter++;
    const currentIdx = results.length;

    let pool = players.filter(p => hasRested(p, currentIdx));

    if (mode === "doubles") {
      if (pool.length < 4) {
        // Not enough rested — open up to all players, sorted by fewest games + longest rest
        pool = [...players].sort((a, b) => {
          const restDiff = (currentIdx - lastMatchIndex[b]) - (currentIdx - lastMatchIndex[a]);
          if (restDiff !== 0) return restDiff;
          return gameCount[a] - gameCount[b];
        });
      }

      let best = null;
      let bestScore = Infinity;

      const candidates = pool.slice(0, Math.min(pool.length, 12));

      for (let i = 0; i < candidates.length; i++) {
        for (let j = i + 1; j < candidates.length; j++) {
          for (let k = j + 1; k < candidates.length; k++) {
            for (let l = k + 1; l < candidates.length; l++) {
              const four = [candidates[i], candidates[j], candidates[k], candidates[l]];

              const splits = [
                [[four[0], four[1]], [four[2], four[3]]],
                [[four[0], four[2]], [four[1], four[3]]],
                [[four[0], four[3]], [four[1], four[2]]],
              ];

              for (const [t1, t2] of splits) {
                const partnerPenalty =
                  getPartner(t1[0], t1[1]) * 20 +
                  getPartner(t2[0], t2[1]) * 20;

                const opponentPenalty =
                  (getOpponent(t1[0], t2[0]) + getOpponent(t1[0], t2[1]) +
                   getOpponent(t1[1], t2[0]) + getOpponent(t1[1], t2[1])) * 8;

                const needBonus = four.reduce((s, p) => s + (minGames - gameCount[p]), 0) * 3;
                const restBonus = four.reduce((s, p) => s + (currentIdx - lastMatchIndex[p]), 0);

                const score = partnerPenalty + opponentPenalty - needBonus - restBonus;

                if (score < bestScore) {
                  bestScore = score;
                  best = { t1, t2 };
                }
              }
            }
          }
        }
      }

      if (best) {
        addMatch(best.t1, best.t2);
      } else {
        const sorted = [...players].sort((a, b) => gameCount[a] - gameCount[b]);
        addMatch([sorted[0], sorted[1]], [sorted[2], sorted[3]]);
      }

    } else {
      if (pool.length < 2) {
        pool = [...players].sort((a, b) => gameCount[a] - gameCount[b]);
      }

      let best = null;
      let bestScore = Infinity;

      for (let i = 0; i < pool.length; i++) {
        for (let j = i + 1; j < pool.length; j++) {
          const a = pool[i], b = pool[j];
          const opponentPenalty = getOpponent(a, b) * 10;
          const needBonus = ((minGames - gameCount[a]) + (minGames - gameCount[b])) * 3;
          const restBonus = (currentIdx - lastMatchIndex[a]) + (currentIdx - lastMatchIndex[b]);
          const score = opponentPenalty - needBonus - restBonus;
          if (score < bestScore) {
            bestScore = score;
            best = { t1: [a], t2: [b] };
          }
        }
      }

      if (best) {
        addMatch(best.t1, best.t2);
      } else {
        const sorted = [...players].sort((a, b) => gameCount[a] - gameCount[b]);
        addMatch([sorted[0]], [sorted[1]]);
      }
    }
  }

  return results;
}


function CourtTimer({ startedAt }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const isWarning = elapsed >= 600;
  return (
    <div className={`court-timer ${isWarning ? "warning" : "normal"}`}>
      <span className="court-timer-icon">⏱</span>
      {String(mins).padStart(2,"0")}:{String(secs).padStart(2,"0")}
    </div>
  );
}

function RumbleModal({ match, onConfirm, onCancel }) {
  const allPlayers = [...match.t1, ...match.t2];
  const [team1, setTeam1] = useState([]);
  const [team2, setTeam2] = useState([]);
  const maxPer = match.type === "doubles" ? 2 : 1;

  const toggle = (name) => {
    if (team1.includes(name)) { setTeam1(team1.filter((x) => x !== name)); return; }
    if (team2.includes(name)) { setTeam2(team2.filter((x) => x !== name)); return; }
    if (team1.length < maxPer) setTeam1([...team1, name]);
    else if (team2.length < maxPer) setTeam2([...team2, name]);
  };

  const ready = team1.length === maxPer && team2.length === maxPer;

  const getClass = (name) => {
    if (team1.includes(name)) return "rumble-player-btn selected-t1";
    if (team2.includes(name)) return "rumble-player-btn selected-t2";
    const full = team1.length === maxPer && team2.length === maxPer;
    return `rumble-player-btn${full ? " disabled" : ""}`;
  };

  return (
    <div className="rumble-overlay" onClick={onCancel}>
      <div className="rumble-box" onClick={(e) => e.stopPropagation()}>
        <h3 className="rumble-title">🎲 Rumble!</h3>
        <p className="rumble-sub">Pick teams for Match #{match.displayNum} · {match.type === "doubles" ? "2 per team" : "1 per team"}</p>
        <div className="rumble-players">
          {allPlayers.map((name) => (
            <button key={name} className={getClass(name)} onClick={() => toggle(name)}>{name}</button>
          ))}
        </div>
        <div className="rumble-preview">
          {team1.length === 0 && team2.length === 0
            ? <span style={{ color: "#ccc" }}>Tap players to assign teams</span>
            : <>
                <div className="rumble-team">{team1.map((n) => <span key={n} className="rumble-chip-t1">{n}</span>)}</div>
                <span className="rumble-vs">VS</span>
                <div className="rumble-team">{team2.map((n) => <span key={n} className="rumble-chip-t2">{n}</span>)}</div>
              </>
          }
        </div>
        <div className="rumble-actions">
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn-confirm" disabled={!ready} onClick={() => onConfirm(team1, team2)}>Confirm Teams ✓</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab]                 = useState("players");
  const [players, setPlayers]         = useState([]);
  const [nameInput, setNameInput]     = useState("");
  const [mode, setMode]               = useState("doubles");
  const [matches, setMatches]         = useState([]);
  const [stats, setStats]             = useState({});
  const [history, setHistory]         = useState([]);
  const [courts, setCourts]           = useState([null, null, null, null]);
  const [courtStartTimes, setCourtStartTimes] = useState([null, null, null, null]);
  const [assignModal, setAssignModal] = useState(null);
  const [rumbleModal, setRumbleModal] = useState(null);
  const [toastMsg, setToastMsg]       = useState("");

  const recordedIds = useRef(new Set());

  const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(""), 2200); };

  const addPlayer = () => {
    const name = nameInput.trim();
    if (!name) return;
    if (players.find((p) => p.toLowerCase() === name.toLowerCase())) { showToast(`${name} already added!`); return; }
    setPlayers((p) => [...p, name]);
    setStats((s) => ({ ...s, [name]: { wins: 0, losses: 0, games: 0, lastResult: null } }));
    setNameInput("");
    showToast(`${name} added ✓`);
  };

  const removePlayer = (name) => { setPlayers((p) => p.filter((x) => x !== name)); showToast(`${name} removed`); };

  const generate = () => {
    if (mode === "singles" && players.length < 2) { showToast("Need 2+ players!"); return; }
    if (mode === "doubles" && players.length < 4) { showToast("Need 4+ players for doubles!"); return; }

    const ms = buildRoundRobin(players, mode, 8);

    const freshStats = {};
    players.forEach((p) => { freshStats[p] = { wins: 0, losses: 0, games: 0, lastResult: null }; });

    setMatches(ms);
    setStats(freshStats);
    setCourts([null, null, null, null]);
    setCourtStartTimes([null, null, null, null]);
    setHistory([]);
    recordedIds.current = new Set();
    showToast(`${ms.length} matches generated 🏓`);

    setTimeout(() => setTab("matches"), 0);
  };

  const openRumble = (matchId) => {
    const m = matches.find((x) => x.id === matchId);
    if (!m) return;
    setRumbleModal({ ...m, displayNum: matches.indexOf(m) + 1 });
  };

  const confirmRumble = (matchId, newT1, newT2) => {
    setMatches((prev) => prev.map((m) => m.id === matchId ? { ...m, t1: newT1, t2: newT2 } : m));
    setRumbleModal(null);
    showToast("Teams reshuffled! 🎲");
  };

  const assignToCourt = (courtIdx) => {
    if (!assignModal) return;
    const { matchId } = assignModal;
    if (courts.includes(matchId)) { showToast("Already on a court!"); setAssignModal(null); return; }
    if (courts[courtIdx] !== null) { showToast(`Court ${courtIdx + 1} is occupied!`); return; }
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;
    const newPlayers = [...match.t1, ...match.t2];
    const activePlayers = courts
      .map((cid) => matches.find((m) => m.id === cid))
      .filter(Boolean)
      .flatMap((m) => [...m.t1, ...m.t2]);
    if (newPlayers.some((p) => activePlayers.includes(p))) { showToast("❌ May player na naglalaro pa!"); return; }
    setCourts((c) => { const n = [...c]; n[courtIdx] = matchId; return n; });
    setCourtStartTimes((t) => { const n = [...t]; n[courtIdx] = Date.now(); return n; });
    setAssignModal(null);
    showToast(`Match assigned to Court ${courtIdx + 1} ✓`);
  };

  const removeFromCourt = (courtIdx) => {
    setCourts((c) => { const n = [...c]; n[courtIdx] = null; return n; });
    setCourtStartTimes((t) => { const n = [...t]; n[courtIdx] = null; return n; });
  };

const recordWinByPlayer = (matchId, clickedName) => {
  if (recordedIds.current.has(matchId)) return;
  
  const m = matches.find((x) => x.id === matchId);
  if (!m || m.done) return;
  
  recordedIds.current.add(matchId);
  
  const winTeam = m.t1.includes(clickedName) ? 1 : 2;
  const winners = winTeam === 1 ? m.t1 : m.t2;
  const losers  = winTeam === 1 ? m.t2 : m.t1;
  const courtIdx = courts.findIndex((c) => c === matchId);

  setMatches((prev) =>
    prev.map((x) => x.id === matchId ? { ...x, done: true, winner: winTeam } : x)
  );

  setStats((s) => {
    const ns = { ...s };
    winners.forEach((name) => {
      const st = { ...(ns[name] || { wins: 0, losses: 0, games: 0, lastResult: null }) };
      st.wins++; st.games++; st.lastResult = "win"; ns[name] = st;
    });
    losers.forEach((name) => {
      const st = { ...(ns[name] || { wins: 0, losses: 0, games: 0, lastResult: null }) };
      st.losses++; st.games++; st.lastResult = "lose"; ns[name] = st;
    });
    return ns;
  });

  setHistory((h) => {
    if (h.some((x) => x.matchId === matchId)) return h;
    return [{
      matchId, court: courtIdx + 1,
      type: m.type, t1: m.t1, t2: m.t2,
      winners, losers,
      time: new Date().toLocaleTimeString()
    }, ...h];
  });

  setCourts((c) => {
    const n = [...c];
    const ci = n.indexOf(matchId);
    if (ci !== -1) {
      n[ci] = null;
      setCourtStartTimes((t) => { const nt = [...t]; nt[ci] = null; return nt; });
    }
    return n;
  });

  showToast("Result recorded ✓");
};

  const onCourtIds     = courts.filter(Boolean);
  const pendingMatches = matches.filter((m) => !m.done && !onCourtIds.includes(m.id));
  const activeMatches  = matches.filter((m) => !m.done && onCourtIds.includes(m.id));
  const doneMatches    = matches.filter((m) => m.done);
  const totalGames     = matches.length;
  const doneCount      = doneMatches.length;
  const pct            = totalGames ? Math.round((doneCount / totalGames) * 100) : 0;
  const sortedStats    = Object.entries(stats)
    .filter(([, v]) => v.games > 0)
    .sort(([, a], [, b]) => b.wins - a.wins || b.games - a.games);
  const leader = sortedStats[0];

  return (
    <div className="root">
      <div className="hero">
        <h1 className="hero-title">🏓<span style={{ color: "#ff69b4" }}>DINK</span>BOARD</h1>
        <p className="hero-sub">GOOD GAME PICKLE CLUB</p>
      </div>

      <div className="nav-wrap">
        <nav className="nav">
          {[
            { id: "players",   icon: "👤", label: "Players",   badge: players.length },
            { id: "matches",   icon: "🏓", label: "Matches",   badge: activeMatches.length || null },
            { id: "standings", icon: "⭐", label: "Standings", badge: null },
            { id: "history",   icon: "📋", label: "History",   badge: history.length || null },
          ].map(({ id, icon, label, badge }) => (
            <button key={id} onClick={() => setTab(id)} className={`nav-btn${tab === id ? " active" : ""}`}>
              <span className="nav-icon">{icon}</span>
              <span className="nav-label">{label}</span>
              {badge ? <span className="nav-badge">{badge}</span> : null}
            </button>
          ))}
        </nav>
      </div>

      {totalGames > 0 && (
        <div className="prog-wrap">
          <div className="prog-track"><div className="prog-fill" style={{ width: `${pct}%` }} /></div>
          <span className="prog-label">{doneCount}/{totalGames} · {pct}%</span>
        </div>
      )}

      <div className="main">

        {tab === "players" && (
          <div className="container">
            <form onSubmit={(e) => { e.preventDefault(); addPlayer(); }} className="player-form">
              <input className="input" value={nameInput} onChange={(e) => setNameInput(e.target.value)}
                placeholder="Enter player name" maxLength={24} />
              <button type="submit" className="btn-pink">+ Add</button>
            </form>
            <h2 className="section-title">Roster — {players.length} players</h2>
            <ul className="roster-list">
              {players.length === 0 && <li className="empty-state">No players yet. Add some above!</li>}
              {players.map((name, i) => {
                const s = stats[name];
                return (
                  <li key={name} className="player-item">
                    <div className="player-left">
                      <div>
                        <div className="player-name">{i + 1}. {name}</div>
                        {s?.games > 0 && <div className="player-stat-row">W:{s.wins} L:{s.losses} GP:{s.games}</div>}
                      </div>
                    </div>
                    <button onClick={() => removePlayer(name)} className="remove-btn">❌</button>
                  </li>
                );
              })}
            </ul>
            <div className="controls-row">
              <label className="label">Mode</label>
              <select value={mode} onChange={(e) => setMode(e.target.value)} className="select">
                <option value="singles">Singles (1v1)</option>
                <option value="doubles">Doubles (2v2)</option>
              </select>
              <button onClick={generate} className="btn-pink">⚡ Generate Matches</button>
              <button onClick={() => {
                if (!window.confirm("Clear everything?")) return;
                setPlayers([]); setMatches([]); setStats({}); setHistory([]);
                setCourts([null,null,null,null]); setCourtStartTimes([null,null,null,null]);
                recordedIds.current = new Set();
              }} className="btn-ghost">Clear All</button>
            </div>
          </div>
        )}

        {tab === "matches" && (
          <div>
            <div className="courts-wrap">
              <div className="section-hdr">
                <h2 className="section-title" style={{ margin: 0 }}>Courts</h2>
              </div>
              <div className="courts-grid">
                {courts.map((mid, ci) => {
                  const m = mid !== null ? matches.find((x) => x.id === mid) : null;
                  return (
                    <div key={ci} className={`court-card ${m ? "court-live" : "court-idle"}`}>
                      <div className="court-hdr">
                        <span className="court-num">COURT {ci + 1}</span>
                        {m
                          ? <span className="court-badge-live"><span className="live-dot" />LIVE</span>
                          : <span className="court-badge-idle">IDLE</span>
                        }
                      </div>
                      {m ? (
                        <>
                          {courtStartTimes[ci] && <CourtTimer startedAt={courtStartTimes[ci]} />}
                          <p className="pick-hint">Tap winner's name</p>
                          <div className="court-matchup">
                            <div className="court-team">
                              {m.t1.map((n) => (
                                <div key={n} className="court-player">
                                  <span className="court-pname" onClick={() => recordWinByPlayer(m.id, n)}>{n}</span>
                                </div>
                              ))}
                            </div>
                            <div className="court-vs">VS</div>
                            <div className="court-team">
                              {m.t2.map((n) => (
                                <div key={n} className="court-player">
                                  <span className="court-pname" onClick={() => recordWinByPlayer(m.id, n)}>{n}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <button className="btn-remove-court" onClick={() => removeFromCourt(ci)}>Remove from Court</button>
                        </>
                      ) : (
                        <div className="court-empty">
                          <img src="ll.png" alt="Empty Court" className="court-empty-img"/>
                          <span className="court-empty-label">No match assigned</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="queue-wrap">
              <div className="section-hdr">
                <h2 className="section-title" style={{ margin: 0 }}>Up Next — {pendingMatches.length} pending</h2>
                <button className="btn-ghost" onClick={() => {
                  if (!window.confirm("Reset all matches?")) return;
                  setMatches([]); setCourts([null,null,null,null]); setCourtStartTimes([null,null,null,null]);
                  recordedIds.current = new Set();
                }}>Reset</button>
              </div>
              {matches.length === 0 && <div className="empty-state">No schedule yet — generate one in Players tab!</div>}
              <div className="pending-list">
                {pendingMatches.map((m) => (
                  <div key={m.id} className="pending-card">
                    <div className="pending-top">
                      <span className="pending-num">Match #{matches.indexOf(m) + 1}</span>
                      <span className={`type-tag ${m.type === "doubles" ? "type-d" : "type-s"}`}>{m.type}</span>
                      {m.type === "doubles" && (
                        <button className="btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }}
                          onClick={() => openRumble(m.id)}>🎲 Rumble</button>
                      )}
                      <button className="btn-assign" onClick={() => setAssignModal({ matchId: m.id })}>📌 Assign</button>
                    </div>
                    <div className="pending-names">
                      {m.t1.map((n) => <span key={n} className="pending-bubble">{n}</span>)}
                      <span className="vs-label">vs</span>
                      {m.t2.map((n) => <span key={n} className="pending-bubble">{n}</span>)}
                    </div>
                  </div>
                ))}
              </div>
              {pendingMatches.length === 0 && matches.length > 0 && (
                <div className="empty-state">
                  {doneMatches.length === matches.length ? "🎉 All matches done!" : "All matches are on courts!"}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "standings" && (
          <div>
            {leader && (
              <div className="winner-box">
                <div className="crown-icon">👑</div>
                <h2 className="winner-heading">PLAYER OF THE DAY</h2>
                <div className="winner-name">{leader[0]}</div>
                <div className="winner-stats">
                  <span>{leader[1].wins} Wins</span>
                  <span>{leader[1].games} Played</span>
                  <span>{leader[1].games ? Math.round(leader[1].wins / leader[1].games * 100) : 0}% Win Rate</span>
                  <span>{leader[1].wins * 20} Pts</span>
                </div>
              </div>
            )}
            <div className="standings-container">
              <h2 className="section-title">Player Standings</h2>
              {sortedStats.length === 0 && <div className="empty-state">Record match results to see standings.</div>}
              {sortedStats.length > 0 && (
                <div style={{ overflowX: "auto" }}>
                  <table className="standings-table">
                    <thead>
                      <tr>{["#","Player","Wins","Played","W%","Pts"].map((h) => <th key={h}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {sortedStats.map(([name, s], i) => {
                        const wr = s.games ? Math.round(s.wins / s.games * 100) : 0;
                        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                        return (
                          <tr key={name} className={i === 0 ? "leader" : ""}>
                            <td>
                              {medal
                                ? <span style={{ fontSize: 22 }}>{medal}</span>
                                : <span style={{ fontSize: 11, fontWeight: 800, color: "#999",
                                    background: "#efefef", borderRadius: "50%",
                                    width: 24, height: 24, display: "inline-flex",
                                    alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                              }
                            </td>
                            <td>
                              <div style={{ fontWeight: 700 }}>{name}</div>
                              <div style={{ fontSize: 10, color: s.lastResult === "win" ? "#006700" : s.lastResult === "lose" ? "#ff5252" : "#aaa" }}>
                                {s.lastResult === "win" ? "Last: W ↑" : s.lastResult === "lose" ? "Last: L ↓" : "—"}
                              </div>
                            </td>
                            <td style={{ color: "#000", fontWeight: 800, fontSize: 16 }}>{s.wins}</td>
                            <td>{s.games}</td>
                            <td>
                              <div className="wr-cell">
                                <div className="wr-track"><div className="wr-fill" style={{ width: `${wr}%` }} /></div>
                                {wr}%
                              </div>
                            </td>
                            <td style={{ color: "#000", fontWeight: 700 }}>{s.wins * 20}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "history" && (
          <div className="container">
            <div className="section-hdr">
              <h2 className="section-title" style={{ margin: 0 }}>Match History</h2>
              {history.length > 0 && <button className="btn-ghost" onClick={() => setHistory([])}>Clear</button>}
            </div>
            {history.length === 0 && <div className="empty-state">No matches completed yet.</div>}
            {history.map((h, i) => (
              <div key={h.matchId} className="hist-card">
                <div className="hist-top">
                  <div className="hist-left">
                    <span className="hist-time">{h.time}</span>
                    {h.court > 0 && <span className="hist-court">Court {h.court}</span>}
                    <span className={`type-tag ${h.type === "doubles" ? "type-d" : "type-s"}`}>{h.type}</span>
                  </div>
                  <span className="hist-num">#{history.length - i}</span>
                </div>
                <div className="hist-body">
                  <div className="hist-winners">
                    <span className="hist-trophy">🏆</span>
                    <div>
                      <div style={{ fontSize: 10, color: "#000", fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>WINNERS</div>
                      {h.winners.map((n) => (
                        <div key={n} className="hist-player">
                          <span style={{ fontWeight: 700, color: "#0d782d" }}>{n}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="hist-vs">VS</div>
                  <div className="hist-losers">
                    <div>
                      <div style={{ fontSize: 10, color: "#aaa", fontWeight: 700, letterSpacing: 1, marginBottom: 4, textAlign: "right" }}>LOSERS</div>
                      {h.losers.map((n) => (
                        <div key={n} className="hist-player" style={{ justifyContent: "flex-end" }}>
                          <span style={{ color: "#aaa" }}>{n}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {assignModal && (
        <div className="modal-overlay" onClick={() => setAssignModal(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Assign to Court</h3>
            <p style={{ fontSize: 13, color: "#888", marginTop: 4 }}>Select an available court</p>
            <div className="modal-courts">
              {courts.map((mid, ci) => {
                const occupied = mid !== null;
                return (
                  <button key={ci} disabled={occupied}
                    className={`court-pick-btn ${occupied ? "court-pick-occupied" : "court-pick-free"}`}
                    onClick={() => assignToCourt(ci)}>
                    <span style={{ fontSize: 22 }}>🏟️</span>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>Court {ci + 1}</span>
                    <span style={{ fontSize: 11 }}>{occupied ? "Occupied" : "Available"}</span>
                  </button>
                );
              })}
            </div>
            <button className="btn-ghost" style={{ width: "100%", marginTop: 12 }} onClick={() => setAssignModal(null)}>Cancel</button>
          </div>
        </div>
      )}

      {rumbleModal && (
        <RumbleModal
          match={rumbleModal}
          onConfirm={(t1, t2) => confirmRumble(rumbleModal.id, t1, t2)}
          onCancel={() => setRumbleModal(null)}
        />
      )}

      {toastMsg && <div className="toast">{toastMsg}</div>}
    </div>
  );
}
