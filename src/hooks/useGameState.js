import { useEffect, useRef } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { getJson, postJson, logEvent } from '../utils/api';
import { PRIORITY, COIN_REWARDS, getRandomDungeonRoom, getMonsterForPriority } from '../data/constants';

const STORAGE_KEYS = {
  PLAYER: 'pomoDungeon_player',
  TASKS: 'pomoDungeon_tasks',
  DELETED_TASK_IDS: 'pomoDungeon_deletedTaskIds',
};

const createDefaultPlayer = () => ({
  coins: 0,
  currentAvatar: 'knight_1',
  unlockedAvatars: ['knight_1'],
  totalTasksCompleted: 0,
  totalTimeWorked: 0,
  completedTasks: [], // Array of { name, timeEstimate, deadline, completedAt, timeRemainingBeforeDeadline }
});

export function useGameState() {
  const [player, setPlayer] = useLocalStorage(STORAGE_KEYS.PLAYER, createDefaultPlayer());
  const [tasks, setTasks] = useLocalStorage(STORAGE_KEYS.TASKS, []);
  const [googleUser] = useLocalStorage('pomoDungeon_googleUser', null);
  const prevUserIdRef = useRef(null);
  const mutationCountRef = useRef(0);
  const deletedIdsInMemoryRef = useRef(new Set());

  useEffect(() => {
    const userId = googleUser?.sub || googleUser?.email || null;
    if (!userId) return;
    if (prevUserIdRef.current && prevUserIdRef.current !== userId) {
      localStorage.removeItem(STORAGE_KEYS.PLAYER);
      localStorage.removeItem(STORAGE_KEYS.TASKS);
      localStorage.removeItem(STORAGE_KEYS.DELETED_TASK_IDS);
      deletedIdsInMemoryRef.current.clear();
      setPlayer(createDefaultPlayer());
      setTasks([]);
      mutationCountRef.current = 0;
    }
    prevUserIdRef.current = userId;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setPlayer/setTasks are stable in behavior; we only need to react to user identity to avoid effect running every render.
  }, [googleUser?.sub, googleUser?.email]);

  // On mount/remount/refresh: if pomoDungeon_tasks contains any id in DELETED_TASK_IDS (e.g. TASKS
  // was never persisted after a delete because localStorage.setItem failed), remove them and persist.
  // loadTasks does not run after every delete, so the only fix for stale TASKS at init is here.
  useEffect(() => {
    setTasks((prev) => {
      let deleted = [];
      try {
        deleted = JSON.parse(localStorage.getItem(STORAGE_KEYS.DELETED_TASK_IDS) || '[]');
      } catch {
        deleted = [];
      }
      const toRemove = prev.filter((t) => deleted.includes(t.id));
      if (toRemove.length === 0) return prev;
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e7b0bc9d-6948-4adc-afad-7004a329e4a6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGameState.js:sync-on-mount',message:'sync-on-mount: corrected tasks by DELETED_TASK_IDS',data:{removedIds:toRemove.map(t=>t.id),deletedCount:toRemove.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H6'})}).catch(()=>{});
      // #endregion
      return prev.filter((t) => !deleted.includes(t.id));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount; setTasks intentionally omitted
  }, []);

  useEffect(() => {
    const userId = googleUser?.sub || googleUser?.email;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e7b0bc9d-6948-4adc-afad-7004a329e4a6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGameState.js:loadTasks-effect',message:'loadTasks effect run',data:{sub:googleUser?.sub,email:googleUser?.email,userId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H5'})}).catch(()=>{});
    // #endregion
    if (!userId) return undefined;
    let isActive = true;

    const loadTasks = async () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e7b0bc9d-6948-4adc-afad-7004a329e4a6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGameState.js:loadTasks-fn',message:'loadTasks() called',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H5'})}).catch(()=>{});
      // #endregion
      const genAtStart = mutationCountRef.current;
      try {
        const res = await getJson(`/api/tasks/${userId}`);
        if (isActive && Array.isArray(res.tasks)) {
          if (mutationCountRef.current !== genAtStart) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/e7b0bc9d-6948-4adc-afad-7004a329e4a6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGameState.js:loadTasks-skip-mutation',message:'loadTasks skip (mutation guard)',data:{genAtStart,mutationCount:mutationCountRef.current},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
            // #endregion
            return;
          }
          // Filter out any tasks the user has deleted (in case server is slow or failed to apply delete)
          let deletedIds = [];
          try {
            deletedIds = JSON.parse(localStorage.getItem(STORAGE_KEYS.DELETED_TASK_IDS) || '[]');
          } catch {
            deletedIds = [];
          }
          const filtered = res.tasks.filter((t) => !deletedIds.includes(t.id) && !deletedIdsInMemoryRef.current.has(t.id));
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/e7b0bc9d-6948-4adc-afad-7004a329e4a6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGameState.js:loadTasks-setTasks',message:'loadTasks setTasks (filtered)',data:{deletedIds,resIds:res.tasks.map(t=>t.id),filteredIds:filtered.map(t=>t.id),filteredOut:res.tasks.length-filtered.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3'})}).catch(()=>{});
          // #endregion
          // Do not remove ids from deletedIds: a later loadTasks can get a server response that
          // still includes a deleted task (replica, timing, or failed delete). We only clear
          // deletedIds when the user switches accounts.
          setTasks(filtered);
        }
      } catch (error) {
        // Ignore load errors to keep local tasks usable
      }
    };

    loadTasks();
    return () => {
      isActive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentionally exclude setTasks: it changes identity when tasks update (useLocalStorage setValue). Including it causes the effect to re-run after every loadTasks overwrite -> new fetch -> overwrite loop and flicker. We only want to run when user identity changes.
  }, [googleUser?.sub, googleUser?.email]);

  // Create a new task
  const addTask = ({ name, timeEstimate, deadline, priority }) => {
    const monsterType = getMonsterForPriority(priority || PRIORITY.MEDIUM);
    const newTask = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      name: name || 'Unnamed Task',
      timeEstimate: timeEstimate || 25,
      deadline: deadline || null,
      priority: priority || PRIORITY.MEDIUM,
      monsterType,
      dungeonRoom: getRandomDungeonRoom(),
      completed: false,
      createdAt: new Date().toISOString(),
      completedAt: null,
      timeSpent: 0,
    };
    setTasks((prev) => [...prev, newTask]);
    mutationCountRef.current += 1;
    if (googleUser?.sub || googleUser?.email) {
      const userId = googleUser.sub || googleUser.email;
      void postJson('/api/tasks/upsert', { userId, task: newTask }).catch(() => {});
      logEvent(userId, 'quest_created', { taskId: newTask.id });
    }
    return newTask;
  };

  // Update a task
  const updateTask = (taskId, updates) => {
    let updatedTask = null;
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) return task;
        updatedTask = { ...task, ...updates };
        return updatedTask;
      })
    );
    mutationCountRef.current += 1;
    if ((googleUser?.sub || googleUser?.email) && updatedTask) {
      const userId = googleUser.sub || googleUser.email;
      void postJson('/api/tasks/upsert', { userId, task: updatedTask }).catch(() => {});
    }
  };

  // Delete a task
  const deleteTask = (taskId) => {
    const task = tasks.find((t) => t.id === taskId);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e7b0bc9d-6948-4adc-afad-7004a329e4a6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGameState.js:deleteTask',message:'deleteTask called',data:{taskId,taskFound:!!task,currentCount:tasks.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
    // #endregion
    // Persist deleted id so loadTasks won't bring it back if server is slow or failed
    try {
      const deleted = JSON.parse(localStorage.getItem(STORAGE_KEYS.DELETED_TASK_IDS) || '[]');
      if (!deleted.includes(taskId)) deleted.push(taskId);
      localStorage.setItem(STORAGE_KEYS.DELETED_TASK_IDS, JSON.stringify(deleted));
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e7b0bc9d-6948-4adc-afad-7004a329e4a6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGameState.js:deleteTask-write',message:'deleteTask wrote to DELETED_TASK_IDS',data:{taskId,deletedIds:deleted},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
    } catch {
      /* ignore */
    }
    deletedIdsInMemoryRef.current.add(taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    mutationCountRef.current += 1;
    if (googleUser?.sub || googleUser?.email) {
      const userId = googleUser.sub || googleUser.email;
      (async () => {
        try {
          await postJson('/api/tasks/delete', { userId, taskId });
        } catch (err) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/e7b0bc9d-6948-4adc-afad-7004a329e4a6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGameState.js:deleteTask-api-fail',message:'deleteTask API failed (keeping optimistic remove)',data:{taskId,err:err?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'H4'})}).catch(()=>{});
          // #endregion
          // Do not revert: keep optimistic remove. Task stays in DELETED_TASK_IDS and
          // deletedIdsInMemoryRef so loadTasks won't bring it back. Server may retry later.
          console.error('Failed to delete task', err);
        }
      })();
    }
  };

  // Complete a task and award coins
  const completeTask = (taskId, meta = {}) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.completed) return null;

    const coinsEarned = COIN_REWARDS[task.priority] || 20;
    const completedAt = new Date().toISOString();
    const startedAt = meta.startedAt || task.startedAt || task.createdAt || completedAt;
    const timeSpentMs = Number.isFinite(meta.timeSpentMs) ? meta.timeSpentMs : task.timeSpent || 0;
    const durationSeconds = Math.max(0, Math.floor(timeSpentMs / 1000));
    
    // Calculate time remaining before deadline
    let timeRemainingBeforeDeadline = null;
    if (task.deadline) {
      const deadlineTime = new Date(task.deadline).getTime();
      const completedTime = new Date(completedAt).getTime();
      timeRemainingBeforeDeadline = deadlineTime - completedTime;
    }

    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, completed: true, completedAt }
          : t
      )
    );
    mutationCountRef.current += 1;

    setPlayer((prev) => ({
      ...prev,
      coins: prev.coins + coinsEarned,
      totalTasksCompleted: prev.totalTasksCompleted + 1,
      totalTimeWorked: prev.totalTimeWorked + timeSpentMs,
      completedTasks: [
        ...(prev.completedTasks || []),
        {
          id: task.id,
          name: task.name,
          timeEstimate: task.timeEstimate,
          deadline: task.deadline,
          completedAt,
          timeRemainingBeforeDeadline,
          priority: task.priority,
        }
      ],
    }));

    if (googleUser?.sub || googleUser?.email) {
      const userId = googleUser.sub || googleUser.email;
      const updatedTask = {
        ...task,
        completed: true,
        completedAt,
        timeSpent: timeSpentMs,
        startedAt,
      };
      void postJson('/api/tasks/upsert', { userId, task: updatedTask }).catch(() => {});
      const payload = {
        userId,
        questId: task.id,
        name: task.name,
        priority: task.priority,
        startedAt,
        finishedAt: completedAt,
        durationSeconds,
        timeSpentMs,
      };
      void postJson('/api/quests/complete', payload).catch(() => {});
    }

    return { task, coinsEarned };
  };

  // Unlock an avatar
  const unlockAvatar = (avatarId, cost) => {
    if (player.unlockedAvatars.includes(avatarId)) {
      return { success: false, error: 'Already unlocked' };
    }
    if (player.coins < cost) {
      return { success: false, error: 'Not enough coins' };
    }

    setPlayer((prev) => ({
      ...prev,
      coins: prev.coins - cost,
      unlockedAvatars: [...prev.unlockedAvatars, avatarId],
    }));

    return { success: true };
  };

  // Set current avatar
  const setCurrentAvatar = (avatarId) => {
    if (!player.unlockedAvatars.includes(avatarId)) {
      return { success: false, error: 'Avatar not unlocked' };
    }
    setPlayer((prev) => ({ ...prev, currentAvatar: avatarId }));
    return { success: true };
  };

  // Get active tasks sorted by priority
  const getActiveTasks = () => {
    const priorityOrder = {
      [PRIORITY.URGENT]: 0,
      [PRIORITY.HIGH]: 1,
      [PRIORITY.MEDIUM]: 2,
      [PRIORITY.LOW]: 3,
    };
    return tasks
      .filter((t) => !t.completed)
      .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  };

  return {
    player,
    tasks,
    addTask,
    updateTask,
    deleteTask,
    completeTask,
    unlockAvatar,
    setCurrentAvatar,
    getActiveTasks,
  };
}
