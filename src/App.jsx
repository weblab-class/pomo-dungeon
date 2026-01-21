import { useEffect, useRef, useState } from 'react';
import { SCREENS } from './data/constants';
import { useGameState } from './hooks/useGameState';
import { useLocalStorage } from './hooks/useLocalStorage';
import HomeScreen from './components/HomeScreen';
import TaskOverview from './components/TaskOverview';
import BattleScreen from './components/BattleScreen';
import CollectionsScreen from './components/CollectionsScreen';
import RecordsScreen from './components/RecordsScreen';
import { getApiBaseUrl, postJson } from './utils/api';
import './App.css';

function App() {
  const [currentScreen, setCurrentScreen] = useState(SCREENS.HOME);
  const [selectedTask, setSelectedTask] = useState(null);
  const gameState = useGameState();
  const [googleUser] = useLocalStorage('pomoDungeon_googleUser', null);
  const sessionIdRef = useRef(null);
  const sessionStartRef = useRef(null);

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

  const navigateTo = (screen, task = null) => {
    if (task) setSelectedTask(task);
    setCurrentScreen(screen);
  };

  const startTask = (task) => {
    const startedAt = new Date().toISOString();
    gameState.updateTask(task.id, { startedAt });
    setSelectedTask({ ...task, startedAt });
    setCurrentScreen(SCREENS.BATTLE);
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case SCREENS.HOME:
        return (
          <HomeScreen
            gameState={gameState}
            onNavigate={navigateTo}
          />
        );
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
            onExit={() => navigateTo(SCREENS.TASKS)}
            onComplete={() => navigateTo(SCREENS.TASKS)}
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
      default:
        return <HomeScreen gameState={gameState} onNavigate={navigateTo} />;
    }
  };

  return <div className="app">{renderScreen()}</div>;
}

export default App;
