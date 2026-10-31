/**
 * Flying Sai - Flappy Bird Style Game
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const soundToggle = document.getElementById('soundToggle');
const soundIcon = document.getElementById('soundIcon');
const introAudio = document.getElementById('introAudio');
const bgm = document.getElementById('bgm');
const gameOverAudio = document.getElementById('gameOverAudio');
const finalScoreEl = document.getElementById('finalScore');
const bestScoreEl = document.getElementById('bestScore');

// Ensure proper volume defaults
if (introAudio) introAudio.volume = 1.0;
if (bgm) bgm.volume = 0.4;
if (gameOverAudio) gameOverAudio.volume = 1.0;

// Game state constants
const STATES = {
  START: 'START',
  PLAYING: 'PLAYING',
  GAMEOVER: 'GAMEOVER'
};

let currentState = STATES.START;
let score = 0;
let highScore = parseInt(localStorage.getItem('flying_sai_highscore') || localStorage.getItem('flying_friend_highscore') || '0', 10);
let frames = 0;
let soundEnabled = true;

// Web Audio API for jump & hit effects
let audioCtx = null;
function initAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
}

function playJumpSound() {
  if (!soundEnabled || !audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(680, audioCtx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
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
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.setValueAtTime(1100, audioCtx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.22);
  } catch (e) {}
}

function playHitSound() {
  if (!soundEnabled || !audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
  } catch (e) {}
}

// Sound toggle handler
soundToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  soundEnabled = !soundEnabled;
  soundIcon.textContent = soundEnabled ? '🔊' : '🔇';
  if (!soundEnabled) {
    if (introAudio) introAudio.pause();
    if (bgm) bgm.pause();
    if (gameOverAudio) gameOverAudio.pause();
  } else {
    if (currentState === STATES.START && introAudio) {
      introAudio.play().catch(() => {});
    } else if (currentState === STATES.PLAYING && bgm) {
      bgm.play().catch(() => {});
    }
  }
});

// Load images
const pillarImg = new Image();
pillarImg.src = 'assets/bg.png'; // Mascot image used on pillars

let processedBirdImg = null;
let birdImageLoaded = false;

// Remove solid black background from bird image dynamically
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

      const visited = new Uint8Array(w * h);
      const queue = [];

      function isBlack(idx) {
        return data[idx] < 38 && data[idx + 1] < 38 && data[idx + 2] < 38;
      }

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
      console.warn('Canvas fallback active:', err);
      processedBirdImg = rawImg;
      birdImageLoaded = true;
    }
  };
}
prepareBirdSprite();

// Cloud generation for clean sky background
const clouds = [
  { x: 40, y: 55, scale: 0.9, speed: 0.35 },
  { x: 190, y: 110, scale: 1.2, speed: 0.45 },
  { x: 330, y: 70, scale: 0.8, speed: 0.3 }
];

// Bird Object - Tuned for easy, pleasant flight
const bird = {
  x: 80,
  y: 260,
  w: 46,
  h: 56,
  velocity: 0,
  gravity: 0.20,        // Soft gravity so it doesn't drop too fast
  jumpStrength: -4.8,   // Easy, controllable flap
  rotation: 0,

  reset() {
    this.x = 80;
    this.y = canvas.height / 2 - 30;
    this.velocity = this.jumpStrength; // Initial upward lift so it starts flyable!
    this.rotation = -0.2;
  },

  flap() {
    this.velocity = this.jumpStrength;
    playJumpSound();
  },

  update() {
    this.velocity += this.gravity;
    this.y += this.velocity;

    // Smooth angle tilt
    if (this.velocity < 0) {
      this.rotation = Math.max(-0.35, (this.velocity / 8) * 0.5);
    } else {
      this.rotation = Math.min(Math.PI / 3, (this.velocity / 10) * 0.7);
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
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 4;
      ctx.drawImage(processedBirdImg, -this.w / 2, -this.h / 2, this.w, this.h);
    } else {
      ctx.fillStyle = '#ffbe1a';
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
};

// Pillars (Pipes) - Uniform generous gaps & enlarged photo caps
const pillars = {
  items: [],
  gap: 195,              // Fixed, wide gap for easy navigation
  width: 76,             // Wider pillars for enlarged photo
  speed: 1.6,            // Slower movement speed so game is easy to play
  spawnInterval: 170,    // Spacious distance between pipes

  reset() {
    this.items = [];
  },

  spawn() {
    // Generate height with guaranteed identical gap size
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
    // Delay first pillar spawn to frame 160 so player gets a relaxed start
    if (frames >= 160 && (frames - 160) % this.spawnInterval === 0) {
      this.spawn();
    }

    for (let i = 0; i < this.items.length; i++) {
      const p = this.items[i];
      p.x -= this.speed;

      // Score
      if (!p.passed && p.x + this.width < bird.x) {
        p.passed = true;
        score++;
        playScoreSound();

        // Music slowly rises in volume as score increases
        if (soundEnabled && bgm) {
          const targetVol = Math.min(1.0, 0.25 + score * 0.06);
          bgm.volume = targetVol;
        }
      }

      // Forgiving hitbox (inner 30% radius of bird)
      const birdRadius = bird.w * 0.30;
      const birdLeft = bird.x - birdRadius;
      const birdRight = bird.x + birdRadius;
      const birdTop = bird.y - birdRadius;
      const birdBottom = bird.y + birdRadius;

      const pLeft = p.x;
      const pRight = p.x + this.width;

      if (birdRight > pLeft && birdLeft < pRight) {
        if (birdTop < p.topHeight || birdBottom > p.bottomY) {
          triggerGameOver();
          return;
        }
      }
    }

    if (this.items.length && this.items[0].x < -this.width - 30) {
      this.items.shift();
    }
  },

  draw() {
    for (let i = 0; i < this.items.length; i++) {
      const p = this.items[i];
      const capH = 68; // Enlarged cap to host enlarged photo

      // Top pipe body
      const gradTop = ctx.createLinearGradient(p.x, 0, p.x + this.width, 0);
      gradTop.addColorStop(0, '#58d358');
      gradTop.addColorStop(0.3, '#75f575');
      gradTop.addColorStop(0.7, '#249c24');
      gradTop.addColorStop(1, '#166e16');

      ctx.fillStyle = gradTop;
      ctx.fillRect(p.x, 0, this.width, p.topHeight);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#0e460e';
      ctx.strokeRect(p.x, 0, this.width, p.topHeight);

      // Top pipe enlarged cap
      const capExtra = 5;
      ctx.fillRect(p.x - capExtra, p.topHeight - capH, this.width + capExtra * 2, capH);
      ctx.strokeRect(p.x - capExtra, p.topHeight - capH, this.width + capExtra * 2, capH);

      // Bottom pipe body
      const btmH = canvas.height - 40 - p.bottomY;
      ctx.fillRect(p.x, p.bottomY, this.width, btmH);
      ctx.strokeRect(p.x, p.bottomY, this.width, btmH);

      // Bottom pipe enlarged cap
      ctx.fillRect(p.x - capExtra, p.bottomY, this.width + capExtra * 2, capH);
      ctx.strokeRect(p.x - capExtra, p.bottomY, this.width + capExtra * 2, capH);

      // ENLARGED PHOTO ON THE PILLAR CAPS
      if (pillarImg.complete && pillarImg.naturalWidth > 0) {
        const photoSize = 60; // Big, enlarged photo badge

        // Top cap photo
        const topPhotoX = p.x + (this.width - photoSize) / 2;
        const topPhotoY = p.topHeight - capH + (capH - photoSize) / 2;
        drawPillarBadge(topPhotoX, topPhotoY, photoSize);

        // Bottom cap photo
        const btmPhotoX = p.x + (this.width - photoSize) / 2;
        const btmPhotoY = p.bottomY + (capH - photoSize) / 2;
        drawPillarBadge(btmPhotoX, btmPhotoY, photoSize);
      }
    }
  }
};

// Draw enlarged photo badge with circular badge border
function drawPillarBadge(x, y, size) {
  ctx.save();
  // Badge background circle
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2 + 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#0e460e';
  ctx.stroke();

  // Clip photo in circle
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(pillarImg, x, y, size, size);
  ctx.restore();
}

// Background - Clean sky, clouds, rolling green hills (NO HAMSTERS)
let bgScroll = 0;
function drawBackground() {
  // Vibrant sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGrad.addColorStop(0, '#38bdf8');
  skyGrad.addColorStop(0.65, '#93c5fd');
  skyGrad.addColorStop(1, '#e0f2fe');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Soft cartoon clouds
  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  for (let c of clouds) {
    if (currentState === STATES.PLAYING) {
      c.x -= c.speed;
      if (c.x < -100) c.x = canvas.width + 50;
    }
    drawCloud(c.x, c.y, c.scale);
  }

  // Distant rolling hills
  ctx.fillStyle = '#86efac';
  ctx.beginPath();
  ctx.moveTo(0, canvas.height - 40);
  ctx.lineTo(0, 440);
  ctx.quadraticCurveTo(100, 410, 200, 445);
  ctx.quadraticCurveTo(300, 475, canvas.width, 435);
  ctx.lineTo(canvas.width, canvas.height - 40);
  ctx.closePath();
  ctx.fill();

  // Near lush green hills
  ctx.fillStyle = '#4ade80';
  ctx.beginPath();
  ctx.moveTo(0, canvas.height - 40);
  ctx.lineTo(0, 470);
  ctx.quadraticCurveTo(120, 440, 240, 475);
  ctx.quadraticCurveTo(340, 495, canvas.width, 460);
  ctx.lineTo(canvas.width, canvas.height - 40);
  ctx.closePath();
  ctx.fill();

  // Moving ground
  const groundHeight = 40;
  const groundY = canvas.height - groundHeight;

  ctx.fillStyle = '#ded895';
  ctx.fillRect(0, groundY, canvas.width, groundHeight);

  // Grass strip
  ctx.fillStyle = '#65a30d';
  ctx.fillRect(0, groundY, canvas.width, 10);
  ctx.fillStyle = '#4d7c0f';
  ctx.fillRect(0, groundY + 10, canvas.width, 3);

  // Ground angled stripes
  ctx.strokeStyle = '#cbb868';
  ctx.lineWidth = 2;
  const stripeOffset = (bgScroll * 1.6) % 24;
  for (let sx = -stripeOffset; sx < canvas.width + 24; sx += 24) {
    ctx.beginPath();
    ctx.moveTo(sx, groundY + 13);
    ctx.lineTo(sx - 10, canvas.height);
    ctx.stroke();
  }
}

function drawCloud(cx, cy, scale) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, 22 * scale, 0, Math.PI * 2);
  ctx.arc(cx + 20 * scale, cy - 10 * scale, 26 * scale, 0, Math.PI * 2);
  ctx.arc(cx + 46 * scale, cy, 20 * scale, 0, Math.PI * 2);
  ctx.arc(cx + 25 * scale, cy + 12 * scale, 18 * scale, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// In-game score
function drawScore() {
  if (currentState !== STATES.PLAYING) return;
  ctx.save();
  ctx.font = '36px "Press Start 2P", monospace';
  ctx.textAlign = 'center';

  ctx.fillStyle = '#000';
  ctx.fillText(score, canvas.width / 2 + 3, 73);

  ctx.fillStyle = '#ffffff';
  ctx.fillText(score, canvas.width / 2, 70);
  ctx.restore();
}

// Start Game
function startGame() {
  initAudio();
  currentState = STATES.PLAYING;
  score = 0;
  frames = 0;
  bird.reset();
  pillars.reset();

  startScreen.classList.remove('active');
  gameOverScreen.classList.remove('active');

  // STOP OPENING SONG IMMEDIATELY ON GAME START
  if (introAudio) {
    introAudio.pause();
    introAudio.currentTime = 0;
    introAudio.onended = null;
  }

  if (gameOverAudio) {
    gameOverAudio.pause();
    gameOverAudio.currentTime = 0;
  }

  // PLAY GAMEPLAY FLYING BGM
  if (soundEnabled && bgm) {
    bgm.currentTime = 0;
    bgm.volume = 0.45;
    bgm.play().catch(() => {});
  }
}

// Trigger Game Over - ALL MUSIC STOPS & GAME OVER AUDIO PLAYS
function triggerGameOver() {
  if (currentState === STATES.GAMEOVER) return;
  currentState = STATES.GAMEOVER;

  // STOP ALL MUSIC IMMEDIATELY
  if (introAudio) {
    introAudio.pause();
  }
  if (bgm) {
    bgm.pause();
  }

  // PLAY GAME OVER AUDIO BITE
  if (soundEnabled && gameOverAudio) {
    gameOverAudio.currentTime = 0;
    gameOverAudio.play().catch(() => {});
  }

  playHitSound();

  if (score > highScore) {
    highScore = score;
    localStorage.setItem('flying_sai_highscore', highScore.toString());
  }

  finalScoreEl.textContent = score;
  bestScoreEl.textContent = highScore;

  setTimeout(() => {
    gameOverScreen.classList.add('active');
  }, 220);
}

// Game loop
function loop() {
  frames++;

  if (currentState === STATES.PLAYING) {
    bgScroll += 1.0;
    bird.update();
    pillars.update();

    // Song slowly rises in volume over time as well
    if (soundEnabled && bgm && bgm.volume < 1.0) {
      bgm.volume = Math.min(1.0, bgm.volume + 0.00015);
    }
  } else if (currentState === STATES.START) {
    // Gentle bobbing before starting
    bird.y = canvas.height / 2 - 20 + Math.sin(frames * 0.06) * 6;
  }

  drawBackground();
  pillars.draw();
  bird.draw();
  drawScore();

  requestAnimationFrame(loop);
}

// Input Handlers - Optimized for zero-latency mobile touch & desktop keys
function handleAction() {
  if (currentState === STATES.START) {
    startGame();
  } else if (currentState === STATES.PLAYING) {
    bird.flap();
  }
}

// Zero-latency mobile touch
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  handleAction();
}, { passive: false });

// Desktop click & non-touch pointers
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch') {
    e.preventDefault();
    handleAction();
  }
});

// Keyboard controls
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

// Auto-play intro audio immediately when opened
function playOpeningAudio() {
  initAudio();
  if (!soundEnabled || !introAudio || currentState !== STATES.START) return;
  introAudio.play().catch(() => {});
}

// Play immediately on execution, DOMContentLoaded, and window load
playOpeningAudio();
window.addEventListener('DOMContentLoaded', playOpeningAudio);
window.addEventListener('load', playOpeningAudio);

// Silent unlock on any touch/click without showing any text
const silentUnlock = () => {
  if (soundEnabled && introAudio && introAudio.paused && currentState === STATES.START) {
    playOpeningAudio();
  }
};
window.addEventListener('pointerdown', silentUnlock, { passive: true });
window.addEventListener('touchstart', silentUnlock, { passive: true });
window.addEventListener('keydown', silentUnlock, { passive: true });

// START GAME: Starts gameplay immediately and stops opening song
startBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  startGame();
});

restartBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  startGame();
});

loop();
