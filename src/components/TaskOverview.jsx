import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { SCREENS, PRIORITY_CONFIG } from '../data/constants';
import AddTaskModal from './AddTaskModal';

const getTaskSeed = (id) => {
  const text = String(id || '');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

const getTaskStyle = (taskId) => {
  const seed = getTaskSeed(taskId);
  const rotation = ((seed % 5) - 2) * 2;
  const delay = (seed % 10) * 0.02;
  return {
    '--rotation': `${rotation}deg`,
    '--delay': `${delay}s`,
  };
};

const formatTimeRemaining = (deadline) => {
  if (!deadline) return null;
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diff = deadlineDate - now;
  
  if (diff <= 0) return 'Overdue!';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const formatDeadline = (deadline) => {
  if (!deadline) return 'No deadline';
  const date = new Date(deadline);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const QuestScroll = memo(
  function QuestScroll({ task, isNew, onStartTask, onDeleteTask }) {
    const style = getTaskStyle(task.id);

    return (
      <div
        className={`quest-scroll-container${isNew ? ' quest-scroll-new' : ''}`}
        style={style}
      >
        <div className="tack" />
        <div 
          className={`quest-scroll ${task.priority}`}
          onClick={() => onStartTask(task)}
        >
          <div className="scroll-top-curl" />
          <div className="scroll-content">
            <div className={`priority-seal ${task.priority}`}>
              {PRIORITY_CONFIG[task.priority]?.label || task.priority}
            </div>
            <div className="quest-name">{task.name}</div>
            <div className="quest-details">
              <div className="quest-detail">
                <span className="detail-icon">📅</span>
                <span className="detail-value">
                  {formatDeadline(task.deadline)}
                </span>
              </div>
              <div className="quest-detail">
                <span className="detail-icon">⏱</span>
                <span className="detail-value">{task.timeEstimate} min</span>
              </div>
              {task.deadline && (
                <div className="quest-detail time-remaining">
                  <span className="detail-icon">⏳</span>
                  <span className="detail-value">
                    {formatTimeRemaining(task.deadline)}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="scroll-bottom-curl" />
          <button 
            className="start-quest-btn"
            onClick={(e) => {
              e.stopPropagation();
              onStartTask(task);
            }}
          >
            ⚔ Start
          </button>
          <button 
            className="delete-quest-btn"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteTask(task.id);
            }}
          >
            ✕
          </button>
        </div>
      </div>
    );
  },
  (prev, next) => prev.task === next.task && prev.isNew === next.isNew
);

function TaskOverview({ gameState, onNavigate, onStartTask }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Only show active tasks (not completed)
  const activeTasks = useMemo(() => {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    return gameState.tasks
      .filter((t) => !t.completed)
      .map((task, index) => ({ task, index }))
      .sort((a, b) => {
        const aPriority = priorityOrder[a.task.priority] ?? priorityOrder.medium;
        const bPriority = priorityOrder[b.task.priority] ?? priorityOrder.medium;
        const priorityDiff = aPriority - bPriority;
        if (priorityDiff !== 0) return priorityDiff;
        const aCreated = a.task.createdAt ? new Date(a.task.createdAt).getTime() : 0;
        const bCreated = b.task.createdAt ? new Date(b.task.createdAt).getTime() : 0;
        if (aCreated !== bCreated) return aCreated - bCreated;
        const idCompare = String(a.task.id).localeCompare(String(b.task.id));
        if (idCompare !== 0) return idCompare;
        return a.index - b.index;
      })
      .map(({ task }) => task);
  }, [gameState.tasks]);

  const prevTaskIdsRef = useRef(new Set());
  const newTaskIds = useMemo(() => {
    const prevIds = prevTaskIdsRef.current;
    const nextNewIds = new Set();
    for (const task of activeTasks) {
      if (!prevIds.has(task.id)) {
        nextNewIds.add(task.id);
      }
    }
    return nextNewIds;
  }, [activeTasks]);

  useEffect(() => {
    prevTaskIdsRef.current = new Set(activeTasks.map((task) => task.id));
  }, [activeTasks]);

  return (
    <div className="screen task-overview-screen fullscreen">
      <div className="quest-board-container fullscreen">
        <header className="quest-board-header">
          <button className="btn btn-back" onClick={() => onNavigate(SCREENS.HOME)}>
            ← Back
          </button>
          <h1 className="quest-board-title">QUEST BOARD</h1>
          <button className="btn btn-add-quest" onClick={() => setIsModalOpen(true)}>
            + New Quest
          </button>
        </header>

        <div className="bulletin-board">
          <div className="board-frame">
            <div className="board-surface">
              {activeTasks.length === 0 ? (
                <div className="empty-board">
                  <div className="empty-scroll">
                    <p>No active quests</p>
                    <p className="empty-hint">Add a quest to begin your adventure!</p>
                    <button className="btn btn-add-quest" onClick={() => setIsModalOpen(true)}>
                      Add Quest
                    </button>
                  </div>
                </div>
              ) : (
                <div className="quest-scrolls-board">
                  {activeTasks.map((task) => (
                    <QuestScroll
                      key={task.id}
                      task={task}
                      isNew={newTaskIds.has(task.id)}
                      onStartTask={onStartTask}
                      onDeleteTask={gameState.deleteTask}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AddTaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={(taskData) => {
          gameState.addTask(taskData);
          setIsModalOpen(false);
        }}
      />
    </div>
  );
}

export default TaskOverview;
