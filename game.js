/**
 * Flying Friend - Flappy Bird Style Game
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const soundToggle = document.getElementById('soundToggle');
const soundIcon = document.getElementById('soundIcon');
const bgm = document.getElementById('bgm');
const finalScoreEl = document.getElementById('finalScore');
const bestScoreEl = document.getElementById('bestScore');

// Game state constants
const STATES = {
  START: 'START',
  PLAYING: 'PLAYING',
  GAMEOVER: 'GAMEOVER'
};

let currentState = STATES.START;
let score = 0;
let highScore = parseInt(localStorage.getItem('flying_friend_highscore') || '0', 10);
let frames = 0;
let soundEnabled = true;

// Web Audio API for snappy jump & hit effects
let audioCtx = null;
function initAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
}

function playTone(freq, type, duration, gainVal = 0.15) {
  if (!soundEnabled || !audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    // Audio context may require interaction
  }
}

function playJumpSound() {
  if (!soundEnabled || !audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(640, audioCtx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
  } catch (e) {}
}

function playScoreSound() {
  if (!soundEnabled || !audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(784, audioCtx.currentTime);
    osc.frequency.setValueAtTime(1046, audioCtx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);
  } catch (e) {}
}

function playHitSound() {
  playTone(150, 'sawtooth', 0.28, 0.3);
}

// Sound toggle handler
soundToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  soundEnabled = !soundEnabled;
  soundIcon.textContent = soundEnabled ? '🔊' : '🔇';
  if (!soundEnabled) {
    bgm.pause();
  } else if (currentState === STATES.PLAYING) {
    bgm.play().catch(() => {});
  }
});

// Load and process images
const bgImg = new Image();
bgImg.src = 'assets/bg.png';

let processedBirdImg = null;
let birdImageLoaded = false;

// Remove solid black background from bird image dynamically using perimeter flood fill
function prepareBirdSprite() {
  const rawImg = new Image();
  rawImg.crossOrigin = 'anonymous';
  rawImg.src = 'assets/bird_raw.jpg';
  rawImg.onload = () => {
    try {
      const off = document.createElement('canvas');
      off.width = rawImg.width;
      off.height = rawImg.height;
      const octx = off.getContext('2d');
      octx.drawImage(rawImg, 0, 0);

      const imgData = octx.getImageData(0, 0, off.width, off.height);
      const data = imgData.data;
      const w = off.width;
      const h = off.height;

      // Flood fill background from edges
      const visited = new Uint8Array(w * h);
      const queue = [];

      function isBlack(idx) {
        // Background is solid black or very dark JPEG noise
        return data[idx] < 38 && data[idx + 1] < 38 && data[idx + 2] < 38;
      }

      // Seed top and bottom edges
      for (let x = 0; x < w; x++) {
        const topIdx = (0 * w + x) * 4;
        if (isBlack(topIdx)) {
          queue.push(x, 0);
          visited[0 * w + x] = 1;
        }
        const btmIdx = ((h - 1) * w + x) * 4;
        if (isBlack(btmIdx)) {
          queue.push(x, h - 1);
          visited[(h - 1) * w + x] = 1;
        }
      }

      // Seed left and right edges
      for (let y = 0; y < h; y++) {
        const leftIdx = (y * w + 0) * 4;
        if (isBlack(leftIdx)) {
          queue.push(0, y);
          visited[y * w + 0] = 1;
        }
        const rightIdx = (y * w + (w - 1)) * 4;
        if (isBlack(rightIdx)) {
          queue.push(w - 1, y);
          visited[y * w + (w - 1)] = 1;
        }
      }

      let head = 0;
      while (head < queue.length) {
        const cx = queue[head++];
        const cy = queue[head++];
        const pIdx = (cy * w + cx) * 4;

        // Transparent
        data[pIdx + 3] = 0;

        const neighbors = [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1]
        ];

        for (let i = 0; i < 4; i++) {
          const nx = neighbors[i][0];
          const ny = neighbors[i][1];
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const nPos = ny * w + nx;
            if (!visited[nPos]) {
              visited[nPos] = 1;
              const nIdx = nPos * 4;
              if (isBlack(nIdx)) {
                queue.push(nx, ny);
              }
            }
          }
        }
      }

      octx.putImageData(imgData, 0, 0);

      processedBirdImg = new Image();
      processedBirdImg.src = off.toDataURL('image/png');
      processedBirdImg.onload = () => {
        birdImageLoaded = true;
        const avatarEl = document.getElementById('avatarPreview');
        if (avatarEl) avatarEl.src = processedBirdImg.src;
      };
    } catch (err) {
      // Fallback: use raw image directly if canvas tainted
      console.warn('Canvas processing fallback active:', err);
      processedBirdImg = rawImg;
      birdImageLoaded = true;
    }
  };
}
prepareBirdSprite();

// Bird Object
const bird = {
  x: 75,
  y: 250,
  w: 48,
  h: 58,
  velocity: 0,
  gravity: 0.28,
  jumpStrength: -6.2,
  rotation: 0,

  reset() {
    this.x = 75;
    this.y = canvas.height / 2 - 25;
    this.velocity = 0;
    this.rotation = 0;
  },

  flap() {
    this.velocity = this.jumpStrength;
    playJumpSound();
  },

  update() {
    this.velocity += this.gravity;
    this.y += this.velocity;

    // Smooth rotation based on velocity
    if (this.velocity < 0) {
      this.rotation = Math.max(-0.45, (this.velocity / 10) * 0.7);
    } else {
      this.rotation = Math.min(Math.PI / 2.5, (this.velocity / 12) * 0.9);
    }

    // Floor collision
    if (this.y + this.h / 2 >= canvas.height - 40) {
      this.y = canvas.height - 40 - this.h / 2;
      triggerGameOver();
    }

    // Ceiling clamp
    if (this.y - this.h / 2 <= 0) {
      this.y = this.h / 2;
      this.velocity = 0;
    }
  },

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    if (birdImageLoaded && processedBirdImg) {
      // Draw shadow
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 6;
      ctx.drawImage(processedBirdImg, -this.w / 2, -this.h / 2, this.w, this.h);
      ctx.shadowColor = 'transparent';
    } else {
      // Fallback placeholder while loading
      ctx.fillStyle = '#ffbe1a';
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
};

// Pillars (Pipes)
const pillars = {
  items: [],
  gap: 155,
  width: 64,
  speed: 2.2,
  spawnInterval: 120, // frames

  reset() {
    this.items = [];
  },

  spawn() {
    const minTop = 60;
    const maxTop = canvas.height - 40 - this.gap - minTop;
    const topHeight = Math.floor(Math.random() * (maxTop - minTop + 1)) + minTop;
    this.items.push({
      x: canvas.width,
      topHeight: topHeight,
      bottomY: topHeight + this.gap,
      passed: false
    });
  },

  update() {
    if (frames % this.spawnInterval === 0) {
      this.spawn();
    }

    for (let i = 0; i < this.items.length; i++) {
      const p = this.items[i];
      p.x -= this.speed;

      // Score counter
      if (!p.passed && p.x + this.width < bird.x) {
        p.passed = true;
        score++;
        playScoreSound();
      }

      // Collision detection with bird (circle/hitbox approximation)
      const birdRadius = bird.w * 0.38;
      const birdLeft = bird.x - birdRadius;
      const birdRight = bird.x + birdRadius;
      const birdTop = bird.y - birdRadius;
      const birdBottom = bird.y + birdRadius;

      const pLeft = p.x;
      const pRight = p.x + this.width;

      if (birdRight > pLeft && birdLeft < pRight) {
        // Hit top pipe or bottom pipe
        if (birdTop < p.topHeight || birdBottom > p.bottomY) {
          triggerGameOver();
          return;
        }
      }
    }

    // Remove offscreen pillars
    if (this.items.length && this.items[0].x < -this.width - 20) {
      this.items.shift();
    }
  },

  draw() {
    for (let i = 0; i < this.items.length; i++) {
      const p = this.items[i];

      // Top pipe gradient
      const gradTop = ctx.createLinearGradient(p.x, 0, p.x + this.width, 0);
      gradTop.addColorStop(0, '#5ee65e');
      gradTop.addColorStop(0.3, '#73f573');
      gradTop.addColorStop(0.7, '#2cb02c');
      gradTop.addColorStop(1, '#1b781b');

      ctx.fillStyle = gradTop;
      ctx.fillRect(p.x, 0, this.width, p.topHeight);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#0d480d';
      ctx.strokeRect(p.x, 0, this.width, p.topHeight);

      // Top pipe rim/cap
      const capHeight = 24;
      const capExtra = 4;
      ctx.fillRect(p.x - capExtra, p.topHeight - capHeight, this.width + capExtra * 2, capHeight);
      ctx.strokeRect(p.x - capExtra, p.topHeight - capHeight, this.width + capExtra * 2, capHeight);

      // Bottom pipe
      const btmHeight = canvas.height - 40 - p.bottomY;
      ctx.fillRect(p.x, p.bottomY, this.width, btmHeight);
      ctx.strokeRect(p.x, p.bottomY, this.width, btmHeight);

      // Bottom pipe rim/cap
      ctx.fillRect(p.x - capExtra, p.bottomY, this.width + capExtra * 2, capHeight);
      ctx.strokeRect(p.x - capExtra, p.bottomY, this.width + capExtra * 2, capHeight);

      // Stamp 2nd image (mascot logo) onto the pillar caps
      if (bgImg.complete && bgImg.naturalWidth > 0) {
        const badgeSize = 28;
        // Top badge
        ctx.drawImage(
          bgImg,
          p.x + (this.width - badgeSize) / 2,
          p.topHeight - capHeight + (capHeight - badgeSize) / 2,
          badgeSize,
          badgeSize
        );
        // Bottom badge
        ctx.drawImage(
          bgImg,
          p.x + (this.width - badgeSize) / 2,
          p.bottomY + (capHeight - badgeSize) / 2,
          badgeSize,
          badgeSize
        );
      }
    }
  }
};

// Background parallax & styling
let bgScroll = 0;
function drawBackground() {
  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGrad.addColorStop(0, '#4fc3f7');
  skyGrad.addColorStop(0.65, '#b3e5fc');
  skyGrad.addColorStop(1, '#e1f5fe');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Floating background motifs using Image 2
  if (bgImg.complete && bgImg.naturalWidth > 0) {
    ctx.save();
    ctx.globalAlpha = 0.22;
    const bgTileW = 90;
    const bgTileH = 90;
    const offset = (bgScroll * 0.4) % (bgTileW + 40);

    for (let bx = -offset; bx < canvas.width + bgTileW; bx += bgTileW + 40) {
      ctx.drawImage(bgImg, bx, 120, bgTileW, bgTileH);
      ctx.drawImage(bgImg, bx + 60, 260, bgTileW * 0.8, bgTileH * 0.8);
    }
    ctx.restore();
  }

  // City / Hill Silhouettes in background
  ctx.fillStyle = '#90caf9';
  ctx.beginPath();
  ctx.moveTo(0, canvas.height - 40);
  ctx.lineTo(0, 430);
  ctx.quadraticCurveTo(80, 400, 160, 440);
  ctx.quadraticCurveTo(240, 480, 320, 420);
  ctx.quadraticCurveTo(380, 390, canvas.width, 430);
  ctx.lineTo(canvas.width, canvas.height - 40);
  ctx.closePath();
  ctx.fill();

  // Moving ground
  const groundHeight = 40;
  const groundY = canvas.height - groundHeight;

  // Ground base
  ctx.fillStyle = '#ded895';
  ctx.fillRect(0, groundY, canvas.width, groundHeight);

  // Grass top border
  ctx.fillStyle = '#73bf2e';
  ctx.fillRect(0, groundY, canvas.width, 10);
  ctx.fillStyle = '#5c9e24';
  ctx.fillRect(0, groundY + 10, canvas.width, 3);

  // Ground stripes
  ctx.strokeStyle = '#cbb868';
  ctx.lineWidth = 2;
  const stripeOffset = (bgScroll * 2) % 24;
  for (let sx = -stripeOffset; sx < canvas.width + 24; sx += 24) {
    ctx.beginPath();
    ctx.moveTo(sx, groundY + 13);
    ctx.lineTo(sx - 10, canvas.height);
    ctx.stroke();
  }
}

// In-game score display
function drawScore() {
  if (currentState !== STATES.PLAYING) return;
  ctx.save();
  ctx.font = '36px "Press Start 2P", monospace';
  ctx.textAlign = 'center';

  // Shadow / Outline
  ctx.fillStyle = '#000';
  ctx.fillText(score, canvas.width / 2 + 3, 73);

  // Main Text
  ctx.fillStyle = '#ffffff';
  ctx.fillText(score, canvas.width / 2, 70);
  ctx.restore();
}

// Game State Transitions
function startGame() {
  initAudio();
  currentState = STATES.PLAYING;
  score = 0;
  frames = 0;
  bird.reset();
  pillars.reset();

  startScreen.classList.remove('active');
  gameOverScreen.classList.remove('active');

  if (soundEnabled) {
    bgm.currentTime = 0;
    bgm.play().catch(() => {});
  }
}

function triggerGameOver() {
  if (currentState === STATES.GAMEOVER) return;
  currentState = STATES.GAMEOVER;
  playHitSound();

  if (score > highScore) {
    highScore = score;
    localStorage.setItem('flying_friend_highscore', highScore.toString());
  }

  finalScoreEl.textContent = score;
  bestScoreEl.textContent = highScore;

  // Show Game Over Screen
  setTimeout(() => {
    gameOverScreen.classList.add('active');
  }, 250);
}

// Main game loop
function loop() {
  frames++;

  if (currentState === STATES.PLAYING) {
    bgScroll += 1.2;
    bird.update();
    pillars.update();
  } else if (currentState === STATES.START) {
    // Gentle bobbing animation for bird on start screen
    bird.y = canvas.height / 2 + Math.sin(frames * 0.08) * 8;
  }

  // Draw everything
  drawBackground();
  pillars.draw();
  bird.draw();
  drawScore();

  requestAnimationFrame(loop);
}

// Input Handlers
function handleAction() {
  if (currentState === STATES.START) {
    startGame();
  } else if (currentState === STATES.PLAYING) {
    bird.flap();
  }
}

// Touch and click on canvas
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  handleAction();
});

// Keyboard controls (Space / Arrow Up)
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.key === ' ' || e.code === 'ArrowUp') {
    e.preventDefault();
    handleAction();
  }
});

startBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  startGame();
});

restartBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  startGame();
});

// Run loop
loop();
