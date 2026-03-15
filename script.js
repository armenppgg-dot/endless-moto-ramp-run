const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const GAME = {
  width: canvas.width,
  height: canvas.height,
  laneY: [395, 455],
  speed: 5,
  distance: 0,
  gameOver: false,
  started: false,
};

const bike = {
  x: 180,
  lane: 0,
  y: GAME.laneY[0],
  targetY: GAME.laneY[0],
  w: 74,
  h: 36,
  jumping: false,
  jumpT: 0,
  jumpDuration: 38,
  jumpHeight: 92,
  wheelSpin: 0,
};

const ramps = [];
let spawnTimer = 0;
let stars = Array.from({ length: 28 }, () => ({
  x: Math.random() * GAME.width,
  y: 40 + Math.random() * 170,
  r: 1 + Math.random() * 2,
  s: 0.4 + Math.random() * 0.8,
}));

let audioCtx;
function playTone(freq = 350, duration = 0.07, type = "sine", gainValue = 0.05) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration);
  } catch {
    // silent fallback for environments where audio is blocked
  }
}

function handleAction() {
  if (GAME.gameOver) return;
  GAME.started = true;
  bike.lane = bike.lane === 0 ? 1 : 0;
  bike.targetY = GAME.laneY[bike.lane];
  playTone(520, 0.05, "triangle");
}

window.addEventListener("keydown", (event) => {
  if (["ArrowUp", "w", "W", " "].includes(event.key)) {
    event.preventDefault();
    handleAction();
  }

  if ((event.key === "r" || event.key === "R") && GAME.gameOver) {
    resetGame();
  }
});

canvas.addEventListener("pointerdown", () => {
  if (GAME.gameOver) {
    resetGame();
  } else {
    handleAction();
  }
});

function spawnRamp() {
  const lane = Math.random() > 0.5 ? 0 : 1;
  ramps.push({
    x: GAME.width + 80,
    lane,
    y: GAME.laneY[lane] - 2,
    w: 92,
    h: 40,
    climbed: false,
  });
}

function resetGame() {
  ramps.length = 0;
  GAME.distance = 0;
  GAME.speed = 5;
  GAME.gameOver = false;
  GAME.started = false;
  spawnTimer = 0;
  bike.lane = 0;
  bike.y = GAME.laneY[0];
  bike.targetY = GAME.laneY[0];
  bike.jumping = false;
  bike.jumpT = 0;
  playTone(330, 0.08, "sawtooth", 0.04);
}

function update() {
  if (GAME.gameOver) return;

  if (GAME.started) {
    GAME.distance += GAME.speed;
    GAME.speed = Math.min(8.8, 5 + GAME.distance / 4200);
  }

  bike.y += (bike.targetY - bike.y) * 0.24;
  bike.wheelSpin += GAME.speed * 0.06;

  spawnTimer -= 1;
  if (spawnTimer <= 0 && GAME.started) {
    spawnRamp();
    spawnTimer = 85 + Math.random() * 55;
  }

  for (const star of stars) {
    star.x -= star.s;
    if (star.x < -4) {
      star.x = GAME.width + Math.random() * 30;
      star.y = 40 + Math.random() * 180;
    }
  }

  for (let i = ramps.length - 1; i >= 0; i -= 1) {
    const ramp = ramps[i];
    ramp.x -= GAME.speed;

    const bikeFront = bike.x + bike.w;
    const bikeRear = bike.x + 10;
    const rampFront = ramp.x;
    const rampRear = ramp.x + ramp.w;
    const sameLane = ramp.lane === bike.lane;

    if (
      sameLane &&
      !ramp.climbed &&
      bikeFront > rampFront + 12 &&
      bikeRear < rampRear - 12
    ) {
      ramp.climbed = true;
      bike.jumping = true;
      bike.jumpT = 0;
      playTone(690, 0.09, "square", 0.035);
    }

    if (sameLane && !bike.jumping && bikeRear < rampRear && bikeFront > rampFront + 60) {
      GAME.gameOver = true;
      playTone(120, 0.25, "sawtooth", 0.07);
    }

    if (ramp.x + ramp.w < -120) {
      ramps.splice(i, 1);
    }
  }

  if (bike.jumping) {
    bike.jumpT += 1;
    if (bike.jumpT >= bike.jumpDuration) {
      bike.jumping = false;
      bike.jumpT = 0;
    }
  }
}

