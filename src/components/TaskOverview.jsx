import { useEffect, useRef, useState } from 'react';
import { SCREENS, PRIORITY_CONFIG } from '../data/constants';
import AddTaskModal from './AddTaskModal';

function TaskOverview({ gameState, onNavigate, onStartTask }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [animatedTaskIds, setAnimatedTaskIds] = useState(new Set());
  const [isBoardUpdating, setIsBoardUpdating] = useState(false);
  const seenTaskIdsRef = useRef(new Set());
  const prevTaskIdsRef = useRef('');

  // Only show active tasks (not completed)
  const activeTasks = gameState.tasks
    .filter((t) => !t.completed)
    .sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (aCreated !== bCreated) return aCreated - bCreated;
      return String(a.id).localeCompare(String(b.id));
    });

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

  useEffect(() => {
    const idsSignature = activeTasks.map((task) => task.id).join('|');
    if (idsSignature !== prevTaskIdsRef.current) {
      prevTaskIdsRef.current = idsSignature;
      setIsBoardUpdating(true);
      const timer = setTimeout(() => setIsBoardUpdating(false), 200);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [activeTasks]);

  useEffect(() => {
    const seen = seenTaskIdsRef.current;
    const newlyAdded = [];
    for (const task of activeTasks) {
      if (!seen.has(task.id)) {
        seen.add(task.id);
        newlyAdded.push(task.id);
      }
    }
    if (newlyAdded.length === 0) return;

    setAnimatedTaskIds((prev) => {
      const next = new Set(prev);
      newlyAdded.forEach((id) => next.add(id));
      return next;
    });

    newlyAdded.forEach((id) => {
      setTimeout(() => {
        setAnimatedTaskIds((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 350);
    });
  }, [activeTasks]);

  const getTaskSeed = (id) => {
    const text = String(id || '');
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
      hash = (hash * 31 + text.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  };

  const getTaskStyle = (task) => {
    const seed = getTaskSeed(task.id);
    const rotation = ((seed % 5) - 2) * 2;
    const delay = (seed % 10) * 0.02;
    return {
      '--rotation': `${rotation}deg`,
      '--delay': `${delay}s`,
    };
  };

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
                <div className={`quest-scrolls-board${isBoardUpdating ? ' is-updating' : ''}`}>
                  {activeTasks.map((task) => {
                    return (
                    <div 
                      key={task.id} 
                      className={`quest-scroll-container${animatedTaskIds.has(task.id) ? ' quest-scroll-animate' : ''}`}
                      style={getTaskStyle(task)}
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
                            gameState.deleteTask(task.id);
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    );
                  })}
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
