import { useRef, useEffect, useState, useCallback } from 'react';
import { SCREENS, MODE, AVATARS, PRIORITY, getRandomDungeonRoom, getMonsterForPriority } from '../data/constants';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { getJson, postJson } from '../utils/api';
import AddTaskModal from './AddTaskModal';
import PomodoroModal from './PomodoroModal';
import homeScreenAudio from '../../audio/chill_homescreen.mp3';
import homeScreenRedAudio from '../../audio/the_night_before_battle.mp3';

const W = 320;
const H = 180;

function HomeScreen({ gameState, onNavigate }) {
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const audioSourceRef = useRef(homeScreenAudio);
  const fadeTimerRef = useRef(null);
  const [mode, setMode] = useState(MODE.TASKS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPomodoroModalOpen, setIsPomodoroModalOpen] = useState(false);
  const [pomodoroDefaults, setPomodoroDefaults] = useState({
    studyMinutes: 25,
    breakMinutes: 5,
  });
  const [pomodoroModalPurpose, setPomodoroModalPurpose] = useState('start');
  const [avatarSprite, setAvatarSprite] = useState(null);
  const [googleUser, setGoogleUser] = useLocalStorage('pomoDungeon_googleUser', null);
  const [streakDays] = useLocalStorage('pomoDungeon_streakDays', 0);
  const [musicEnabled, setMusicEnabled] = useLocalStorage('pomoDungeon_musicEnabled', true);
  const [musicVolume, setMusicVolume] = useLocalStorage('pomoDungeon_musicVolume', 0.35);
  const [authError, setAuthError] = useState('');
  const [showTutorial, setShowTutorial] = useState(
    () => !googleUser || localStorage.getItem('pomoDungeon_homeTutorialSeen') !== 'true'
  );
  const [tutorialStep, setTutorialStep] = useState(0);
  const maxTutorialStep = 3;
  const googleInitRef = useRef(false);
  const tokenClientRef = useRef(null);
  const [isAuthMenuOpen, setIsAuthMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFriendsOpen, setIsFriendsOpen] = useState(false);
  const [friendRequests, setFriendRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [friendUsername, setFriendUsername] = useState('');
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [activeFriendOptions, setActiveFriendOptions] = useState(null);
  const [friendActionLoading, setFriendActionLoading] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [friendSummary, setFriendSummary] = useState(null);
  const [loadingFriendSummary, setLoadingFriendSummary] = useState(false);
  const [onlineStatuses, setOnlineStatuses] = useState({});
  const authMenuRef = useRef(null);
  const settingsRef = useRef(null);
  const friendsRef = useRef(null);
  const musicEnabledRef = useRef(musicEnabled);
  const musicVolumeRef = useRef(musicVolume);
  const restartTutorial = useCallback(() => {
    setMode(MODE.TASKS);
    setTutorialStep(0);
    setShowTutorial(true);
  }, []);
  const dismissTutorial = () => {
    if (googleUser) {
      localStorage.setItem('pomoDungeon_homeTutorialSeen', 'true');
    }
    setShowTutorial(false);
  };

  // Normalize userId (email as lowercase)
  const normalizeUserId = (userId) => (userId || '').trim().toLowerCase();

  // Friends data fetching
  const fetchFriendRequests = async () => {
    if (!googleUser?.email) return;
    try {
      const userId = normalizeUserId(googleUser.email);
      const data = await getJson(`/api/friend-requests/${encodeURIComponent(userId)}`);
      setFriendRequests(data.requests || []);
    } catch (error) {
      console.error('Error fetching friend requests:', error);
    }
  };

  const fetchFriends = async () => {
    if (!googleUser?.email) return;
    try {
      const userId = normalizeUserId(googleUser.email);
      const data = await getJson(`/api/friends/${encodeURIComponent(userId)}`);
      setFriends(data.friends || []);
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  // Friends action handlers
  const handleSendFriendRequest = async (e) => {
    e.preventDefault();
    if (!friendUsername.trim()) {
      alert('Please enter a username');
      return;
    }

    try {
      setFriendActionLoading(true);
      const userId = normalizeUserId(googleUser.email);
      await postJson('/api/friend-requests', {
        userId,
        friendUsername: friendUsername.trim()
      });
      alert('Friend request sent!');
      setFriendUsername('');
      setShowAddFriend(false);
      fetchFriendRequests();
    } catch (error) {
      console.error('Error sending friend request:', error);
      alert(error.message || 'Failed to send friend request');
    } finally {
      setFriendActionLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      setFriendActionLoading(true);
      const userId = normalizeUserId(googleUser.email);
      await fetch(`/api/friend-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'accept' })
      });
      alert('Friend request accepted!');
      fetchFriendRequests();
      fetchFriends();
    } catch (error) {
      console.error('Error accepting request:', error);
      alert('Failed to accept friend request');
    } finally {
      setFriendActionLoading(false);
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      setFriendActionLoading(true);
      const userId = normalizeUserId(googleUser.email);
      await fetch(`/api/friend-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'reject' })
      });
      alert('Friend request rejected');
      fetchFriendRequests();
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert('Failed to reject friend request');
    } finally {
      setFriendActionLoading(false);
    }
  };

  const handleRemoveFriend = async (friendId, friendUsername) => {
    if (!confirm(`Remove ${friendUsername} from friends?`)) {
      return;
    }

    try {
      setFriendActionLoading(true);
      const userId = normalizeUserId(googleUser.email);
      await fetch('/api/friends', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, friendId })
      });
      alert('Friend removed');
      setActiveFriendOptions(null);
      fetchFriends();
    } catch (error) {
      console.error('Error removing friend:', error);
      alert('Failed to remove friend');
    } finally {
      setFriendActionLoading(false);
    }
  };

  const handleFriendClick = async (friend) => {
    if (loadingFriendSummary) return;
    
    try {
      setLoadingFriendSummary(true);
      setSelectedFriend(friend);
      
      const data = await getJson(`/api/users/summary/${encodeURIComponent(friend.id)}`);
      setFriendSummary(data);
    } catch (error) {
      console.error('Error fetching friend summary:', error);
      alert('Failed to load friend summary');
      setSelectedFriend(null);
    } finally {
      setLoadingFriendSummary(false);
    }
  };

  const closeFriendSummary = () => {
    setSelectedFriend(null);
    setFriendSummary(null);
  };

  // Fetch friends data when panel opens
  useEffect(() => {
    if (isFriendsOpen && googleUser) {
      fetchFriendRequests();
      fetchFriends();
    }
  }, [isFriendsOpen, googleUser]);

  // Username validation and creation
  const validateUsername = (username) => {
    if (username.length < 3) return 'Username must be at least 3 characters';
    if (username.length > 20) return 'Username must be 20 characters or less';
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return 'Username can only contain letters, numbers, and underscores';
    return null;
  };

  const checkUsernameAvailable = async (username) => {
    try {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/13d600c1-3f34-4e60-b1d2-361a4f00b402',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HomeScreen.jsx:checkUsername-entry',message:'Frontend check username',data:{username:username,encodedUsername:encodeURIComponent(username)},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
      const data = await getJson(`/api/users/check-username?username=${encodeURIComponent(username)}`);
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/13d600c1-3f34-4e60-b1d2-361a4f00b402',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HomeScreen.jsx:checkUsername-response',message:'API response received',data:{username:username,responseData:data,available:data.available,error:data.error},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
      if (typeof data?.available !== 'boolean') {
        const apiError = data?.error ? `: ${data.error}` : '';
        throw new Error(`Username check failed${apiError}`);
      }
      return data.available;
    } catch (error) {
      console.error('Error checking username:', error);
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/13d600c1-3f34-4e60-b1d2-361a4f00b402',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HomeScreen.jsx:checkUsername-error',message:'Check username error',data:{username:username,errorMessage:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'H5'})}).catch(()=>{});
      // #endregion
      throw error;
    }
  };

  const handleCreateUsername = async (e) => {
    if (e) e.preventDefault();
    
    const trimmedUsername = usernameInput.trim();
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/13d600c1-3f34-4e60-b1d2-361a4f00b402',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HomeScreen.jsx:handleCreate-entry',message:'Handle create username',data:{rawInput:usernameInput,trimmedUsername:trimmedUsername},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
    
    // Validate format
    const error = validateUsername(trimmedUsername);
    if (error) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/13d600c1-3f34-4e60-b1d2-361a4f00b402',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HomeScreen.jsx:handleCreate-validation-error',message:'Validation error',data:{trimmedUsername:trimmedUsername,validationError:error},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
      setUsernameError(error);
      return;
    }

    try {
      setIsCheckingUsername(true);
      setUsernameError('');
      
      // Check availability
      let available = false;
      try {
        available = await checkUsernameAvailable(trimmedUsername);
      } catch (checkError) {
        setUsernameError(checkError?.message || 'Could not check username. Is the server running?');
        setIsCheckingUsername(false);
        return;
      }
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/13d600c1-3f34-4e60-b1d2-361a4f00b402',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HomeScreen.jsx:handleCreate-availability',message:'Availability check result',data:{trimmedUsername:trimmedUsername,available:available,willShowError:!available},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      if (!available) {
        setUsernameError('Username already taken. Please choose another.');
        setIsCheckingUsername(false);
        return;
      }
      
      // Set username
      const userId = normalizeUserId(googleUser.email);
      await postJson('/api/users/set-username', {
        userId,
        username: trimmedUsername
      });
      
      // Update local state
      setGoogleUser({...googleUser, username: trimmedUsername});
      setShowUsernameModal(false);
      setUsernameInput('');
      setUsernameError('');
      // Show tutorial after username creation
      setShowTutorial(true);
      setTutorialStep(0);
      alert('Username created successfully!');
    } catch (error) {
      console.error('Error creating username:', error);
      setUsernameError(error.message || 'Failed to create username');
    } finally {
      setIsCheckingUsername(false);
    }
  };

  // Show username modal if user doesn't have username
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/13d600c1-3f34-4e60-b1d2-361a4f00b402',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HomeScreen.jsx:username-modal-check',message:'Checking if username modal should show',data:{hasGoogleUser:!!googleUser,googleUserEmail:googleUser?.email,hasUsername:!!googleUser?.username,username:googleUser?.username,willShowModal:!!(googleUser && !googleUser.username)},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'USERNAME_PERSIST'})}).catch(()=>{});
    // #endregion
    if (googleUser && !googleUser.username) {
      setShowUsernameModal(true);
      // Hide tutorial while username modal is shown
      setShowTutorial(false);
    }
  }, [googleUser]);

  // Initialize socket connection and fetch friends when user logs in
  useEffect(() => {
    if (!googleUser?.email) return;

    // Fetch friends and friend requests
    fetchFriends();
    fetchFriendRequests();

    // Only initialize socket in development (where we have the socket server)
    if (import.meta.env.DEV) {
      import('../utils/socket.js')
        .then(({ initSocket, disconnectSocket, onUserStatusChange }) => {
          const userId = normalizeUserId(googleUser.email);
          initSocket(userId);
          
          // Listen for friend status changes
          const unsubscribe = onUserStatusChange((data) => {
            setOnlineStatuses(prev => ({
              ...prev,
              [data.userId]: {
                isOnline: data.isOnline,
                lastSeen: data.lastSeen
              }
            }));
          });

          return () => {
            unsubscribe();
            disconnectSocket();
          };
        })
        .catch(err => console.log('Socket connection not available:', err));
    }
  }, [googleUser]);

  useEffect(() => {
    if (!googleUser) {
      setShowTutorial(true);
      return;
    }
    // Only show tutorial if user has username and hasn't seen it
    if (googleUser.username) {
      setShowTutorial(localStorage.getItem('pomoDungeon_homeTutorialSeen') !== 'true');
    }
  }, [googleUser]);

  useEffect(() => {
    if (showTutorial) {
      setTutorialStep(0);
    }
  }, [showTutorial]);

  useEffect(() => {
    const initialSource = mode === MODE.STOPWATCH ? homeScreenRedAudio : homeScreenAudio;
    const audio = new Audio(initialSource);
    audio.loop = true;
    audio.volume = Math.max(0, Math.min(1, musicVolumeRef.current));
    audio.preload = 'auto';
    audioSourceRef.current = initialSource;
    audio.src = initialSource;
    audioRef.current = audio;

    const attemptPlay = () => {
      if (!audioRef.current || !musicEnabledRef.current || showTutorial) return;
      audioRef.current.play().catch(() => {});
    };

    if (musicEnabledRef.current && !showTutorial) attemptPlay();
    window.addEventListener('pointerdown', attemptPlay, { once: true });
    window.addEventListener('keydown', attemptPlay, { once: true });

    return () => {
      window.removeEventListener('pointerdown', attemptPlay);
      window.removeEventListener('keydown', attemptPlay);
      if (fadeTimerRef.current) {
        clearInterval(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
    };
  }, [showTutorial]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextSource = mode === MODE.STOPWATCH ? homeScreenRedAudio : homeScreenAudio;
    if (audioSourceRef.current !== nextSource) {
      audioSourceRef.current = nextSource;
      const targetVolume = Math.max(0, Math.min(1, musicVolumeRef.current));
      if (fadeTimerRef.current) {
        clearInterval(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }

      const fadeDuration = 500;
      const stepMs = 50;
      const steps = Math.max(1, Math.round(fadeDuration / stepMs));
      const startVolume = audio.volume;
      let step = 0;

      fadeTimerRef.current = setInterval(() => {
        step += 1;
        const progress = step / steps;
        audio.volume = startVolume * (1 - progress);

        if (progress >= 1) {
          clearInterval(fadeTimerRef.current);
          fadeTimerRef.current = null;
          audio.pause();
          audio.currentTime = 0;
          audio.src = nextSource;
          audio.load();
          if (musicEnabledRef.current) {
            audio.play().catch(() => {});
          }

          let fadeInStep = 0;
          fadeTimerRef.current = setInterval(() => {
            fadeInStep += 1;
            const inProgress = fadeInStep / steps;
            audio.volume = targetVolume * inProgress;
            if (inProgress >= 1) {
              clearInterval(fadeTimerRef.current);
              fadeTimerRef.current = null;
              audio.volume = targetVolume;
            }
          }, stepMs);
        }
      }, stepMs);
    }
  }, [mode]);

  useEffect(() => {
    musicEnabledRef.current = musicEnabled;
  }, [musicEnabled]);

  useEffect(() => {
    musicVolumeRef.current = musicVolume;
  }, [musicVolume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (showTutorial) {
      audio.pause();
      audio.currentTime = 0;
      return;
    }
    audio.volume = Math.max(0, Math.min(1, musicVolume));
    if (musicEnabled) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [musicEnabled, musicVolume, showTutorial]);
  const getGoogleAuthHint = () => {
    const { protocol, hostname } = window.location;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    if (protocol !== 'https:' && !isLocalhost) {
      return 'Google sign-in requires HTTPS (or localhost). Use HTTPS or a tunnel and add this origin in Google Cloud.';
    }
    return 'Make sure this origin is listed under Authorized JavaScript origins in Google Cloud.';
  };
  
  // Gate state
  const gateRef = useRef({
    x: Math.floor(W / 2) - 38,
    y: 66,
    w: 76,
    h: 74,
    hover: false,
    openT: 0,
    opening: false,
  });
  
  // Avatar state
  const avatarRef = useRef({
    x: 45,
    y: 95,
    w: 50,
    h: 60,
    hover: false,
  });
  
  // Moon state
  const moonRef = useRef({ x: 256, y: 42, r: 30 });
  
  // Mist particles
  const mistRef = useRef([]);
  
  // Rain particles
  const rainRef = useRef([]);
  
  // Lightning state for red moon
  const lightningRef = useRef({ t: 0, cooldown: 0, bolt: [], intensity: 0 });
  
  // Bat state
  const batsRef = useRef([]);
  const batSpawnRef = useRef({ nextTime: 2 });

  // Animation time
  const timeRef = useRef(0);
  
  // Track previous mode to reset doors when switching
  const prevModeRef = useRef(mode);

  // Load avatar sprite
  useEffect(() => {
    const avatar = AVATARS[gameState.player.currentAvatar] || AVATARS.knight_1;
    const img = new Image();
    const homeBasePath = avatar.homeBasePath || avatar.basePath;
    img.src = `${homeBasePath}/Idle.png`;
    img.onload = () => setAvatarSprite(img);
  }, [gameState.player.currentAvatar]);

  const parseJwt = (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      return null;
    }
  };

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    let attempts = 0;
    const maxAttempts = 20;

    const initGoogle = () => {
      if (googleInitRef.current) return;
      if (!window.google?.accounts?.oauth2) return;
      googleInitRef.current = true;
    };

    const tryInit = () => {
      attempts += 1;
      initGoogle();
      if (!googleInitRef.current && attempts < maxAttempts) {
        setTimeout(tryInit, 200);
      }
    };

    tryInit();
  }, []);

  const handleGoogleSignIn = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setAuthError('Missing Google client ID.');
      return;
    }
    if (!window.google?.accounts?.oauth2) {
      setAuthError('Google sign-in not ready yet.');
      return;
    }
    setAuthError('');

    if (googleUser?.email && window.google?.accounts?.oauth2?.revoke) {
      window.google.accounts.oauth2.revoke(googleUser.email, () => {});
    }
    setGoogleUser(null);
    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'profile email',
      callback: async (tokenResponse) => {
        if (!tokenResponse?.access_token) {
          setAuthError('Google sign-in failed. Try again.');
          return;
        }
        try {
          const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
          });
          if (!res.ok) throw new Error('Failed to fetch profile');
          const data = await res.json();
          setAuthError('');
          
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/13d600c1-3f34-4e60-b1d2-361a4f00b402',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HomeScreen.jsx:oauth-callback',message:'Google OAuth success',data:{email:data.email,name:data.name},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'USERNAME_PERSIST'})}).catch(()=>{});
          // #endregion
          
          // Upsert user in MongoDB and fetch existing username
          try {
            const userId = normalizeUserId(data.email);
            const upsertRes = await postJson('/api/users/upsert', {
              userId,
              email: data.email,
              name: data.name,
              picture: data.picture
            });
            
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/13d600c1-3f34-4e60-b1d2-361a4f00b402',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HomeScreen.jsx:upsert-success',message:'User upserted in MongoDB',data:{userId:userId?.substring(0,20),hasUsername:!!upsertRes?.user?.username,username:upsertRes?.user?.username},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'USERNAME_PERSIST'})}).catch(()=>{});
            // #endregion
            
            setGoogleUser({
              name: data.name,
              email: data.email,
              picture: data.picture,
              sub: data.sub,
              username: upsertRes?.user?.username || null, // Include username from DB
            });
          } catch (dbError) {
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/13d600c1-3f34-4e60-b1d2-361a4f00b402',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HomeScreen.jsx:upsert-error',message:'Failed to upsert user',data:{error:dbError.message},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'USERNAME_PERSIST'})}).catch(()=>{});
            // #endregion
            console.error('Failed to upsert user in MongoDB:', dbError);
            // Still set googleUser with OAuth data even if DB call fails
            setGoogleUser({
              name: data.name,
              email: data.email,
              picture: data.picture,
              sub: data.sub,
            });
          }
        } catch (error) {
          setAuthError('Could not load Google profile.');
        }
      },
      error_callback: (error) => {
        const errorType = error?.type || error?.error || 'unknown';
        setAuthError(`Google sign-in error (${errorType}). ${getGoogleAuthHint()}`);
      },
    });

    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
    tokenClientRef.current.requestAccessToken({ prompt: 'consent select_account' });
  };

  const handleGoogleSignOut = () => {
    if (googleUser?.email && window.google?.accounts?.oauth2?.revoke) {
      window.google.accounts.oauth2.revoke(googleUser.email, () => {});
    }
    setGoogleUser(null);
    setAuthError('');
    setIsAuthMenuOpen(false);
    localStorage.removeItem('pomoDungeon_player');
    localStorage.removeItem('pomoDungeon_tasks');
    localStorage.removeItem('pomoDungeon_googleUser');
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
    window.location.reload();
  };

  useEffect(() => {
    if (!isAuthMenuOpen) return;

    const handleOutsideClick = (event) => {
      if (!authMenuRef.current) return;
      if (!authMenuRef.current.contains(event.target)) {
        setIsAuthMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsAuthMenuOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isAuthMenuOpen]);

  useEffect(() => {
    if (!isSettingsOpen) return;

    const handleOutsideClick = (event) => {
      if (!settingsRef.current) return;
      if (!settingsRef.current.contains(event.target)) {
        setIsSettingsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsSettingsOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isSettingsOpen]);

  useEffect(() => {
    if (!isFriendsOpen) return;

    const handleOutsideClick = (event) => {
      if (!friendsRef.current) return;
      if (!friendsRef.current.contains(event.target)) {
        setIsFriendsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsFriendsOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isFriendsOpen]);

  // Initialize rain
  useEffect(() => {
    rainRef.current = Array.from({ length: 120 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vy: 140 + Math.random() * 80,
      len: 6 + Math.floor(Math.random() * 5),
    }));
  }, []);

  // Reset doors when mode changes (e.g., blue moon with open door -> red moon should close)
  useEffect(() => {
    if (prevModeRef.current !== mode) {
      const gate = gateRef.current;
      gate.openT = 0;
      gate.opening = false;
      gate.hover = false;
      prevModeRef.current = mode;
      setIsPomodoroModalOpen(false);
    }
  }, [mode]);

  // Helper functions
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
  const groundY = 132;

  const doorRect = useCallback(() => {
    const gate = gateRef.current;
    return { x: gate.x + 10, y: gate.y + 16, w: gate.w - 20, h: gate.h - 14 };
  }, []);

  // Spawn mist
  const spawnMist = useCallback((force = false) => {
    const mist = mistRef.current;
    if (mist.length >= 42 && !force) return;

    const gate = gateRef.current;
    const d = doorRect();
    const openEase = easeOutCubic(gate.openT);
    const seamX = d.x + d.w / 2 + rand(-3, 3);
    const thresholdY = d.y + d.h - 4;

    const x = openEase < 0.25 ? seamX + rand(-6, 6) : rand(d.x + 8, d.x + d.w - 8);
    const y = openEase < 0.25 ? thresholdY + rand(-3, 2) : rand(d.y + d.h - 14, d.y + d.h - 5);
    const outward = x < gate.x + gate.w / 2 ? -1 : 1;

    mist.push({
      x, y,
      vx: rand(6, 16) * outward + rand(-4, 4),
      vy: rand(-18, -8),
      life: rand(0.9, 1.6),
      maxLife: rand(0.9, 1.6),
      size: randi(2, 4),
      seed: Math.random() * 10,
    });

    if (mist.length > 42) mist.splice(0, mist.length - 42);
  }, [doorRect]);

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    
    let animationId;
    let lastTime = performance.now();

    const pxRect = (x, y, w, h, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
    };

    const pxDot = (x, y, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(x | 0, y | 0, 1, 1);
    };

    const drawMoon = (time) => {
      const isRed = mode === MODE.STOPWATCH;
      const moon = moonRef.current;

      ctx.globalAlpha = 0.95;
      ctx.fillStyle = isRed ? '#6b0d1a' : '#1e2b64';
      ctx.beginPath();
      ctx.arc(moon.x, moon.y, 26, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = isRed ? 0.35 : 0.25;
      ctx.fillStyle = isRed ? '#ff2b4a' : '#3a4fb8';
      ctx.beginPath();
      ctx.arc(moon.x, moon.y, 34, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
    };

    const drawBackground = () => {
      pxRect(0, 0, W, H, mode === MODE.STOPWATCH ? '#070b14' : '#0b1020');
      drawMoon(timeRef.current);

      // Static hills
      const hillCol = mode === MODE.STOPWATCH ? '#0d132b' : '#121a3a';
      pxRect(0, 72, W, 50, hillCol);
      for (let x = 0; x < W; x += 3) {
        const h = 10 + ((x * 7) % 18);
        pxRect(x, 72 - h, 3, h, hillCol);
      }

      // Static trees
      for (let x = 0; x < W; x += 10) {
        const trunkH = 18 + ((x * 13) % 14);
        pxRect(x, 92, 2, trunkH, '#1a2320');
        pxRect(x - 4, 86, 10, 8, '#172a22');
        pxRect(x - 2, 82, 6, 6, '#172a22');
      }

      // Ground
      pxRect(0, 132, W, 48, '#141813');

      // Mound
      const hillX = Math.floor(W / 2) - 72;
      pxRect(hillX, 118, 144, 20, '#121611');
      for (let x = hillX; x < hillX + 144; x++) {
        const h = 8 + Math.floor(6 * Math.sin(((x - hillX) / 144) * Math.PI));
        pxRect(x, 118 - h, 1, h, '#121611');
      }

      // Grass
      for (let i = 0; i < 220; i++) {
        const x = (i * 17) % W;
        const y = 132 + ((i * 29) % 16);
        pxDot(x, y, i % 3 === 0 ? '#1d2b1b' : '#1a2417');
      }
    };

    const drawAmbience = (time) => {
      if (mode !== MODE.TASKS) return;
      for (let i = 0; i < 16; i++) {
        const x = (i * 37 + Math.floor(time * 20)) % W;
        const y = 70 + ((i * 19) % 60);
        const tw = 0.35 + 0.65 * Math.sin(time * 3 + i);
        ctx.globalAlpha = 0.2 + 0.2 * tw;
        pxRect(x, y, 1, 1, '#b7ffd6');
      }
      ctx.globalAlpha = 1;
    };

    const spawnBat = (time) => {
      if (batsRef.current.length >= 5) return;
      const w = randi(12, 16);
      const h = randi(5, 7);
      const fromLeft = Math.random() < 0.5;
      const baseY = rand(18, 50);
      const amp = rand(2, 8);
      const phase = rand(0, Math.PI * 2);
      const speed = rand(24, 52);
      const waveSpeed = rand(1.4, 2.2);

      batsRef.current.push({
        x: fromLeft ? -w - rand(6, 18) : W + rand(6, 18),
        y: baseY,
        baseY,
        amp,
        phase,
        waveSpeed,
        vy: rand(-10, 10),
        w,
        h,
        vx: fromLeft ? speed : -speed,
        state: 'flying',
        landedT: 0,
      });

      batSpawnRef.current.nextTime = time + rand(1.6, 4.2);
    };

    const updateBats = (dt, time) => {
      if (time >= batSpawnRef.current.nextTime) {
        spawnBat(time);
      }

      const bats = batsRef.current;
      for (let i = bats.length - 1; i >= 0; i--) {
        const bat = bats[i];
        if (bat.state === 'flying') {
          bat.x += bat.vx * dt;
          bat.phase += dt * bat.waveSpeed;
          bat.y = bat.baseY + Math.sin(bat.phase) * bat.amp;
          bat.baseY = clamp(bat.baseY + bat.vy * dt, 16, 54);
          if (bat.x < -bat.w - 12 || bat.x > W + bat.w + 12) {
            bats.splice(i, 1);
          }
        } else if (bat.state === 'falling') {
          bat.y += 120 * dt;
          bat.x += bat.vx * 0.18 * dt;
          if (bat.y >= groundY - bat.h) {
            bat.y = groundY - bat.h;
            bat.state = 'landed';
            bat.landedT = rand(1.2, 2.6);
          }
        } else if (bat.state === 'landed') {
          bat.landedT -= dt;
          if (bat.landedT <= 0) {
            bats.splice(i, 1);
          }
        }
      }
    };

    const drawBat = (bat, time) => {
      if (bat.state === 'landed') {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(bat.x + bat.w / 2, bat.y + bat.h + 2, 6, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      const flap = bat.state === 'flying' ? Math.sin(time * 14 + bat.phase) : 0.1;
      const wingLift = Math.floor(1 + 2 * Math.max(0, flap));
      const baseY = bat.y + 2;
      const color = mode === MODE.STOPWATCH ? '#5b2f36' : '#2f394d';
      const midX = bat.x + Math.floor(bat.w / 2);

      // Body + head
      pxRect(midX - 2, baseY, 4, 2, color);
      pxRect(midX - 1, baseY - 1, 2, 1, color);

      // Wings (bat-like with scalloped edges)
      const wingY = baseY - wingLift;
      pxRect(bat.x, wingY, 5, 1, color);
      pxRect(bat.x + bat.w - 5, wingY, 5, 1, color);
      pxRect(bat.x + 2, wingY + 1, 3, 1, color);
      pxRect(bat.x + bat.w - 5, wingY + 1, 3, 1, color);
      pxRect(bat.x + 4, wingY + 2, 2, 1, color);
      pxRect(bat.x + bat.w - 6, wingY + 2, 2, 1, color);
      pxRect(midX - 1, wingY + 1, 2, 1, color);
    };

    const drawBats = (time) => {
      for (const bat of batsRef.current) {
        drawBat(bat, time);
      }
    };

    const drawTorch = (tx, ty, time, intensity, lit) => {
      pxRect(tx, ty + 10, 3, 20, '#1c1f26');
      pxRect(tx - 2, ty + 16, 7, 2, '#242a38');
      pxRect(tx - 1, ty + 18, 5, 2, '#1c1f26');
      pxRect(tx - 1, ty + 6, 5, 6, '#242a38');
      pxRect(tx, ty + 7, 3, 4, '#2e3444');

      if (!lit) return;

      const flick = 0.6 + 0.4 * Math.sin(time * 14 + tx * 0.03);
      const hot = clamp(intensity * (0.75 + 0.25 * flick), 0, 1);

      if (hot > 0.05) {
        ctx.globalAlpha = 0.08 + 0.16 * hot;
        ctx.fillStyle = '#ffd7a1';
        ctx.beginPath();
        ctx.ellipse(tx + 1, ty + 4, 10, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      const baseH = 6 + Math.floor(4 * flick);
      const flameH = Math.floor(baseH * (0.7 + 0.6 * hot));
      for (let y = 0; y < flameH; y++) {
        const w = 1 + Math.max(0, 2 - Math.floor(y / 2));
        const xoff = y % 2 === 0 ? 0 : 1;
        pxRect(tx - w + xoff + 2, ty + 6 - y, w * 2 - 1, 1, '#ffb85a');
      }
    };

    const drawPlayerAvatar = () => {
      if (!avatarSprite) return;
      const avatar = avatarRef.current;
      const time = timeRef.current;

      const spriteW = avatarSprite.width / 4;
      const spriteH = avatarSprite.height;

      // Hover glow
      if (avatar.hover) {
        ctx.globalAlpha = 0.15 + 0.1 * Math.sin(time * 5);
        ctx.fillStyle = '#64ffb6';
        ctx.beginPath();
        ctx.ellipse(avatar.x + avatar.w / 2, avatar.y + avatar.h - 5, 30, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Shadow
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(avatar.x + avatar.w / 2, avatar.y + avatar.h + 2, 18, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Sprite (first frame)
      ctx.drawImage(avatarSprite, 0, 0, spriteW, spriteH, avatar.x, avatar.y, avatar.w, avatar.h);
    };

    const drawDungeonGate = (time) => {
      const gate = gateRef.current;
      const interactive = gate.hover || gate.opening || gate.openT > 0;
      const openEase = easeOutCubic(gate.openT);
      const hoverPulse = 0.6 + 0.4 * Math.sin(time * 7);
      const idlePulse = mode === MODE.TASKS ? 0.35 + 0.25 * Math.sin(time * 2.2) : 0;
      const d = doorRect();
      const doorSlide = Math.floor(openEase * 18);

      // Outer glow (narrower oval)
      if (interactive || idlePulse > 0) {
        ctx.globalAlpha = 0.05 + 0.08 * hoverPulse + 0.1 * openEase + idlePulse * 0.08;
        ctx.fillStyle = mode === MODE.STOPWATCH ? '#ff2b4a' : '#7cffc8';
        ctx.beginPath();
        ctx.ellipse(gate.x + gate.w / 2, gate.y + gate.h * 0.62, 38, 28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Stone frame
      pxRect(gate.x - 8, gate.y - 6, gate.w + 16, gate.h + 12, '#232836');
      pxRect(gate.x - 6, gate.y - 4, gate.w + 12, gate.h + 8, '#1e2330');

      // Columns
      pxRect(gate.x - 10, gate.y + 16, 10, gate.h + 2, '#1b202b');
      pxRect(gate.x + gate.w, gate.y + 16, 10, gate.h + 2, '#1b202b');
      pxRect(gate.x - 9, gate.y + 17, 8, gate.h, '#242a38');
      pxRect(gate.x + gate.w + 1, gate.y + 17, 8, gate.h, '#242a38');

      // Arch
      for (let x = -2; x < gate.w + 2; x++) {
        const curve = Math.floor(7 * Math.sin(((x + 2) / (gate.w + 4)) * Math.PI));
        pxDot(gate.x + x, gate.y + 14 - curve, '#2a3040');
      }

      // Doorway interior
      pxRect(d.x, d.y, d.w, d.h, '#07080c');

      // Inner glow
      if (interactive) {
        const depthBoost = 0.25 + 0.75 * openEase;
        ctx.fillStyle = mode === MODE.STOPWATCH ? '#ff2b4a' : '#64ffb6';
        for (let i = 0; i < 7; i++) {
          const inset = i + 1;
          ctx.globalAlpha = (0.01 + i * 0.006) * depthBoost;
          ctx.fillRect(d.x + inset, d.y + inset, d.w - inset * 2, d.h - inset * 2);
        }
        ctx.globalAlpha = 1;
      }

      // Doors
      const doorY = d.y + 6;
      const doorH = d.h - 12;
      const doorVisible = openEase < 0.995;

      if (doorVisible) {
        const leftDoor = { x: d.x + 2 - doorSlide, y: doorY, w: Math.floor(d.w / 2) - 2, h: doorH };
        const rightDoor = { x: d.x + Math.floor(d.w / 2) + doorSlide, y: doorY, w: Math.floor(d.w / 2) - 2, h: doorH };

        pxRect(leftDoor.x, leftDoor.y, leftDoor.w, leftDoor.h, '#3a2f26');
        pxRect(rightDoor.x, rightDoor.y, rightDoor.w, rightDoor.h, '#3a2f26');
        pxRect(leftDoor.x + 1, leftDoor.y + 1, leftDoor.w - 2, leftDoor.h - 2, '#342a22');
        pxRect(rightDoor.x + 1, rightDoor.y + 1, rightDoor.w - 2, rightDoor.h - 2, '#342a22');
      }

      // Shadow
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(gate.x + gate.w / 2, gate.y + gate.h + 10, 44, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    };

    const updateMist = (dt, time) => {
      const mist = mistRef.current;
      const gate = gateRef.current;
      const interactive = gate.hover || gate.opening || gate.openT > 0;
      const rate = interactive ? 12 : 2;

      if (Math.random() < dt * rate) spawnMist();

      for (let i = mist.length - 1; i >= 0; i--) {
        const p = mist[i];
        p.life -= dt;
        if (p.life <= 0) {
          mist.splice(i, 1);
          continue;
        }
        const sway = Math.sin(time * 2 + p.seed) * 10;
        p.x += (p.vx + sway * 0.15) * dt;
        p.y += p.vy * dt;
        p.vx *= 1 - 0.15 * dt;
        p.vy *= 1 - 0.05 * dt;
      }
    };

    const drawMist = (time) => {
      const mist = mistRef.current;
      const gate = gateRef.current;
      const magical = gate.hover || gate.opening || gate.openT > 0;

      for (const p of mist) {
        const a = clamp(p.life / p.maxLife, 0, 1);
        const alpha = 0.18 * a * (0.6 + 0.4 * Math.sin(time * 3 + p.seed));
        ctx.globalAlpha = alpha;
        pxRect(p.x, p.y, p.size, 1, magical ? '#b7ffd6' : '#aeb6c4');
      }
      ctx.globalAlpha = 1;
    };

    const updateRain = (dt) => {
      for (const d of rainRef.current) {
        d.y += d.vy * dt;
        d.x += 18 * dt;
        if (d.y > H) {
          d.y = rand(-20, -2);
          d.x = rand(0, W);
        }
        if (d.x > W) d.x -= W;
      }
    };

    const drawRain = () => {
      ctx.globalAlpha = 0.25;
      for (const d of rainRef.current) {
        for (let i = 0; i < d.len; i += 2) {
          pxRect(d.x + i * 0.2, d.y + i, 1, 2, '#a9b7d6');
        }
      }
      ctx.globalAlpha = 1;
    };

    // Lightning functions for red moon mode
    const triggerLightning = () => {
      const lightning = lightningRef.current;
      lightning.t = rand(0.1, 0.18);
      lightning.intensity = rand(0.6, 1.0);
      lightning.cooldown = rand(1.6, 3.6);

      lightning.bolt = [];
      let x = rand(W * 0.15, W * 0.85);
      let y = 0;
      lightning.bolt.push({ x, y });

      const steps = randi(6, 10);
      for (let i = 0; i < steps; i++) {
        x += rand(-20, 20);
        y += rand(14, 22);
        lightning.bolt.push({ x: clamp(x, 0, W), y: clamp(y, 0, H) });
        if (y > 110 && Math.random() < 0.35) break;
      }
    };

    const updateLightning = (dt) => {
      const lightning = lightningRef.current;
      if (lightning.cooldown > 0) lightning.cooldown -= dt;

      if (lightning.t > 0) {
        lightning.t -= dt;
        if (lightning.t <= 0) lightning.t = 0;
        return;
      }

      if (lightning.cooldown <= 0 && Math.random() < 0.02) {
        triggerLightning();
      }
    };

    const drawLightning = () => {
      const lightning = lightningRef.current;
      if (lightning.t <= 0) return;

      const a = clamp(lightning.t / 0.18, 0, 1);
      const flash = lightning.intensity * (0.35 + 0.65 * a);

      // Screen flash
      ctx.globalAlpha = 0.3 * flash;
      pxRect(0, 0, W, H, '#ffffff');
      ctx.globalAlpha = 1;

      // Lightning bolt
      ctx.globalAlpha = 0.85 * flash;
      for (let i = 0; i < lightning.bolt.length - 1; i++) {
        const p0 = lightning.bolt[i];
        const p1 = lightning.bolt[i + 1];
        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        const steps = Math.max(1, Math.floor(Math.max(Math.abs(dx), Math.abs(dy)) / 3));
        for (let s = 0; s <= steps; s++) {
          const lx = p0.x + (dx * s) / steps;
          const ly = p0.y + (dy * s) / steps;
          pxRect(lx, ly, 2, 2, '#ffffff');
        }
      }
      ctx.globalAlpha = 1;
    };

    const render = (now) => {
      const dt = Math.min(0.033, (now - lastTime) / 1000);
      lastTime = now;
      timeRef.current += dt;
      const time = timeRef.current;
      const gate = gateRef.current;

      drawBackground();
      drawAmbience(time);
      updateBats(dt, time);
      drawBats(time);
      drawPlayerAvatar();

      const torchesLit = mode === MODE.TASKS;
      const torchIntensity = clamp(
        0.25 + (gate.hover ? 0.55 : 0) + (gate.opening ? 0.45 : 0) + gate.openT * 0.25,
        0, 1
      );

      drawTorch(gate.x - 18, gate.y + 18, time, torchIntensity, torchesLit);
      drawTorch(gate.x + gate.w + 16, gate.y + 18, time, torchIntensity, torchesLit);

      drawDungeonGate(time);
      updateMist(dt, time);
      drawMist(time);

      if (mode === MODE.STOPWATCH) {
        updateRain(dt);
        drawRain();
        updateLightning(dt);
        drawLightning();
      }

      // Gate opening animation
      if (gate.opening) {
        gate.openT = clamp(gate.openT + dt * 0.9, 0, 1);
        if (gate.openT >= 1) {
          gate.opening = false;
          gate.hover = false;
        }
      }

      // Vignette
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, W, 6);
      ctx.fillRect(0, H - 6, W, 6);
      ctx.globalAlpha = 1;

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationId);
  }, [mode, avatarSprite, doorRect, spawnMist]);

  // Mouse handlers
  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const gate = gateRef.current;
    const avatar = avatarRef.current;
    const moon = moonRef.current;
    const bats = batsRef.current;

    const overMoon = Math.hypot(mx - moon.x, my - moon.y) <= moon.r;
    const overAvatar = mx >= avatar.x && mx <= avatar.x + avatar.w && my >= avatar.y && my <= avatar.y + avatar.h;
    const overGate = mx >= gate.x && mx <= gate.x + gate.w && my >= gate.y && my <= gate.y + gate.h;
    const batHitPad = 6;
    const overBird = bats.some(
      (bat) =>
        bat.state === 'flying' &&
        mx >= bat.x - batHitPad &&
        mx <= bat.x + bat.w + batHitPad &&
        my >= bat.y - batHitPad &&
        my <= bat.y + bat.h + batHitPad
    );

    gate.hover = overGate && !gate.opening;
    avatar.hover = overAvatar;

    canvas.style.cursor = overMoon || gate.hover || overAvatar || overBird ? 'pointer' : 'default';
  };

  const handleClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const gate = gateRef.current;
    const avatar = avatarRef.current;
    const moon = moonRef.current;
    const bats = batsRef.current;
    const d = doorRect();

    // Bird click -> Drop to ground
    const batHitPad = 6;
    for (const bat of bats) {
      if (
        bat.state === 'flying' &&
        mx >= bat.x - batHitPad &&
        mx <= bat.x + bat.w + batHitPad &&
        my >= bat.y - batHitPad &&
        my <= bat.y + bat.h + batHitPad
      ) {
        bat.state = 'falling';
        return;
      }
    }

    // Avatar click -> Customize knight
    if (mx >= avatar.x && mx <= avatar.x + avatar.w && my >= avatar.y && my <= avatar.y + avatar.h) {
      onNavigate(SCREENS.CUSTOMIZE);
      return;
    }

    // Moon click -> Toggle mode
    if (Math.hypot(mx - moon.x, my - moon.y) <= moon.r) {
      setMode((prev) => (prev === MODE.TASKS ? MODE.STOPWATCH : MODE.TASKS));
      return;
    }

    // Open dungeon click -> Tasks (blue moon) or Pomodoro (red moon)
    if (gate.openT >= 0.5 && mx >= d.x && mx <= d.x + d.w && my >= d.y && my <= d.y + d.h) {
      if (mode === MODE.STOPWATCH) {
        setPomodoroModalPurpose('start');
        setIsPomodoroModalOpen(true);
      } else {
      onNavigate(SCREENS.TASKS);
      }
      return;
    }

    // Gate click -> Open gate (works for both blue moon and red moon)
    if (gate.hover) {
      gate.opening = true;
      gate.openT = 0;
      for (let i = 0; i < 10; i++) spawnMist(true);
    }
  };

  return (
    <div
      className={`home-screen${
        mode === MODE.TASKS && showTutorial ? ` tutorial-active tutorial-step-${tutorialStep}` : ''
      }`}
    >
      <div className="home-navbar">
        <div className="medieval-navbar">
          <div className="navbar-section navbar-left">
            {mode === MODE.TASKS && (
              <button
                className={`btn-medieval btn-auth navbar-btn${
                  showTutorial && tutorialStep === 3 ? ' tutorial-highlight' : ''
                }`}
                onClick={() => setIsModalOpen(true)}
              >
                + Add Quest
              </button>
            )}
            {mode === MODE.STOPWATCH && (
              <button
                className="btn-medieval btn-auth navbar-btn"
                type="button"
                onClick={() => {
                  setPomodoroModalPurpose('settings');
                  setIsPomodoroModalOpen(true);
                }}
                aria-label={`Pomodoro settings. Study ${pomodoroDefaults.studyMinutes} minutes, break ${pomodoroDefaults.breakMinutes} minutes.`}
              >
                Pomodoro {pomodoroDefaults.studyMinutes}/{pomodoroDefaults.breakMinutes}
              </button>
            )}
          </div>
          <div className="navbar-section navbar-center" aria-label="POMODON">
            <span className="navbar-title">POMODON</span>
          </div>
          <div className="navbar-section navbar-right">
            <div className="auth-panel navbar-auth" ref={authMenuRef}>
              <div
                className={`streak-badge${
                  showTutorial && tutorialStep === 2 ? ' tutorial-highlight' : ''
                }`}
                aria-label={`Streak: ${streakDays} days`}
              >
                <svg className="streak-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12.6 2.4c.2 2-1 3.4-2.2 4.7-1.2 1.3-2.5 2.8-2.5 5.1 0 3 2.2 5.1 5 5.1s5-2.1 5-5.1c0-2.4-1.4-4-2.8-5.6-.5-.6-1.1-1.3-1.5-2.1-.6 1.1-.7 2.1-.9 2.9-.3 1.2-.6 2.3-2 3.3.2-1.8 1.1-3.2 1.9-4.3 1-1.4 1.8-2.6 1.9-4z" />
                </svg>
                <span className="streak-count">{streakDays}</span>
              </div>
              <button
                className="streak-info-btn"
                type="button"
                onClick={restartTutorial}
                aria-label="Replay home tutorial"
                title="Replay tutorial"
              >
                <span className="streak-info-icon" aria-hidden="true">
                  i
                </span>
              </button>
              {googleUser ? (
                <div className="auth-menu">
                  <button
                    className="auth-avatar-btn"
                    onClick={() => {
                      setIsAuthMenuOpen((prev) => !prev);
                      setIsSettingsOpen(false);
                      setIsFriendsOpen(false);
                    }}
                    aria-label="Open user menu"
                    title={googleUser?.username ? `@${googleUser.username}` : googleUser?.name || 'User'}
                    type="button"
                  >
                    <img
                      className="auth-avatar-img"
                      src={googleUser.picture}
                      alt={googleUser.name || 'User'}
                      referrerPolicy="no-referrer"
                    />
                  </button>
                  {isAuthMenuOpen && (
                    <div className="auth-dropdown" role="menu">
                      <button
                        className="auth-dropdown-item"
                        type="button"
                        onClick={() => {
                          setIsAuthMenuOpen(false);
                          setIsFriendsOpen(true);
                          setIsSettingsOpen(false);
                        }}
                      >
                        Friends
                        {friendRequests.length > 0 && (
                          <span className="friend-badge">{friendRequests.length}</span>
                        )}
                      </button>
                      <button
                        className="auth-dropdown-item"
                        type="button"
                        onClick={() => {
                          setIsAuthMenuOpen(false);
                          setIsSettingsOpen(true);
                          setIsFriendsOpen(false);
                        }}
                      >
                        Settings
                      </button>
                      <button
                        className="auth-dropdown-item"
                        type="button"
                        onClick={() => {
                          setIsAuthMenuOpen(false);
                          onNavigate(SCREENS.COLLECTIONS);
                        }}
                      >
                        Collectibles
                      </button>
                      <button
                        className="auth-dropdown-item"
                        type="button"
                        onClick={() => {
                          setIsAuthMenuOpen(false);
                          onNavigate(SCREENS.RECORDS);
                        }}
                      >
                        Records
                      </button>
                      <button
                        className="auth-dropdown-item"
                        type="button"
                        onClick={handleGoogleSignOut}
                      >
                        Sign out
                      </button>
                    </div>
                  )}
                  {isSettingsOpen && (
                    <div className="settings-panel" ref={settingsRef} role="dialog" aria-label="Settings">
                      <div className="settings-header">
                        <span>Settings</span>
                        <button
                          className="settings-close"
                          type="button"
                          aria-label="Close settings"
                          onClick={() => setIsSettingsOpen(false)}
                        >
                          ×
                        </button>
                      </div>
                      <div className="settings-row">
                        <label className="settings-toggle">
                          <span>Music</span>
                          <span className="settings-toggle-controls">
                            <input
                              type="checkbox"
                              checked={musicEnabled}
                              onChange={(event) => setMusicEnabled(event.target.checked)}
                              aria-label="Toggle music"
                            />
                            <span className="settings-toggle-text">
                              {musicEnabled ? 'On' : 'Off'}
                            </span>
                          </span>
                        </label>
                      </div>
                      <div className="settings-row">
                        <label className="settings-label" htmlFor="music-volume">
                          Music volume
                        </label>
                        <div className="settings-slider-row">
                          <input
                            id="music-volume"
                            type="range"
                            min="0"
                            max="100"
                            value={Math.round(musicVolume * 100)}
                            onChange={(event) => setMusicVolume(Number(event.target.value) / 100)}
                          />
                          <span className="settings-value">
                            {Math.round(musicVolume * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  {isFriendsOpen && (
                    <div className="friends-panel" ref={friendsRef} role="dialog" aria-label="Friends">
                      <div className="friends-header">
                        <span>Friends</span>
                        <button
                          className="friends-close"
                          type="button"
                          aria-label="Close friends"
                          onClick={() => setIsFriendsOpen(false)}
                        >
                          ×
                        </button>
                      </div>
                      <div className="friends-body">
                        {/* Add Friend Section */}
                        <div className="add-friend-section">
                          <button
                            className="btn-add-friend"
                            type="button"
                            onClick={() => setShowAddFriend(!showAddFriend)}
                          >
                            {showAddFriend ? 'Cancel' : '+ Add Friend'}
                          </button>
                          {showAddFriend && (
                            <form onSubmit={handleSendFriendRequest} className="add-friend-form">
                              <input
                                type="text"
                                placeholder="Enter username..."
                                value={friendUsername}
                                onChange={(e) => setFriendUsername(e.target.value)}
                                className="friend-username-input"
                                disabled={friendActionLoading}
                              />
                              <button
                                type="submit"
                                className="btn-send-request"
                                disabled={friendActionLoading}
                              >
                                {friendActionLoading ? 'Sending...' : 'Send Request'}
                              </button>
                            </form>
                          )}
                        </div>

                        {/* Friend Requests Section */}
                        {friendRequests.length > 0 && (
                          <div className="friend-requests-section">
                            <h3 className="friends-section-title">
                              Friend Requests
                              <span className="count-badge">{friendRequests.length}</span>
                            </h3>
                            <div className="friend-requests-list">
                              {friendRequests.map((request) => (
                                <div key={request.id} className="friend-request-item">
                                  <div className="friend-request-info">
                                    <span className="friend-username">{request.requesterUsername}</span>
                                  </div>
                                  <div className="friend-request-actions">
                                    <button
                                      className="btn-accept"
                                      type="button"
                                      onClick={() => handleAcceptRequest(request.id)}
                                      disabled={friendActionLoading}
                                    >
                                      Accept
                                    </button>
                                    <button
                                      className="btn-reject"
                                      type="button"
                                      onClick={() => handleRejectRequest(request.id)}
                                      disabled={friendActionLoading}
                                    >
                                      Reject
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Friends List Section */}
                        <div className="friends-list-section">
                          <h3 className="friends-section-title">
                            Friends
                            <span className="count-badge">{friends.length}</span>
                          </h3>
                          {friends.length > 0 ? (
                            <div className="friends-list">
                              {friends.map((friend) => {
                                const status = onlineStatuses[friend.id];
                                const isOnline = status?.isOnline || false;
                                return (
                                <div key={friend.id} className="friend-item">
                                  <div 
                                    className="friend-info"
                                    onClick={() => handleFriendClick(friend)}
                                    style={{ cursor: 'pointer' }}
                                  >
                                    <span className="friend-username">{friend.username}</span>
                                    <span className={`online-indicator ${isOnline ? 'online' : 'offline'}`}>
                                      {isOnline ? '🟢' : '⚫'}
                                    </span>
                                  </div>
                                  <button
                                    className="btn-friend-options"
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveFriendOptions(
                                        activeFriendOptions === friend.id ? null : friend.id
                                      );
                                    }}
                                  >
                                    ⋮
                                  </button>
                                  {activeFriendOptions === friend.id && (
                                    <div className="friend-options-menu">
                                      <button
                                        className="btn-remove-friend"
                                        type="button"
                                        onClick={() => handleRemoveFriend(friend.id, friend.username)}
                                        disabled={friendActionLoading}
                                      >
                                        {friendActionLoading ? 'Removing...' : 'Remove Friend'}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                              })}
                            </div>
                          ) : (
                            <p className="friends-empty">No friends yet. Add someone to start!</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  className="btn-medieval btn-auth btn-auth-icon navbar-auth-btn"
                  onClick={handleGoogleSignIn}
                  aria-label="Sign in with Google"
                >
                  <span className="google-icon">G</span>
                </button>
              )}
              {authError && <div className="auth-error">{authError}</div>}
            </div>
          </div>
        </div>
      </div>
      <div className="fullscreen-canvas-container">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => {
            gateRef.current.hover = false;
            avatarRef.current.hover = false;
          }}
          onClick={handleClick}
        />
        {mode === MODE.TASKS && showTutorial && (
          <div
            className={`home-tutorial ${
              tutorialStep === 1
                ? 'step-moon'
                : tutorialStep === 2
                  ? 'step-streak'
                  : tutorialStep === 3
                    ? 'step-add-quest'
                    : 'step-gate'
            }`}
            role="dialog"
            aria-label="Home tutorial"
          >
            <div className="home-tutorial-card">
              <div className="home-tutorial-title">
                {tutorialStep === 1
                  ? 'Switch modes'
                  : tutorialStep === 2
                    ? 'Daily streak'
                    : tutorialStep === 3
                      ? 'Add quests'
                      : 'Start your first quest'}
              </div>
              <div className="home-tutorial-body">
                {tutorialStep === 1
                  ? 'Click the moon to toggle between quest and focus modes.'
                  : tutorialStep === 2
                    ? 'Your streak grows when you keep up daily focus sessions.'
                    : tutorialStep === 3
                      ? 'Use “+ Add Quest” to create new tasks before entering the gate.'
                      : 'Click “+ Add Quest”, then tap the glowing gate to enter the quest board.'}
              </div>
              {tutorialStep === maxTutorialStep ? (
                <button
                  className="home-tutorial-dismiss"
                  type="button"
                  onClick={dismissTutorial}
                  aria-label="Dismiss tutorial"
                >
                  Got it
                </button>
              ) : (
                <button
                  className="home-tutorial-next"
                  type="button"
                  onClick={() => setTutorialStep((step) => Math.min(maxTutorialStep, step + 1))}
                  aria-label="Next tutorial step"
                >
                  Next
                </button>
              )}
              <div
                className={`home-tutorial-arrow ${
                  tutorialStep === 1
                    ? 'arrow-right'
                    : tutorialStep === 2 || tutorialStep === 3
                      ? 'arrow-up'
                      : 'arrow-down'
                }`}
                aria-hidden="true"
              />
            </div>
          </div>
        )}

        <AddTaskModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={(taskData) => {
            gameState.addTask(taskData);
            setIsModalOpen(false);
          }}
        />

        <PomodoroModal
          isOpen={isPomodoroModalOpen}
          onClose={() => setIsPomodoroModalOpen(false)}
          studyMinutes={pomodoroDefaults.studyMinutes}
          breakMinutes={pomodoroDefaults.breakMinutes}
          submitLabel={pomodoroModalPurpose === 'settings' ? 'Save Settings' : 'Accept Quest'}
          onSubmit={({ studyMinutes, breakMinutes }) => {
            setPomodoroDefaults({ studyMinutes, breakMinutes });
            if (pomodoroModalPurpose === 'settings') {
              setIsPomodoroModalOpen(false);
              return;
            }
            const pomodoroTask = {
              id: `pomo-${Date.now()}`,
              name: 'Red Moon Pomodoro',
              timeEstimate: studyMinutes,
              breakMinutes,
              isPomodoro: true,
              monsterType: getMonsterForPriority(PRIORITY.MEDIUM),
              dungeonRoom: getRandomDungeonRoom(),
            };
            setIsPomodoroModalOpen(false);
            onNavigate(SCREENS.BATTLE, pomodoroTask);
          }}
        />

        {/* Username Creation Modal */}
        {showUsernameModal && (
          <div className="username-modal-overlay">
            <div className="username-modal">
              <div className="username-modal-title">
                Choose Your Username
              </div>
              <div className="username-modal-description">
                Create a unique username so others can find and add you as a friend!
              </div>
              <form onSubmit={handleCreateUsername}>
                <input
                  type="text"
                  className="username-input"
                  placeholder="Enter username..."
                  value={usernameInput}
                  onChange={(e) => {
                    setUsernameInput(e.target.value);
                    setUsernameError('');
                  }}
                  disabled={isCheckingUsername}
                  autoFocus
                  maxLength={20}
                />
                {usernameError && (
                  <div className="username-error">
                    {usernameError}
                  </div>
                )}
                <button
                  type="submit"
                  className="btn-create-username"
                  disabled={isCheckingUsername || !usernameInput.trim()}
                >
                  {isCheckingUsername ? 'Creating...' : 'Create Username'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Friend Summary Modal */}
        {selectedFriend && (
          <div className="friend-summary-overlay" onClick={closeFriendSummary}>
            <div className="friend-summary-modal" onClick={(e) => e.stopPropagation()}>
              <div className="friend-summary-header">
                <h2 className="friend-summary-title">{selectedFriend.username}</h2>
                <button
                  className="friend-summary-close"
                  type="button"
                  onClick={closeFriendSummary}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              
              {loadingFriendSummary ? (
                <div className="friend-summary-loading">Loading...</div>
              ) : friendSummary ? (
                <div className="friend-summary-content">
                  <div className="friend-summary-status">
                    <span className={`status-indicator ${friendSummary.isOnline ? 'online' : 'offline'}`}>
                      {friendSummary.isOnline ? '🟢 Online' : '⚫ Offline'}
                    </span>
                    {!friendSummary.isOnline && friendSummary.lastSeen && (
                      <span className="last-seen">
                        Last seen: {new Date(friendSummary.lastSeen).toLocaleString()}
                      </span>
                    )}
                  </div>
                  
                  <div className="friend-summary-stats">
                    <div className="summary-stat-card">
                      <div className="stat-icon">⚔️</div>
                      <div className="stat-value">{friendSummary.totalQuestsCompleted || 0}</div>
                      <div className="stat-label">Quests Completed</div>
                    </div>
                    
                    <div className="summary-stat-card">
                      <div className="stat-icon">⏱️</div>
                      <div className="stat-value">{friendSummary.totalTimeWorkedFormatted || '0h 0m'}</div>
                      <div className="stat-label">Time Worked</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="friend-summary-error">Failed to load friend data</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default HomeScreen;
