import { useCallback, useEffect, useRef, useState } from 'react';
import { SCREENS, MODE } from './data/constants';
import { useGameState } from './hooks/useGameState';
import { useLocalStorage } from './hooks/useLocalStorage';
import HomeScreen from './components/HomeScreen';
import TaskOverview from './components/TaskOverview';
import BattleScreen from './components/BattleScreen';
import CollectionsScreen from './components/CollectionsScreen';
import RecordsScreen from './components/RecordsScreen';
import AvatarCustomizationScreen from './components/AvatarCustomizationScreen';
import { getApiBaseUrl, postJson } from './utils/api';
import './App.css';

const SCREEN_HASH = {
  [SCREENS.HOME]: '#/home',
  [SCREENS.TASKS]: '#/tasks',
  [SCREENS.BATTLE]: '#/battle',
  [SCREENS.COLLECTIONS]: '#/collections',
  [SCREENS.RECORDS]: '#/records',
  [SCREENS.CUSTOMIZE]: '#/customize',
};

const getScreenFromHash = (hash) => {
  const value = (hash || '').replace(/^#\/?/, '');
  switch (value.split('?')[0]) {
    case 'tasks':
      return SCREENS.TASKS;
    case 'battle':
      return SCREENS.BATTLE;
    case 'collections':
      return SCREENS.COLLECTIONS;
    case 'records':
      return SCREENS.RECORDS;
    case 'customize':
      return SCREENS.CUSTOMIZE;
    case 'home':
    default:
      return SCREENS.HOME;
  }
};

function App() {
  const [currentScreen, setCurrentScreen] = useState(SCREENS.HOME);
  const [selectedTask, setSelectedTask] = useState(null);
  const gameState = useGameState();
  const [googleUser] = useLocalStorage('pomoDungeon_googleUser', null);
  const sessionIdRef = useRef(null);
  const sessionStartRef = useRef(null);
  const pushHistory = useCallback((screen, task, { replace = false } = {}) => {
    const hash = SCREEN_HASH[screen] || SCREEN_HASH[SCREENS.HOME];
    const url = `${window.location.pathname}${window.location.search}${hash}`;
    const state = { screen };
    if (task) {
      state.task = task;
      if (task.id) state.taskId = task.id;
    }
    if (replace) {
      window.history.replaceState(state, '', url);
    } else {
      window.history.pushState(state, '', url);
    }
  }, []);

  useEffect(() => {
    const handleWheel = (event) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
      }
    };
    const handleKeyDown = (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (['+', '-', '=', '0'].includes(event.key)) {
        event.preventDefault();
      }
    };
    const handleGesture = (event) => {
      event.preventDefault();
    };

    document.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('gesturestart', handleGesture);
    document.addEventListener('gesturechange', handleGesture);
    document.addEventListener('gestureend', handleGesture);

    return () => {
      document.removeEventListener('wheel', handleWheel);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('gesturestart', handleGesture);
      document.removeEventListener('gesturechange', handleGesture);
      document.removeEventListener('gestureend', handleGesture);
    };
  }, []);

  useEffect(() => {
    const userId = googleUser?.sub || googleUser?.email;
    if (!userId) return undefined;
    let isActive = true;

    const startSession = async () => {
      try {
        await postJson('/api/users/upsert', {
          userId,
          email: googleUser.email,
          name: googleUser.name,
          picture: googleUser.picture,
        });
        const openedAt = new Date().toISOString();
        sessionStartRef.current = Date.now();
        const { sessionId } = await postJson('/api/sessions/start', { userId, openedAt });
        if (!isActive) return;
        sessionIdRef.current = sessionId;
      } catch (error) {
        // Silently ignore tracking failures
      }
    };

    const endSession = () => {
      if (!sessionIdRef.current || !sessionStartRef.current) return;
      const closedAt = new Date().toISOString();
      const durationSeconds = Math.max(
        0,
        Math.floor((Date.now() - sessionStartRef.current) / 1000)
      );
      const payload = {
        userId,
        sessionId: sessionIdRef.current,
        closedAt,
        durationSeconds,
      };

      const endpoint = `${getApiBaseUrl()}/api/sessions/end`;
      const body = JSON.stringify(payload);
      const blob = new Blob([body], { type: 'application/json' });
      const sent = navigator.sendBeacon ? navigator.sendBeacon(endpoint, blob) : false;
      if (!sent) {
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => {});
      }
      sessionIdRef.current = null;
      sessionStartRef.current = null;
    };

    startSession();
    window.addEventListener('beforeunload', endSession);

    return () => {
      isActive = false;
      window.removeEventListener('beforeunload', endSession);
      endSession();
    };
  }, [googleUser?.sub, googleUser?.email, googleUser?.name, googleUser?.picture]);

  useEffect(() => {
    const resolveTaskFromState = (state) => {
      if (state?.task) return state.task;
      if (state?.taskId) {
        return gameState.tasks.find((task) => task.id === state.taskId) || null;
      }
      return null;
    };

    const applyNavigationState = (state, hash, { replace = false } = {}) => {
      const screen = state?.screen || getScreenFromHash(hash);
      if (screen === SCREENS.BATTLE) {
        const task = resolveTaskFromState(state);
        if (!task) {
          setSelectedTask(null);
          setCurrentScreen(SCREENS.TASKS);
          pushHistory(SCREENS.TASKS, null, { replace: true });
          return;
        }
        setSelectedTask(task);
        setCurrentScreen(screen);
        if (replace) {
          pushHistory(screen, task, { replace: true });
        }
        return;
      }

      // Check if state has pomodoro flag for home screen
      const isPomodoroMode = screen === SCREENS.HOME && state?.task?.isPomodoro;
      setSelectedTask(null);
      setCurrentScreen(screen);
      if (replace) {
        pushHistory(screen, isPomodoroMode ? { isPomodoro: true } : null, { replace: true });
      }
    };

    const handlePopState = (event) => {
      applyNavigationState(event.state, window.location.hash);
    };

    const handleHashChange = () => {
      applyNavigationState(window.history.state, window.location.hash);
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handleHashChange);
    applyNavigationState(window.history.state, window.location.hash, { replace: true });
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [gameState.tasks, pushHistory]);

  const navigateTo = (screen, task = null, options = {}) => {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/13d600c1-3f34-4e60-b1d2-361a4f00b402',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.jsx:209',message:'navigateTo called',data:{screen,taskId:task?.id,taskName:task?.name,isPomodoro:task?.isPomodoro,hasTask:!!task,currentScreen,selectedTaskId:selectedTask?.id,selectedTaskIsPomodoro:selectedTask?.isPomodoro,options},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
    // #endregion
    if (screen === SCREENS.BATTLE && !task) return;
    // Check if we're navigating from a pomodoro battle before clearing selectedTask
    const isFromPomodoro = selectedTask?.isPomodoro && screen === SCREENS.HOME;
    if (task) {
      setSelectedTask(task);
    } else if (screen !== SCREENS.BATTLE) {
      setSelectedTask(null);
    }
    setCurrentScreen(screen);
    // Store pomodoro mode flag in history state if navigating to home from pomodoro
    const historyTask = isFromPomodoro ? { isPomodoro: true } : task;
    pushHistory(screen, historyTask);
  };

  const startTask = (task) => {
    const startedAt = new Date().toISOString();
    gameState.updateTask(task.id, { startedAt });
    const nextTask = { ...task, startedAt };
    setSelectedTask(nextTask);
    setCurrentScreen(SCREENS.BATTLE);
    pushHistory(SCREENS.BATTLE, nextTask);
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case SCREENS.HOME: {
        // Check history state for pomodoro flag
        const historyState = window.history.state;
        const isPomodoroMode = historyState?.task?.isPomodoro;
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/13d600c1-3f34-4e60-b1d2-361a4f00b402',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.jsx:231',message:'Rendering HomeScreen',data:{historyState,isPomodoroMode,willSetMode:isPomodoroMode?MODE.STOPWATCH:'default'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,E'})}).catch(()=>{});
        // #endregion
        return (
          <HomeScreen
            gameState={gameState}
            onNavigate={navigateTo}
            initialMode={isPomodoroMode ? MODE.STOPWATCH : undefined}
          />
        );
      }
      case SCREENS.TASKS:
        return (
          <TaskOverview
            gameState={gameState}
            onNavigate={navigateTo}
            onStartTask={startTask}
          />
        );
      case SCREENS.BATTLE:
        return (
          <BattleScreen
            task={selectedTask}
            gameState={gameState}
            onExit={() => {
              // #region agent log
              fetch('http://127.0.0.1:7243/ingest/13d600c1-3f34-4e60-b1d2-361a4f00b402',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.jsx:251',message:'BattleScreen onExit callback',data:{selectedTaskId:selectedTask?.id,selectedTaskName:selectedTask?.name,isPomodoro:selectedTask?.isPomodoro,willNavigateTo:selectedTask?.isPomodoro?'HOME':'TASKS'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
              // #endregion
              navigateTo(selectedTask?.isPomodoro ? SCREENS.HOME : SCREENS.TASKS);
            }}
            onComplete={() => {
              // #region agent log
              fetch('http://127.0.0.1:7243/ingest/13d600c1-3f34-4e60-b1d2-361a4f00b402',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.jsx:252',message:'BattleScreen onComplete callback',data:{selectedTaskId:selectedTask?.id,isPomodoro:selectedTask?.isPomodoro,willNavigateTo:selectedTask?.isPomodoro?'HOME':'TASKS'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
              // #endregion
              navigateTo(selectedTask?.isPomodoro ? SCREENS.HOME : SCREENS.TASKS);
            }}
          />
        );
      case SCREENS.COLLECTIONS:
        return (
          <CollectionsScreen
            gameState={gameState}
            onBack={() => navigateTo(SCREENS.HOME)}
          />
        );
      case SCREENS.RECORDS:
        return (
          <RecordsScreen
            onBack={() => navigateTo(SCREENS.HOME)}
          />
        );
      case SCREENS.CUSTOMIZE:
        return (
          <AvatarCustomizationScreen
            gameState={gameState}
            onBack={() => navigateTo(SCREENS.HOME)}
          />
        );
      default:
        return <HomeScreen gameState={gameState} onNavigate={navigateTo} />;
    }
  };

  return <div className="app">{renderScreen()}</div>;
}

export default App;
