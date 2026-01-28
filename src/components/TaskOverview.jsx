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
  const [animatedTaskIds, setAnimatedTaskIds] = useState(new Set());
  const [isBoardUpdating, setIsBoardUpdating] = useState(false);
  const seenTaskIdsRef = useRef(new Set());
  const prevTaskIdsRef = useRef('');
  // Map task IDs to stable position indices (based on creation order)
  const stablePositionMapRef = useRef(new Map());

  // Only show active tasks (not completed)
  // Sort by creation time for stable positioning (tasks won't move when others added/deleted)
  const activeTasks = gameState.tasks
    .filter((t) => !t.completed)
    .sort((a, b) => {
      // Primary sort: creation time (for stable positions)
      const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (aCreated !== bCreated) return aCreated - bCreated;
      // Fallback: ID for consistent ordering
      return String(a.id).localeCompare(String(b.id));
    });

  // Maintain stable position map - assign positions based on creation order
  useEffect(() => {
    const positionMap = stablePositionMapRef.current;
    const currentIds = new Set(activeTasks.map(t => t.id));
    
    // Sort all tasks by creation time to get stable order
    const allTasksByCreation = [...activeTasks].sort((a, b) => {
      const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (aCreated !== bCreated) return aCreated - bCreated;
      return String(a.id).localeCompare(String(b.id));
    });
    
    // Assign positions sequentially based on creation order
    // Only assign to new tasks, keep existing positions
    allTasksByCreation.forEach((task, index) => {
      if (!positionMap.has(task.id)) {
        positionMap.set(task.id, index);
      }
    });
    
    // Remove deleted tasks from position map
    for (const [id] of positionMap) {
      if (!currentIds.has(id)) {
        positionMap.delete(id);
      }
    }
  }, [activeTasks]);

  
  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7243/ingest/13d600c1-3f34-4e60-b1d2-361a4f00b402',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TaskOverview.jsx:24',message:'Active tasks sorted order',data:{taskCount:activeTasks.length,taskOrder:activeTasks.map((t,i)=>({id:t.id,index:i,priority:t.priority,createdAt:t.createdAt,name:t.name}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  }, [activeTasks]);
  // #endregion

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
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/13d600c1-3f34-4e60-b1d2-361a4f00b402',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TaskOverview.jsx:53',message:'Task list changed - checking signature',data:{prevSignature:prevTaskIdsRef.current,newSignature:idsSignature,taskIds:activeTasks.map(t=>t.id),taskOrder:activeTasks.map((t,i)=>({id:t.id,index:i,priority:t.priority,createdAt:t.createdAt}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    if (idsSignature !== prevTaskIdsRef.current) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/13d600c1-3f34-4e60-b1d2-361a4f00b402',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TaskOverview.jsx:56',message:'Task signature changed - setting board updating',data:{prevSignature:prevTaskIdsRef.current,newSignature:idsSignature,addedTasks:activeTasks.filter(t=>!prevTaskIdsRef.current.includes(t.id)).map(t=>t.id),removedTasks:prevTaskIdsRef.current.split('|').filter(id=>!idsSignature.includes(id))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
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
        newlyAdded.push(task.id);
        seen.add(task.id);
      }
    }
    if (newlyAdded.length > 0) {
      setAnimatedTaskIds(new Set(newlyAdded));
      const timer = setTimeout(() => {
        setAnimatedTaskIds(new Set());
      }, 300);
      return () => clearTimeout(timer);
    }
    return undefined;
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
                <div className={`quest-scrolls-board${isBoardUpdating ? ' is-updating' : ''}`}>
                  {(() => {
                    // Sort tasks by their stable position index to prevent grid reflow
                    const tasksWithPositions = activeTasks.map(task => ({
                      task,
                      position: stablePositionMapRef.current.get(task.id) ?? Infinity
                    }));
                    tasksWithPositions.sort((a, b) => a.position - b.position);
                    return tasksWithPositions.map(({ task }, index) => {
                    // #region agent log
                    if (index === 0 || index === Math.floor(activeTasks.length / 2) || index === activeTasks.length - 1) {
                      fetch('http://127.0.0.1:7243/ingest/13d600c1-3f34-4e60-b1d2-361a4f00b402',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TaskOverview.jsx:140',message:'Rendering task in grid',data:{taskId:task.id,index,isAnimated:animatedTaskIds.has(task.id),isBoardUpdating,totalTasks:activeTasks.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                    }
                    // #endregion
                    return (
                    <div 
                      key={task.id} 
                      className={`quest-scroll-container${animatedTaskIds.has(task.id) ? ' quest-scroll-animate' : ''}`}
                      style={getTaskStyle(task.id)}
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
                            // #region agent log
                            fetch('http://127.0.0.1:7243/ingest/13d600c1-3f34-4e60-b1d2-361a4f00b402',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TaskOverview.jsx:193',message:'Deleting task',data:{deletedTaskId:task.id,currentTaskIds:gameState.tasks.filter(t=>!t.completed).map(t=>t.id),currentTaskCount:gameState.tasks.filter(t=>!t.completed).length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                            // #endregion
                            gameState.deleteTask(task.id);
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    );
                  });
                  })()}
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
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/13d600c1-3f34-4e60-b1d2-361a4f00b402',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TaskOverview.jsx:213',message:'Adding new task',data:{taskData,currentTaskIds:gameState.tasks.filter(t=>!t.completed).map(t=>t.id),currentTaskCount:gameState.tasks.filter(t=>!t.completed).length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          gameState.addTask(taskData);
          setIsModalOpen(false);
        }}
      />
    </div>
  );
}

export default TaskOverview;
