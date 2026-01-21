import { useState, useEffect, useRef } from 'react';
import { DUNGEON_ROOMS, MONSTERS } from '../data/constants';

// Component to render only the first frame of a sprite sheet
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
      
      // Calculate frame width based on frame count
      const frameWidth = img.width / frameCount;
      const frameHeight = img.height;
      
      canvas.width = frameWidth;
      canvas.height = frameHeight;
      
      // Draw only first frame
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
        transition: 'opacity 0.2s'
      }}
      title={alt}
    />
  );
}

function CollectionsScreen({ gameState, onBack }) {
  const { player } = gameState;
  const [activeCategory, setActiveCategory] = useState('monsters');

  // Heroes with frame counts - paths match public/assets/ structure
  const heroCollectibles = [
    { id: 'knight-1', name: 'Knight I', src: '/assets/knight-character/Knight_1/Idle.png', frameCount: 4 },
    { id: 'knight-2', name: 'Knight II', src: '/assets/knight-character/Knight_2/Idle.png', frameCount: 4 },
    { id: 'knight-3', name: 'Knight III', src: '/assets/knight-character/Knight_3/Idle.png', frameCount: 4 },
  ];

  // Monster frame counts
  const monsterFrameCounts = {
    goblin: 4,
    skeleton: 4,
    mushroom: 4,
    flying_eye: 8,
  };

  const categoryConfig = {
    monsters: {
      label: 'Monsters',
      items: Object.values(MONSTERS).map((monster) => ({
        id: monster.id,
        name: monster.name,
        src: `${monster.basePath}/${monster.idleSprite}`,
        frameCount: monsterFrameCounts[monster.id] || 4,
      })),
    },
    dungeons: {
      label: 'Dungeons',
      items: DUNGEON_ROOMS.map((room, index) => ({
        id: `dungeon-${index}`,
        name: `Dungeon ${index + 1}`,
        src: room,
        isImage: true, // Not a sprite sheet
      })),
    },
    heroes: {
      label: 'Heroes',
      items: heroCollectibles,
    },
  };

  const activeItems = categoryConfig[activeCategory].items;

  return (
    <div className="screen collections-screen">
      <header className="screen-header">
        <button className="btn btn-back" onClick={onBack}>
          ← Back
        </button>
        <h1>Collectibles</h1>
        <div className="coins-display">
          <span className="coin-icon">🪙</span>
          <span>{player.coins}</span>
        </div>
      </header>

      <div className="collections-wrap">
        <div className="collections-content collections-layout">
          <nav className="collections-sidebar">
            {Object.entries(categoryConfig).map(([key, config]) => (
              <button
                key={key}
                className={`collections-nav-btn ${activeCategory === key ? 'active' : ''}`}
                onClick={() => setActiveCategory(key)}
                type="button"
              >
                {config.label}
              </button>
            ))}
          </nav>

          <section className={`collections-gallery ${activeCategory}`}>
            <h2>{categoryConfig[activeCategory].label}</h2>
            <div className={`collections-grid ${activeCategory}`}>
              {activeItems.map((item) => (
                <div key={item.id} className={`collections-card ${activeCategory}-card`}>
                  <div className="collections-card-frame">
                    {item.isImage ? (
                      <img className="collections-card-img" src={item.src} alt={item.name} />
                    ) : (
                      <SpriteFirstFrame
                        src={item.src}
                        frameCount={item.frameCount}
                        className="collections-card-img"
                        alt={item.name}
                        width={120}
                        height={120}
                      />
                    )}
                  </div>
                  <div className="collections-card-name">{item.name}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default CollectionsScreen;
