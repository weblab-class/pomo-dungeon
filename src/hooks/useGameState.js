import { useEffect, useRef } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { getJson, postJson } from '../utils/api';
import { PRIORITY, COIN_REWARDS, getRandomDungeonRoom, getMonsterForPriority } from '../data/constants';

const STORAGE_KEYS = {
  PLAYER: 'pomoDungeon_player',
  TASKS: 'pomoDungeon_tasks',
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

  useEffect(() => {
    const userId = googleUser?.sub || googleUser?.email || null;
    if (!userId) return;
    if (prevUserIdRef.current && prevUserIdRef.current !== userId) {
      localStorage.removeItem(STORAGE_KEYS.PLAYER);
      localStorage.removeItem(STORAGE_KEYS.TASKS);
      setPlayer(createDefaultPlayer());
      setTasks([]);
    }
    prevUserIdRef.current = userId;
  }, [googleUser?.sub, googleUser?.email, setPlayer, setTasks]);

  useEffect(() => {
    const userId = googleUser?.sub || googleUser?.email;
    if (!userId) return undefined;
    let isActive = true;

    const loadTasks = async () => {
      try {
        const res = await getJson(`/api/tasks/${userId}`);
        if (isActive && Array.isArray(res.tasks)) {
          setTasks(res.tasks);
        }
      } catch (error) {
        // Ignore load errors to keep local tasks usable
      }
    };

    loadTasks();
    return () => {
      isActive = false;
    };
  }, [googleUser?.sub, googleUser?.email, setTasks]);

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
    if (googleUser?.sub || googleUser?.email) {
      const userId = googleUser.sub || googleUser.email;
      void postJson('/api/tasks/upsert', { userId, task: newTask }).catch(() => {});
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
    if ((googleUser?.sub || googleUser?.email) && updatedTask) {
      const userId = googleUser.sub || googleUser.email;
      void postJson('/api/tasks/upsert', { userId, task: updatedTask }).catch(() => {});
    }
  };

  // Delete a task
  const deleteTask = (taskId) => {
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
    if (googleUser?.sub || googleUser?.email) {
      const userId = googleUser.sub || googleUser.email;
      void postJson('/api/tasks/delete', { userId, taskId }).catch(() => {});
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
