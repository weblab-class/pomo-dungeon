import { useEffect, useMemo, useState } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { getJson } from '../utils/api';

const formatDuration = (totalSeconds) => {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};

function RecordsScreen({ onBack }) {
  const [googleUser] = useLocalStorage('pomoDungeon_googleUser', null);
  const [stats, setStats] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const userId = googleUser?.sub || googleUser?.email;
    if (!userId) return;
    let isActive = true;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [statsRes, tasksRes] = await Promise.all([
          getJson(`/api/stats/${userId}`),
          getJson(`/api/tasks/${userId}`),
        ]);
        if (!isActive) return;
        setStats(statsRes || null);
        setTasks(Array.isArray(tasksRes?.tasks) ? tasksRes.tasks : []);
      } catch (err) {
        if (!isActive) return;
        setError(err?.message || 'Could not load records from MongoDB.');
        setStats(null);
        setTasks([]);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    load();
    return () => {
      isActive = false;
    };
  }, [googleUser?.sub, googleUser?.email]);

  const totals = useMemo(() => {
    const totalSecondsOnSite = stats?.totalSecondsOnSite || 0;
    const totalTimeWorkedMs = stats?.totalTimeWorkedMs || 0;
    return {
      totalSecondsOnSite,
      totalTimeWorkedMs,
      totalTimeWorkedSeconds: Math.floor(totalTimeWorkedMs / 1000),
      totalQuestsCompleted: stats?.totalQuestsCompleted || 0,
    };
  }, [stats]);

  const sortedQuests = useMemo(() => {
    const list = Array.isArray(stats?.quests) ? [...stats.quests] : [];
    return list.sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt));
  }, [stats]);


  const activeUserLabel = googleUser?.email || 'Unknown user';
  const activeUserId = googleUser?.sub || googleUser?.email || '—';

  return (
    <div className="screen records-screen fullscreen">
      <div className="collections-wrap">
        <header className="screen-header">
          <button className="btn btn-back" onClick={onBack}>
            ← Back
          </button>
          <h1>Records</h1>
          <div />
        </header>

        {!googleUser?.email && (
          <div className="records-empty">
            Sign in with Google to view your records.
          </div>
        )}

        {googleUser?.email && (
          <div className="records-content">
            {loading && <div className="records-empty">Loading records...</div>}
            {error && <div className="records-empty">{error}</div>}

            {!loading && !error && (
              <>
                <section className="stats-section">
                  <h2>Summary</h2>
                  <div className="records-user">
                    Signed in as <strong>{activeUserLabel}</strong>
                    <span className="records-user-id">ID: {activeUserId}</span>
                  </div>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <div className="stat-value">{formatDuration(totals.totalSecondsOnSite)}</div>
                      <div className="stat-label">Time On Site</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{totals.totalQuestsCompleted}</div>
                      <div className="stat-label">Quests Completed</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{formatDuration(totals.totalTimeWorkedSeconds)}</div>
                      <div className="stat-label">Time Worked</div>
                    </div>
                  </div>
                </section>

                <section className="stats-section">
                  <h2>Quests</h2>
                  {sortedQuests.length === 0 ? (
                    <div className="records-empty">No quests recorded yet.</div>
                  ) : (
                    <div className="records-list">
                      {sortedQuests.map((quest) => (
                        <div key={quest.questId} className="records-item">
                          <div className="records-title">{quest.name || quest.questId}</div>
                          <div className="records-meta">
                            <span>Priority: {quest.priority || '—'}</span>
                            <span>Duration: {formatDuration(quest.durationSeconds)}</span>
                            <span>Finished: {formatDateTime(quest.finishedAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="stats-section">
                  <h2>Tasks</h2>
                  {tasks.length === 0 ? (
                    <div className="records-empty">No tasks recorded yet.</div>
                  ) : (
                    <div className="records-list">
                      {tasks.map((task) => (
                        <div key={task.id} className="records-item">
                          <div className="records-title">{task.name || task.id}</div>
                          <div className="records-meta">
                            <span>Priority: {task.priority || '—'}</span>
                            <span>Status: {task.completed ? 'Completed' : 'Active'}</span>
                            <span>Created: {formatDateTime(task.createdAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default RecordsScreen;