function drawBackground() {
  ctx.fillStyle = "#cce6ff";
  ctx.fillRect(0, 0, GAME.width, GAME.height);

  ctx.fillStyle = "#f8fbff";
  for (const star of stars) {
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#b1d8a4";
  ctx.fillRect(0, 300, GAME.width, 240);

  ctx.fillStyle = "#6f7d97";
  ctx.fillRect(0, 355, GAME.width, 130);

  ctx.strokeStyle = "#dfe6f5";
  ctx.lineWidth = 5;
  ctx.setLineDash([28, 18]);
  ctx.beginPath();
  ctx.moveTo(0, 425);
  ctx.lineTo(GAME.width, 425);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawRamp(ramp) {
  const x = ramp.x;
  const y = ramp.y;

  const gradient = ctx.createLinearGradient(x, y, x + ramp.w, y + ramp.h);
  gradient.addColorStop(0, "#f9cc8b");
  gradient.addColorStop(1, "#f29c6b");

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(x, y + ramp.h);
  ctx.lineTo(x + ramp.w, y + ramp.h);
  ctx.lineTo(x + ramp.w * 0.15, y);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#d57d50";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawBike() {
  const jumpProgress = bike.jumping ? bike.jumpT / bike.jumpDuration : 0;
  const jumpOffset = bike.jumping ? Math.sin(jumpProgress * Math.PI) * bike.jumpHeight : 0;
  const y = bike.y - jumpOffset;

  ctx.fillStyle = "#2f3b61";
  ctx.fillRect(bike.x + 10, y - bike.h + 6, bike.w - 22, bike.h - 10);

  ctx.fillStyle = "#6c7df2";
  ctx.fillRect(bike.x + 28, y - bike.h - 7, 26, 13);

  ctx.strokeStyle = "#2f3b61";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(bike.x + 22, y - 6);
  ctx.lineTo(bike.x + 55, y - 18);
  ctx.stroke();

  for (const wx of [bike.x + 14, bike.x + 60]) {
    ctx.fillStyle = "#1c2340";
    ctx.beginPath();
    ctx.arc(wx, y, 13, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#9fb0d6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(wx, y, 8, bike.wheelSpin, bike.wheelSpin + Math.PI * 1.5);
    ctx.stroke();
  }
}

function drawHUD() {
  ctx.fillStyle = "rgba(255,255,255,0.76)";
  ctx.fillRect(16, 14, 245, 72);

  ctx.fillStyle = "#2c3550";
  ctx.font = "22px Segoe UI";
  ctx.fillText(`Дистанция: ${Math.floor(GAME.distance / 15)} м`, 26, 44);
  ctx.font = "16px Segoe UI";
  ctx.fillText("Нажми ↑/W/Space или тап для смены полосы", 26, 68);

  if (GAME.gameOver) {
    ctx.fillStyle = "rgba(25, 30, 50, 0.72)";
    ctx.fillRect(0, 0, GAME.width, GAME.height);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 48px Segoe UI";
    ctx.fillText("Столкновение", GAME.width / 2 - 155, GAME.height / 2 - 24);
    ctx.font = "24px Segoe UI";
    ctx.fillText("Нажми R или тапни для рестарта", GAME.width / 2 - 188, GAME.height / 2 + 18);
  }
}

function render() {
  drawBackground();
  ramps.forEach(drawRamp);
  drawBike();
  drawHUD();
}

function frame() {
  update();
  render();
  requestAnimationFrame(frame);
}

frame();
