import { useRef, useEffect, useState, useCallback } from 'react';
import { SCREENS, MODE, AVATARS, PRIORITY, getRandomDungeonRoom, getMonsterForPriority } from '../data/constants';
import { useLocalStorage } from '../hooks/useLocalStorage';
import AddTaskModal from './AddTaskModal';
import PomodoroModal from './PomodoroModal';

const W = 320;
const H = 180;

function HomeScreen({ gameState, onNavigate }) {
  const canvasRef = useRef(null);
  const [mode, setMode] = useState(MODE.TASKS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPomodoroModalOpen, setIsPomodoroModalOpen] = useState(false);
  const [avatarSprite, setAvatarSprite] = useState(null);
  const [googleUser, setGoogleUser] = useLocalStorage('pomoDungeon_googleUser', null);
  const [streakDays] = useLocalStorage('pomoDungeon_streakDays', 0);
  const [authError, setAuthError] = useState('');
  const [showTutorial, setShowTutorial] = useState(
    () => !googleUser || localStorage.getItem('pomoDungeon_homeTutorialSeen') !== 'true'
  );
  const [tutorialStep, setTutorialStep] = useState(0);
  const maxTutorialStep = 3;
  const googleInitRef = useRef(false);
  const tokenClientRef = useRef(null);
  const [isAuthMenuOpen, setIsAuthMenuOpen] = useState(false);
  const authMenuRef = useRef(null);
  const dismissTutorial = () => {
    if (googleUser) {
      localStorage.setItem('pomoDungeon_homeTutorialSeen', 'true');
    }
    setShowTutorial(false);
  };

  useEffect(() => {
    if (!googleUser) {
      setShowTutorial(true);
      return;
    }
    setShowTutorial(localStorage.getItem('pomoDungeon_homeTutorialSeen') !== 'true');
  }, [googleUser]);

  useEffect(() => {
    if (showTutorial) {
      setTutorialStep(0);
    }
  }, [showTutorial]);
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
          setGoogleUser({
            name: data.name,
            email: data.email,
            picture: data.picture,
            sub: data.sub,
          });
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

    const overMoon = Math.hypot(mx - moon.x, my - moon.y) <= moon.r;
    const overAvatar = mx >= avatar.x && mx <= avatar.x + avatar.w && my >= avatar.y && my <= avatar.y + avatar.h;
    const overGate = mx >= gate.x && mx <= gate.x + gate.w && my >= gate.y && my <= gate.y + gate.h;

    gate.hover = overGate && !gate.opening;
    avatar.hover = overAvatar;

    canvas.style.cursor = overMoon || gate.hover || overAvatar ? 'pointer' : 'default';
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
    const d = doorRect();

    // Avatar click -> Collections
    if (mx >= avatar.x && mx <= avatar.x + avatar.w && my >= avatar.y && my <= avatar.y + avatar.h) {
      onNavigate(SCREENS.COLLECTIONS);
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
              {googleUser ? (
                <div className="auth-menu">
                  <button
                    className="auth-avatar-btn"
                    onClick={() => setIsAuthMenuOpen((prev) => !prev)}
                    aria-label="Open user menu"
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
                        onClick={() => setIsAuthMenuOpen(false)}
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
          onSubmit={({ studyMinutes, breakMinutes }) => {
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
      </div>
    </div>
  );
}

export default HomeScreen;
