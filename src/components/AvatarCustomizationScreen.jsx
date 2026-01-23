import { useEffect, useRef, useState } from 'react';
import { AVATARS } from '../data/constants';

function SpriteFirstFrame({ src, frameCount = 4, className, alt, width, height }) {
  const canvasRef = useRef(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    const img = new Image();
    img.src = src;
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      const frameWidth = img.width / frameCount;
      const frameHeight = img.height;

      canvas.width = frameWidth;
      canvas.height = frameHeight;
      ctx.clearRect(0, 0, frameWidth, frameHeight);
      ctx.drawImage(img, 0, 0, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
      setLoaded(true);
    };
  }, [src, frameCount]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width: width || 'auto',
        height: height || 'auto',
        imageRendering: 'pixelated',
        opacity: loaded ? 1 : 0,
        transition: 'opacity 0.2s',
      }}
      title={alt}
    />
  );
}

function AvatarCustomizationScreen({ gameState, onBack }) {
  const { player, unlockAvatar, setCurrentAvatar } = gameState;
  const [feedback, setFeedback] = useState('');
  const avatars = Object.values(AVATARS);
  const currentAvatar = AVATARS[player.currentAvatar] || avatars[0];

  const handleSelect = (avatar) => {
    setFeedback('');
    const isUnlocked = player.unlockedAvatars.includes(avatar.id);
    if (isUnlocked) {
      setCurrentAvatar(avatar.id);
      return;
    }
    const result = unlockAvatar(avatar.id, avatar.cost || 0);
    if (result.success) {
      setCurrentAvatar(avatar.id);
    } else {
      setFeedback(result.error || 'Unable to unlock this knight.');
    }
  };

  return (
    <div className="screen customization-screen fullscreen">
      <div className="collections-wrap">
        <header className="screen-header">
          <button className="btn btn-back" onClick={onBack}>
            ← Back
          </button>
          <h1>Customize Knight</h1>
          <div className="coins-display">
            <span className="coin-icon">🪙</span>
            <span>{player.coins}</span>
          </div>
        </header>

        {feedback && <div className="avatar-feedback">{feedback}</div>}

        <div className="collections-content">
          <section className="current-avatar-section">
            <h2>Current Knight</h2>
            <div className="current-avatar-display">
              <div className="avatar-preview-frame">
                {currentAvatar && (
                  <SpriteFirstFrame
                    src={`${currentAvatar.homeBasePath || currentAvatar.basePath}/Idle.png`}
                    frameCount={4}
                    className="avatar-preview"
                    alt={currentAvatar.name}
                    width={240}
                    height={240}
                  />
                )}
              </div>
            </div>
          </section>

          <section className="avatar-grid-section">
            <h2>Choose a Knight</h2>
            <div className="avatar-grid">
              {avatars.map((avatar) => {
                const isUnlocked = player.unlockedAvatars.includes(avatar.id);
                const isSelected = player.currentAvatar === avatar.id;
                return (
                  <button
                    key={avatar.id}
                    type="button"
                    className={`avatar-card${isSelected ? ' selected' : ''}${isUnlocked ? '' : ' locked'}`}
                    onClick={() => handleSelect(avatar)}
                    aria-pressed={isSelected}
                  >
                    <div className="avatar-card-frame">
                      <SpriteFirstFrame
                        src={`${avatar.homeBasePath || avatar.basePath}/Idle.png`}
                        frameCount={4}
                        className="avatar-card-img"
                        alt={avatar.name}
                        width={120}
                        height={120}
                      />
                    </div>
                    <div className="avatar-card-name">{avatar.name}</div>
                    <div className="avatar-card-cost">
                      {isUnlocked ? (
                        isSelected ? (
                          'Selected'
                        ) : (
                          'Tap to use'
                        )
                      ) : (
                        <>
                          <span className="coin-icon">🪙</span>
                          <span>{avatar.cost}</span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default AvatarCustomizationScreen;
