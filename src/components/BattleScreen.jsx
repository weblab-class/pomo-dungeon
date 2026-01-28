import { useState, useEffect, useRef } from 'react';
import { AVATARS, MONSTERS, COIN_REWARDS, DUNGEON_ROOMS } from '../data/constants';
import { useLocalStorage } from '../hooks/useLocalStorage';

function BattleScreen({ task, gameState, onExit, onComplete }) {
  // Initialize elapsed from task's saved timeSpent (for resume functionality)
  const [elapsed, setElapsed] = useState(task?.timeSpent || 0);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  const [paused, setPaused] = useState(false);
  const [questComplete, setQuestComplete] = useState(false);
  const [showVictory, setShowVictory] = useState(false);
  const [finishPrompt, setFinishPrompt] = useState(false);
  const [finisherActive, setFinisherActive] = useState(false);
  const [monsterDead, setMonsterDead] = useState(false);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [playerIdleSprite, setPlayerIdleSprite] = useState(null);
  const [playerRunSprite, setPlayerRunSprite] = useState(null);
  const [playerAttackSprites, setPlayerAttackSprites] = useState([]);
  const [playerDefendSprite, setPlayerDefendSprite] = useState(null);
  const [playerHurtSprite, setPlayerHurtSprite] = useState(null);
  const [playerRunAttackSprite, setPlayerRunAttackSprite] = useState(null);
  const [playerJumpSprite, setPlayerJumpSprite] = useState(null);
  const [monsterIdleSprite, setMonsterIdleSprite] = useState(null);
  const [monsterAttackSprite, setMonsterAttackSprite] = useState(null);
  const [monsterHitSprite, setMonsterHitSprite] = useState(null);
  const [monsterWalkSprite, setMonsterWalkSprite] = useState(null);
  const [monsterShieldSprite, setMonsterShieldSprite] = useState(null);
  const [phase, setPhase] = useState('study');
  const [musicEnabled, setMusicEnabled] = useLocalStorage('pomoDungeon_musicEnabled', true);
  const [musicVolume] = useLocalStorage('pomoDungeon_musicVolume', 0.35);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const musicEnabledRef = useRef(musicEnabled);
  const musicVolumeRef = useRef(musicVolume);
  const pausedRef = useRef(paused);
  const userInteractedRef = useRef(false);
  const iframeRef = useRef(null);
  const widgetRef = useRef(null);
  const soundCloudReadyRef = useRef(false);
  
  const startTimeRef = useRef(performance.now() - (task?.timeSpent || 0));
  const pausedTimeRef = useRef(0);
  const playerCanvasRef = useRef(null);
  const monsterCanvasRef = useRef(null);
  const playerSideRef = useRef(null);
  const monsterSideRef = useRef(null);
  const playerAttackStartRef = useRef(0);
  const playerAttackIndexRef = useRef(0);
  const monsterAttackStartRef = useRef(0);
  const playerComboRef = useRef({ sequence: [], durations: [], totalDuration: 0 });
  const monsterAttackToggleRef = useRef(false);
  const lastMonsterAttackStartRef = useRef(null);
  const finisherStartRef = useRef(0);
  const finisherHitRef = useRef(false);
  const finisherDoneRef = useRef(false);

  const isPomodoro = Boolean(task?.isPomodoro);
  const studyMinutes = task?.timeEstimate || 25;
  const breakMinutes = task?.breakMinutes || 5;
  const duration =
    (phase === 'break' ? breakMinutes : studyMinutes) * 60 * 1000;
  const avatar = AVATARS[gameState.player.currentAvatar] || AVATARS.knight_1;
  const monster = MONSTERS[task?.monsterType] || MONSTERS.goblin;
  const PLAYER_SIZE = isMobile ? 260 : 450;
  const MONSTER_SIZE = isMobile ? 320 : 550;
  const ATTACK_COOLDOWN_MS = 5000;
  const FRAME_DURATION_MS = 120;
  const ATTACK_DELAY_MS = 200;
  const RUN_OFFSET_PX = isMobile ? 220 : 500;
  const MONSTER_RUN_OFFSET_PX = isMobile ? 200 : 450;
  const PLAYER_Y_OFFSET = 0;
  const MONSTER_Y_OFFSET = isMobile ? 110 : 175;
  
  // Get dungeon room from task or use first one as default
  const dungeonRoom = task?.dungeonRoom || DUNGEON_ROOMS[0];
  const soundCloudPlaylistUrl = 'https://on.soundcloud.com/2acGXci60bIST51lyF';
  const buildWidgetUrl = (url) =>
    `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=true&show_comments=false&show_user=false&show_reposts=false&visual=false`;
  const [soundCloudWidgetSrc, setSoundCloudWidgetSrc] = useState(() =>
    buildWidgetUrl(soundCloudPlaylistUrl)
  );
  const withWidget = (action) => {
    const widget = widgetRef.current;
    const iframe = iframeRef.current;
    if (!widget || !soundCloudReadyRef.current) return;
    if (!iframe || !iframe.contentWindow) return;
    try {
      action(widget);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
    }
  };

  useEffect(() => {
    musicEnabledRef.current = musicEnabled;
  }, [musicEnabled]);

  useEffect(() => {
    musicVolumeRef.current = musicVolume;
  }, [musicVolume]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    // Mark user as interacted immediately when battle screen loads (entering battle is user interaction)
    userInteractedRef.current = true;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const resolveWidgetSrc = async () => {
      try {
        const res = await fetch(
          `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(
            soundCloudPlaylistUrl
          )}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.html || cancelled) return;
        const doc = new DOMParser().parseFromString(data.html, 'text/html');
        const iframe = doc.querySelector('iframe');
        const src = iframe?.getAttribute('src');
        if (src && !cancelled) {
          setSoundCloudWidgetSrc(src);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error);
      }
    };

    resolveWidgetSrc();
    return () => {
      cancelled = true;
    };
  }, [soundCloudPlaylistUrl]);

  useEffect(() => {
    let cancelled = false;
    const ensureScript = () =>
      new Promise((resolve, reject) => {
        if (window.SC?.Widget) {
          resolve();
          return;
        }
        const existing = document.querySelector('script[data-soundcloud-widget]');
        if (existing) {
          existing.addEventListener('load', () => resolve());
          existing.addEventListener('error', () => reject(new Error('SoundCloud SDK failed')));
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://w.soundcloud.com/player/api.js';
        script.async = true;
        script.dataset.soundcloudWidget = 'true';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('SoundCloud SDK failed'));
        document.body.appendChild(script);
      });

    const initWidget = async () => {
      try {
        await ensureScript();
        if (cancelled) return;
        if (!iframeRef.current) return;
        const widget = window.SC.Widget(iframeRef.current);
        widgetRef.current = widget;
        widget.bind(window.SC.Widget.Events.READY, () => {
          if (cancelled) return;
          soundCloudReadyRef.current = true;
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/13d600c1-3f34-4e60-b1d2-361a4f00b402',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'BattleScreen.jsx:widget-ready',message:'SoundCloud widget ready',data:{musicEnabled:musicEnabledRef.current,paused:pausedRef.current,userInteracted:userInteractedRef.current,willPlay:musicEnabledRef.current&&!pausedRef.current&&userInteractedRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'H9_WIDGET_READY'})}).catch(()=>{});
          // #endregion
          withWidget((current) =>
            current.setVolume(Math.round(Math.max(0, Math.min(1, musicVolumeRef.current)) * 100))
          );
          // Auto-play music when widget is ready (user already interacted by entering battle)
          if (musicEnabledRef.current && !pausedRef.current && userInteractedRef.current) {
            withWidget((current) => current.play());
          }
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error);
      }
    };

    initWidget();

    return () => {
      cancelled = true;
      withWidget((widget) => widget.pause());
      widgetRef.current = null;
      soundCloudReadyRef.current = false;
    };
  }, [soundCloudWidgetSrc]);

  useEffect(() => {
    withWidget((widget) =>
      widget.setVolume(Math.round(Math.max(0, Math.min(1, musicVolume)) * 100))
    );
  }, [musicVolume]);

  useEffect(() => {
    if (musicEnabled && !paused) {
      withWidget((widget) => widget.play());
    } else {
      withWidget((widget) => widget.pause());
    }
  }, [musicEnabled, paused]);

  useEffect(() => {
    const nextElapsed = task?.timeSpent || 0;
    setElapsed(nextElapsed);
    setPaused(false);
    setQuestComplete(false);
    setShowVictory(false);
    setFinishPrompt(false);
    setFinisherActive(false);
    setMonsterDead(false);
    setCoinsEarned(0);
    setPhase('study');
    startTimeRef.current = performance.now() - nextElapsed;
    pausedTimeRef.current = 0;
    finisherHitRef.current = false;
    finisherDoneRef.current = false;
  }, [task?.id, task?.timeSpent]);

  // Handle flee - save progress and exit
  const handleFlee = () => {
    // Pause first
    if (!paused) {
      setPaused(true);
    }
    setShowPlaylist(false);
    // Stop battle music immediately on flee.
    withWidget((widget) => widget.pause());
    // Save the elapsed time to the task
    gameState.updateTask(task.id, { timeSpent: elapsed });
    onExit();
  };

  // Timer effect
  useEffect(() => {
    if (questComplete || paused) return;

    const interval = setInterval(() => {
      const now = performance.now();
      const newElapsed = now - startTimeRef.current - pausedTimeRef.current;
      setElapsed(newElapsed);

      if (newElapsed >= duration) {
        if (isPomodoro && phase === 'study') {
          setPhase('break');
        } else {
          handleComplete();
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [questComplete, paused, duration, isPomodoro, phase]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isPomodoro) return;
    setElapsed(0);
    startTimeRef.current = performance.now();
    pausedTimeRef.current = 0;
    setPaused(false);
  }, [phase, isPomodoro]);

  const loadImage = (src, setter) => {
    const img = new Image();
    img.src = src;
    img.onload = () => setter(img);
  };

  const loadOptionalImage = (src, setter) => {
    const img = new Image();
    img.src = src;
    img.onload = () => setter(img);
    img.onerror = () => setter(null);
  };

  const monsterAttackSpriteName = monster.attackSprite || monster.sprite;
  const monsterIdleSpriteName = monster.idleSprite || monsterAttackSpriteName;
  const monsterHitSpriteName = monster.hitSprite || monsterAttackSpriteName;
  const monsterWalkSpriteName = monster.walkSprite || monsterIdleSpriteName;
  const monsterShieldSpriteName = monster.shieldSprite || 'Shield.png';

  // Load player sprites
  useEffect(() => {
    loadImage(`${avatar.basePath}/Idle.png`, setPlayerIdleSprite);
    loadImage(`${avatar.basePath}/Run.png`, setPlayerRunSprite);
    loadImage(`${avatar.basePath}/Defend.png`, setPlayerDefendSprite);
    loadOptionalImage(`${avatar.basePath}/Hurt.png`, setPlayerHurtSprite);
    loadOptionalImage(`${avatar.basePath}/Run+Attack.png`, setPlayerRunAttackSprite);
    loadOptionalImage(`${avatar.basePath}/Jump.png`, setPlayerJumpSprite);
    Promise.all([
      `${avatar.basePath}/Attack 1.png`,
      `${avatar.basePath}/Attack 2.png`,
      `${avatar.basePath}/Attack 3.png`,
    ].map((src) => new Promise((resolve) => {
      const img = new Image();
      img.src = src;
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
    }))).then((images) => {
      const valid = images.filter(Boolean);
      setPlayerAttackSprites(valid);
    });
  }, [avatar.basePath]);

  // Load monster sprites
  useEffect(() => {
    loadImage(`${monster.basePath}/${monsterAttackSpriteName}`, setMonsterAttackSprite);
    loadImage(`${monster.basePath}/${monsterIdleSpriteName}`, setMonsterIdleSprite);
    loadImage(`${monster.basePath}/${monsterHitSpriteName}`, setMonsterHitSprite);
    loadImage(`${monster.basePath}/${monsterWalkSpriteName}`, setMonsterWalkSprite);
    loadOptionalImage(`${monster.basePath}/${monsterShieldSpriteName}`, setMonsterShieldSprite);
  }, [
    monster.basePath,
    monsterAttackSpriteName,
    monsterIdleSpriteName,
    monsterHitSpriteName,
    monsterWalkSpriteName,
    monsterShieldSpriteName,
  ]);

  const getFrameCount = (img) => {
    if (!img) return 1;
    const frameSize = img.height || 1;
    return Math.max(1, Math.floor(img.width / frameSize));
  };

  const drawFrame = (canvas, img, frameIndex, size) => {
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const frameCount = getFrameCount(img);
    const frameWidth = Math.floor(img.width / frameCount);
    const frameHeight = img.height;
    const clampedFrame = Math.max(0, Math.min(frameCount - 1, frameIndex));
    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      img,
      clampedFrame * frameWidth,
      0,
      frameWidth,
      frameHeight,
      0,
      0,
      canvas.width,
      canvas.height
    );
  };

  const getIdleFrame = (now, img) => {
    const frames = getFrameCount(img);
    if (frames <= 1) return 0;
    return Math.floor((now / FRAME_DURATION_MS) % frames);
  };

  useEffect(() => {
    if (!playerIdleSprite || !playerRunSprite || !playerDefendSprite || playerAttackSprites.length === 0 || !monsterAttackSprite) return;

    const playerCanvas = playerCanvasRef.current;
    const monsterCanvas = monsterCanvasRef.current;
    const playerSide = playerSideRef.current;
    const monsterSide = monsterSideRef.current;

    drawFrame(playerCanvas, playerIdleSprite, 0, PLAYER_SIZE);
    drawFrame(monsterCanvas, monsterAttackSprite, 0, MONSTER_SIZE);

    if (paused || showVictory) {
      return undefined;
    }

    const runFrames = getFrameCount(playerRunSprite);
    const monsterFrames = getFrameCount(monsterAttackSprite);
    const monsterHitFrames = getFrameCount(monsterHitSprite || monsterAttackSprite);
    const monsterWalkFrames = getFrameCount(monsterWalkSprite || monsterIdleSprite || monsterAttackSprite);
    const runDuration = runFrames * FRAME_DURATION_MS;
    const getAttackDuration = (sprite) => getFrameCount(sprite) * FRAME_DURATION_MS;
    const maxAttackDuration = Math.max(
      ...playerAttackSprites.map((sprite) => getAttackDuration(sprite))
    );
    const monsterAttackDuration = monsterFrames * FRAME_DURATION_MS;
    const monsterWalkFrameDuration = monster.walkFrameDurationMs || FRAME_DURATION_MS;
    const monsterWalkDuration = monsterWalkFrames * monsterWalkFrameDuration;
    const monsterReturnDuration = monsterWalkDuration;
    const playerReturnDuration = runDuration;
    const monsterAttackStartDelay = runDuration + maxAttackDuration + playerReturnDuration + ATTACK_DELAY_MS;
    const monsterCycleDuration =
      monsterAttackStartDelay +
      monsterWalkDuration +
      monsterAttackDuration +
      monsterReturnDuration +
      200;

    const startCycle = (startTime) => {
      const attackPool = [
        ...playerAttackSprites,
        ...(playerRunAttackSprite ? [playerRunAttackSprite] : []),
        ...(playerJumpSprite ? [playerJumpSprite] : []),
      ];
      const comboRoll = Math.random();
      const comboLength = comboRoll < 0.2 ? 3 : comboRoll < 0.5 ? 2 : 1;
      const sequence = [];
      const durations = [];
      const startIndex = playerAttackIndexRef.current % attackPool.length;
      for (let i = 0; i < comboLength; i += 1) {
        const spriteIndex = (startIndex + i) % attackPool.length;
        const sprite = attackPool[spriteIndex];
        sequence.push(sprite);
        durations.push(getAttackDuration(sprite));
      }
      const totalDuration = durations.reduce((sum, value) => sum + value, 0);
      playerAttackIndexRef.current = (startIndex + comboLength) % attackPool.length;
      playerComboRef.current = { sequence, durations, totalDuration };
      playerAttackStartRef.current = startTime;
      const attackStartDelay = runDuration + totalDuration + playerReturnDuration + ATTACK_DELAY_MS;
      monsterAttackStartRef.current = startTime + attackStartDelay;
    };

    startCycle(performance.now());
    const intervalId = setInterval(
      () => startCycle(performance.now()),
      Math.max(ATTACK_COOLDOWN_MS, monsterCycleDuration)
    );

    let animationId;
    const render = (now) => {
      if (questComplete && !finisherActive) {
        if (playerSide) {
          playerSide.style.transform = 'translateX(0px)';
        }
        if (monsterSide) {
          monsterSide.style.transform = 'translateX(0px)';
        }
        drawFrame(playerCanvas, playerIdleSprite, getIdleFrame(now, playerIdleSprite), PLAYER_SIZE);
        const monsterSheet = monsterIdleSprite || monsterAttackSprite;
        drawFrame(monsterCanvas, monsterSheet, getIdleFrame(now, monsterSheet), MONSTER_SIZE);

        animationId = requestAnimationFrame(render);
        return;
      }
      if (finisherActive) {
        const windupMs = 450;
        const strikeMs = 1100;
        const recoveryMs = 350;
        const totalMs = windupMs + strikeMs + recoveryMs;
        const specialAttackSprite =
          playerRunAttackSprite ||
          playerJumpSprite ||
          playerAttackSprites[playerAttackSprites.length - 1] ||
          playerAttackSprites[0];
        const finisherFrameDuration = FRAME_DURATION_MS * 2.2;
        const finisherElapsed = now - finisherStartRef.current;
        const isWindup = finisherElapsed >= 0 && finisherElapsed < windupMs;
        const isStrike = finisherElapsed >= windupMs && finisherElapsed < windupMs + strikeMs;
        const strikeElapsed = Math.max(0, finisherElapsed - windupMs);
        const runProgress = isWindup ? Math.min(1, finisherElapsed / windupMs) : 1;

        if (playerSide) {
          playerSide.style.transform = `translateX(${runProgress * RUN_OFFSET_PX * 0.85}px)`;
        }
        if (monsterSide) {
          monsterSide.style.transform = 'translateX(0px)';
        }

        const playerFrame = isWindup
          ? Math.floor(finisherElapsed / FRAME_DURATION_MS) % runFrames
          : isStrike
            ? Math.floor(strikeElapsed / finisherFrameDuration) % getFrameCount(specialAttackSprite)
            : 0;
        const playerSheet = isWindup ? playerRunSprite : specialAttackSprite;
        drawFrame(playerCanvas, playerSheet, playerFrame, PLAYER_SIZE);

        const hitMoment = windupMs + strikeMs * 0.55;
        if (!finisherHitRef.current && finisherElapsed >= hitMoment) {
          finisherHitRef.current = true;
          setMonsterDead(true);
        }

        const monsterSheet = finisherElapsed >= hitMoment
          ? (monsterHitSprite || monsterIdleSprite || monsterAttackSprite)
          : (monsterIdleSprite || monsterAttackSprite);
        const monsterFrame = isStrike
          ? Math.floor(strikeElapsed / finisherFrameDuration) % getFrameCount(monsterSheet)
          : getIdleFrame(now, monsterSheet);
        drawFrame(monsterCanvas, monsterSheet, monsterFrame, MONSTER_SIZE);

        if (!finisherDoneRef.current && finisherElapsed >= totalMs) {
          finisherDoneRef.current = true;
          setFinisherActive(false);
          setShowVictory(true);
        }

        animationId = requestAnimationFrame(render);
        return;
      }
      const comboData = playerComboRef.current;
      const fallbackAttackSprite = playerAttackSprites[playerAttackIndexRef.current % playerAttackSprites.length];
      const comboSprites = comboData.sequence.length > 0 ? comboData.sequence : [fallbackAttackSprite];
      const comboDurations = comboData.durations.length > 0 ? comboData.durations : [
        getAttackDuration(comboSprites[0]),
      ];
      const comboTotalDuration = comboData.totalDuration || comboDurations.reduce((sum, value) => sum + value, 0);
      const playerElapsed = now - playerAttackStartRef.current;
      const isPlayerRunningOut = playerElapsed >= 0 && playerElapsed < runDuration;
      const isPlayerAttacking =
        playerElapsed >= runDuration && playerElapsed < runDuration + comboTotalDuration;
      const isPlayerReturning =
        playerElapsed >= runDuration + comboTotalDuration &&
        playerElapsed < runDuration + comboTotalDuration + playerReturnDuration;

      let activeAttackSprite = comboSprites[0];
      let attackFrameIndex = 0;
      if (isPlayerAttacking) {
        let remaining = playerElapsed - runDuration;
        for (let i = 0; i < comboSprites.length; i += 1) {
          if (remaining < comboDurations[i]) {
            activeAttackSprite = comboSprites[i];
            attackFrameIndex = Math.floor(remaining / FRAME_DURATION_MS) % getFrameCount(activeAttackSprite);
            break;
          }
          remaining -= comboDurations[i];
        }
      }

      const playerFrame = isPlayerRunningOut
        ? Math.floor(playerElapsed / FRAME_DURATION_MS) % runFrames
        : isPlayerAttacking
          ? attackFrameIndex
          : isPlayerReturning
            ? Math.floor((playerElapsed - runDuration - comboTotalDuration) / FRAME_DURATION_MS) % runFrames
            : getIdleFrame(now, playerIdleSprite);

      const playerSheet = isPlayerAttacking
        ? activeAttackSprite
        : isPlayerRunningOut || isPlayerReturning
          ? playerRunSprite
          : playerIdleSprite;

      if (playerSide) {
        const runProgress = isPlayerRunningOut
          ? Math.min(1, playerElapsed / runDuration)
          : isPlayerReturning
            ? Math.max(0, 1 - (playerElapsed - runDuration - comboTotalDuration) / playerReturnDuration)
            : isPlayerAttacking
              ? 1
              : 0;
        playerSide.style.transform = `translateX(${runProgress * RUN_OFFSET_PX}px)`;
      }

      const monsterElapsed = now - monsterAttackStartRef.current;
      const isMonsterWalking = monsterElapsed >= 0 && monsterElapsed < monsterWalkDuration;
      const isMonsterAttacking = monsterElapsed >= monsterWalkDuration && monsterElapsed < monsterWalkDuration + monsterAttackDuration;
      const isMonsterReturning =
        monsterElapsed >= monsterWalkDuration + monsterAttackDuration &&
        monsterElapsed < monsterWalkDuration + monsterAttackDuration + monsterReturnDuration;
      const monsterAttackProgress = isMonsterAttacking
        ? Math.min(1, Math.max(0, (monsterElapsed - monsterWalkDuration) / monsterAttackDuration))
        : 0;
      const attackProgress = isPlayerAttacking
        ? Math.min(1, Math.max(0, (playerElapsed - runDuration) / comboTotalDuration))
        : 0;
      const showMonsterHit = isPlayerAttacking && attackProgress >= 0.35;
      const useShieldIdle = monsterShieldSprite && Math.floor(now / (FRAME_DURATION_MS * 8)) % 2 === 1;
      const monsterIdleSheet = useShieldIdle
        ? monsterShieldSprite
        : (monsterIdleSprite || monsterAttackSprite);
      const monsterIdleFrames = getFrameCount(monsterIdleSheet);
      const monsterWalkFrame = isMonsterWalking
        ? Math.floor(monsterElapsed / monsterWalkFrameDuration) % monsterWalkFrames
        : isMonsterReturning
          ? Math.floor((monsterElapsed - monsterWalkDuration - monsterAttackDuration) / monsterWalkFrameDuration) % monsterWalkFrames
          : 0;
      const monsterFrame = isMonsterWalking || isMonsterReturning
        ? monsterWalkFrame
        : isMonsterAttacking
          ? Math.floor((monsterElapsed - monsterWalkDuration) / FRAME_DURATION_MS) % monsterFrames
          : showMonsterHit
            ? Math.floor((playerElapsed - runDuration) / FRAME_DURATION_MS) % monsterHitFrames
            : Math.floor(now / FRAME_DURATION_MS) % monsterIdleFrames;

      if (monsterSide) {
        const monsterProgress = isMonsterWalking
          ? Math.min(1, monsterElapsed / monsterWalkDuration)
          : isMonsterAttacking
            ? 1
            : isMonsterReturning
              ? Math.max(0, 1 - (monsterElapsed - monsterWalkDuration - monsterAttackDuration) / monsterReturnDuration)
              : 0;
        monsterSide.style.transform = `translateX(${-monsterProgress * MONSTER_RUN_OFFSET_PX}px)`;
      }

      const isPlayerReacting = isMonsterAttacking && !isPlayerAttacking && !isPlayerRunningOut && !isPlayerReturning;
      const isPlayerHit = isMonsterAttacking && monsterAttackProgress >= 0.35 && monsterAttackProgress <= 0.6;
      if (playerCanvas) {
        playerCanvas.dataset.hit = isPlayerHit ? '1' : '0';
      }
      if (isPlayerReacting) {
        if (lastMonsterAttackStartRef.current !== monsterAttackStartRef.current) {
          lastMonsterAttackStartRef.current = monsterAttackStartRef.current;
          monsterAttackToggleRef.current = !monsterAttackToggleRef.current;
        }
        const useDefend = monsterAttackToggleRef.current || !playerHurtSprite;
        const reactionSprite = useDefend ? playerDefendSprite : playerHurtSprite;
        const reactionFrame = Math.floor((monsterElapsed - monsterWalkDuration) / FRAME_DURATION_MS) % getFrameCount(reactionSprite);
        drawFrame(playerCanvas, reactionSprite, reactionFrame, PLAYER_SIZE);
      } else {
        drawFrame(playerCanvas, playerSheet, playerFrame, PLAYER_SIZE);
      }
      drawFrame(
        monsterCanvas,
        isMonsterWalking || isMonsterReturning
          ? (monsterWalkSprite || monsterIdleSprite || monsterAttackSprite)
          : isMonsterAttacking
            ? monsterAttackSprite
            : showMonsterHit
              ? (monsterHitSprite || monsterAttackSprite)
              : monsterIdleSheet,
        monsterFrame,
        MONSTER_SIZE
      );

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);
    return () => {
      clearInterval(intervalId);
      cancelAnimationFrame(animationId);
    };
  }, [
    playerIdleSprite,
    playerRunSprite,
    playerAttackSprites,
    playerDefendSprite,
    playerHurtSprite,
    playerRunAttackSprite,
    playerJumpSprite,
    monsterIdleSprite,
    monsterAttackSprite,
    monsterHitSprite,
    monsterWalkSprite,
    monsterShieldSprite,
    PLAYER_SIZE,
    MONSTER_SIZE,
    RUN_OFFSET_PX,
    MONSTER_RUN_OFFSET_PX,
    MONSTER_Y_OFFSET,
    paused,
    questComplete,
    finisherActive,
    showVictory,
  ]);

  const handleComplete = () => {
    if (questComplete) return;
    setQuestComplete(true);

    if (task?.isPomodoro) {
      setCoinsEarned(20);
    } else {
      const startedAt = task?.startedAt || new Date().toISOString();
      gameState.updateTask(task.id, { timeSpent: elapsed, startedAt });
      const result = gameState.completeTask(task.id, { timeSpentMs: elapsed, startedAt });
      setCoinsEarned(result?.coinsEarned || COIN_REWARDS[task.priority] || 20);
    }
    setFinishPrompt(true);
  };

  const handlePause = () => {
    if (paused) {
      // Resume
      startTimeRef.current = performance.now() - elapsed;
      pausedTimeRef.current = 0;
    } else {
      // Pause
      pausedTimeRef.current = performance.now() - startTimeRef.current - elapsed;
    }
    setPaused(!paused);
  };

  const handleVictoryContinue = () => {
    if (task?.id && !task?.isPomodoro) {
      // Ensure the completed quest is removed from the quest board.
      gameState.deleteTask(task.id);
    }
    onComplete();
  };

  const formatTime = (ms) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const remaining = Math.max(0, duration - elapsed);
  const progress = duration > 0 ? elapsed / duration : 0;
  const monsterHealth = isPomodoro && phase === 'break' ? 0 : Math.max(0, (1 - progress) * 100);
  const playerHealth = isPomodoro && phase === 'break' ? Math.max(0, (1 - progress) * 100) : 100;
  const phaseLabel = isPomodoro ? (phase === 'break' ? 'Break' : 'Study') : null;

  const handleMonsterClick = () => {
    if (!finishPrompt || finisherActive || showVictory) return;
    finisherStartRef.current = performance.now();
    finisherHitRef.current = false;
    finisherDoneRef.current = false;
    setMonsterDead(false);
    setFinishPrompt(false);
    setFinisherActive(true);
  };
  const handleToggleMusic = () => {
    setMusicEnabled(!musicEnabled);
  };

  const handleTogglePlaylist = () => {
    setShowPlaylist((prev) => !prev);
  };
  return (
    <div className="screen battle-screen fullscreen">
      <div 
        className={`battle-arena${finisherActive ? ' finisher-zoom' : ''}`}
        style={{
          backgroundImage: `url(${dungeonRoom})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="battle-arena-overlay" />
        {finishPrompt && (
          <div className="finisher-prompt">
            Click the monster to finish it!
          </div>
        )}
        <header className="battle-header">
          <div className="battle-timer">
            <span>{formatTime(remaining)}</span>
          </div>
        </header>

        <div className="battle-health-bars">
          <div className="health-bar-container player-bar">
            <div className="health-bar player-health">
              <div className="health-fill" style={{ width: `${playerHealth}%` }} />
            </div>
          </div>
          <div className="health-bar-container monster-bar">
            <div className="health-bar monster-health">
              <div
                className="health-fill"
                style={{ width: `${monsterHealth}%` }}
              />
            </div>
          </div>
        </div>

        <div className="battle-stage">
          <div className="combatant player-side" ref={playerSideRef}>
            <div className="sprite-container">
              <canvas
                ref={playerCanvasRef}
                className="battle-sprite player-sprite"
                style={{
                  '--sprite-y': `${PLAYER_Y_OFFSET}px`,
                  '--sprite-size': `${PLAYER_SIZE}px`,
                }}
              />
            </div>
          </div>

        <div
            className={`combatant monster-side${monsterDead ? ' dead' : ''}${finishPrompt ? ' clickable' : ''}`}
            ref={monsterSideRef}
            onClick={handleMonsterClick}
            onKeyDown={(event) => {
              if (!finishPrompt) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleMonsterClick();
              }
            }}
            role="button"
            tabIndex={finishPrompt ? 0 : -1}
            aria-label="Monster"
          >
            <div className="sprite-container">
              <canvas
                ref={monsterCanvasRef}
                className="battle-sprite monster-sprite"
                style={{
                  '--sprite-y': `${MONSTER_Y_OFFSET}px`,
                  '--sprite-size': `${MONSTER_SIZE}px`,
                }}
              />
            </div>
          </div>
        </div>

        <button className="btn btn-flee" onClick={handleFlee}>
          ✕ Flee
        </button>

        <div className="battle-controls">
          <button
            className="btn btn-flee btn-icon"
            onClick={handlePause}
            aria-label="Pause"
            disabled={questComplete}
          >
            {paused ? '▶' : '⏸'}
          </button>
          <button
            className="btn btn-flee btn-icon"
            onClick={handleComplete}
            aria-label="Complete"
            disabled={questComplete}
          >
            ✓
          </button>
          <button
            className="btn btn-flee btn-icon"
            type="button"
            onClick={handleToggleMusic}
            aria-label={`Music ${musicEnabled ? 'on' : 'off'}`}
            title={`Music ${musicEnabled ? 'On' : 'Off'}`}
          >
            {musicEnabled ? '🔊' : '🔇'}
          </button>
          <button
            className="btn btn-flee"
            type="button"
            onClick={handleTogglePlaylist}
            aria-label={showPlaylist ? 'Hide playlist' : 'Choose track'}
            title={showPlaylist ? 'Hide playlist' : 'Choose track'}
          >
            {showPlaylist ? 'Hide Playlist' : 'Choose Track'}
          </button>
        </div>

        <div
          className={`soundcloud-player${showPlaylist ? ' is-open' : ''}`}
          role="dialog"
          aria-label="Battle playlist"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowPlaylist(false);
            }
          }}
        >
          <div className="soundcloud-player-card">
            <div className="soundcloud-player-header">
              <span>Choose a track</span>
              <button
                className="soundcloud-player-close"
                type="button"
                onClick={() => setShowPlaylist(false)}
                aria-label="Close playlist"
              >
                ×
              </button>
            </div>
            <iframe
              ref={iframeRef}
              title="SoundCloud battle playlist"
              allow="autoplay; clipboard-write; encrypted-media"
              src={soundCloudWidgetSrc}
            />
          </div>
        </div>

        {/* Victory Overlay */}
        {showVictory && (
          <div className="victory-overlay">
            <div className="victory-content">
              <h2>⚔️ Victory! ⚔️</h2>
              <p>Quest completed!</p>
              <div className="victory-reward">
                <span className="coin-icon">🪙</span>
                <span>+{coinsEarned}</span>
              </div>
              <button className="btn btn-primary" onClick={handleVictoryContinue}>
                Continue
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BattleScreen;
