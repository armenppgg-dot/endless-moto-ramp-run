const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const leftBtn = document.getElementById("btn-left");
const rightBtn = document.getElementById("btn-right");

const GAME = {
  width: canvas.width,
  height: canvas.height,
  laneY: [canvas.height * 0.66, canvas.height * 0.77],
  speed: 5,
  distance: 0,
  gameOver: false,
  started: false,
};

const bike = {
  x: canvas.width * 0.18,
  lane: 0,
  y: GAME.laneY[0],
  targetY: GAME.laneY[0],
  w: canvas.width * 0.14,
  h: canvas.width * 0.07,
  jumping: false,
  jumpT: 0,
  jumpDuration: 38,
  jumpHeight: canvas.height * 0.09,
  wheelSpin: 0,
};

const ramps = [];
let spawnTimer = 0;
let stars = [];

let audioCtx;
let engineOsc;
let engineGain;
let engineFilter;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    engineOsc = audioCtx.createOscillator();
    engineGain = audioCtx.createGain();
    engineFilter = audioCtx.createBiquadFilter();

    engineOsc.type = "sawtooth";
    engineOsc.frequency.setValueAtTime(88, audioCtx.currentTime);
    engineFilter.type = "lowpass";
    engineFilter.frequency.setValueAtTime(320, audioCtx.currentTime);
    engineGain.gain.setValueAtTime(0.0001, audioCtx.currentTime);

    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(audioCtx.destination);
    engineOsc.start();
  }
}

async function ensureAudioStarted() {
  try {
    initAudio();
    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }
    return audioCtx.state === "running";
  } catch {
    // silent fallback for environments where audio is blocked
    return false;
  }
}

function setEngineSound(active) {
  if (!audioCtx || !engineGain || !engineOsc) return;
  const now = audioCtx.currentTime;
  const targetGain = active ? 0.03 : 0.0001;
  const targetFreq = active ? 102 + GAME.speed * 4 : 88;
  engineGain.gain.cancelScheduledValues(now);
  engineGain.gain.setTargetAtTime(targetGain, now, 0.08);
  engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.1);
}

function playTone(freq = 350, duration = 0.07, type = "sine", gainValue = 0.05) {
  try {
    if (!audioCtx || audioCtx.state !== "running") return;
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

function resizeGame() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const nextWidth = Math.max(1, Math.round(rect.width * dpr));
  const nextHeight = Math.max(1, Math.round(rect.height * dpr));

  canvas.width = nextWidth;
  canvas.height = nextHeight;

  GAME.width = canvas.width;
  GAME.height = canvas.height;
  GAME.laneY = [GAME.height * 0.66, GAME.height * 0.77];

  bike.x = GAME.width * 0.18;
  bike.w = GAME.width * 0.14;
  bike.h = GAME.width * 0.07;
  bike.jumpHeight = GAME.height * 0.09;
  bike.y = GAME.laneY[bike.lane];
  bike.targetY = GAME.laneY[bike.lane];

  stars = Array.from({ length: 28 }, () => ({
    x: Math.random() * GAME.width,
    y: GAME.height * 0.05 + Math.random() * GAME.height * 0.22,
    r: 1 + Math.random() * 2,
    s: 0.4 + Math.random() * 0.8,
  }));
}

async function changeLane(direction) {
  if (GAME.gameOver) return;
  await ensureAudioStarted();
  GAME.started = true;
  bike.lane = direction < 0 ? 0 : 1;
  bike.targetY = GAME.laneY[bike.lane];
  playTone(520, 0.05, "triangle", 0.02);
}


function bindAudioUnlock() {
  const unlock = async () => {
    await ensureAudioStarted();
  };

  window.addEventListener("pointerdown", unlock, { passive: true, once: true });
  window.addEventListener("touchstart", unlock, { passive: true, once: true });
}

bindAudioUnlock();

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "a", "A"].includes(event.key)) {
    event.preventDefault();
    changeLane(-1);
  }

  if (["ArrowRight", "d", "D", "ArrowUp", "w", "W", " "].includes(event.key)) {
    event.preventDefault();
    changeLane(1);
  }

  if ((event.key === "r" || event.key === "R") && GAME.gameOver) {
    resetGame();
  }
});

function handleControlPress(event, direction) {
  event.preventDefault();
  if (GAME.gameOver) {
    resetGame();
    return;
  }
  changeLane(direction);
}

function bindTouchButton(button, direction) {
  const onPress = (event) => handleControlPress(event, direction);

  if (window.PointerEvent) {
    button.addEventListener("pointerdown", onPress, { passive: false });
    button.addEventListener("pointerup", (event) => event.preventDefault(), { passive: false });
    button.addEventListener("pointercancel", (event) => event.preventDefault(), { passive: false });
    return;
  }

  button.addEventListener("touchstart", onPress, { passive: false });
  button.addEventListener("touchend", (event) => event.preventDefault(), { passive: false });
  button.addEventListener("touchcancel", (event) => event.preventDefault(), { passive: false });
  button.addEventListener("mousedown", onPress);
}

bindTouchButton(leftBtn, -1);
bindTouchButton(rightBtn, 1);

function spawnRamp() {
  const lane = Math.random() > 0.5 ? 0 : 1;
  ramps.push({
    x: GAME.width + 80,
    lane,
    y: GAME.laneY[lane] - 2,
    w: GAME.width * 0.17,
    h: GAME.height * 0.042,
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
  setEngineSound(false);
  playTone(330, 0.08, "sawtooth", 0.03);
}

function update() {
  if (GAME.gameOver) {
    setEngineSound(false);
    return;
  }

  if (GAME.started) {
    GAME.distance += GAME.speed;
    GAME.speed = Math.min(8.8, 5 + GAME.distance / 4200);
    setEngineSound(true);
  } else {
    setEngineSound(false);
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
      star.y = GAME.height * 0.05 + Math.random() * GAME.height * 0.22;
    }
  }

  for (let i = ramps.length - 1; i >= 0; i -= 1) {
    const ramp = ramps[i];
    ramp.x -= GAME.speed;

    const bikeFront = bike.x + bike.w;
    const bikeRear = bike.x + bike.w * 0.14;
    const rampFront = ramp.x;
    const rampRear = ramp.x + ramp.w;
    const sameLane = ramp.lane === bike.lane;

    if (sameLane && !ramp.climbed && bikeFront > rampFront + 12 && bikeRear < rampRear - 12) {
      ramp.climbed = true;
      bike.jumping = true;
      bike.jumpT = 0;
      playTone(690, 0.09, "square", 0.025);
    }

    if (sameLane && !bike.jumping && bikeRear < rampRear && bikeFront > rampFront + ramp.w * 0.65) {
      GAME.gameOver = true;
      setEngineSound(false);
      playTone(120, 0.25, "sawtooth", 0.05);
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

  const grassTop = GAME.height * 0.48;
  const roadTop = GAME.height * 0.57;
  const laneMarkY = GAME.height * 0.72;

  ctx.fillStyle = "#b1d8a4";
  ctx.fillRect(0, grassTop, GAME.width, GAME.height - grassTop);

  ctx.fillStyle = "#6f7d97";
  ctx.fillRect(0, roadTop, GAME.width, GAME.height - roadTop);

  ctx.strokeStyle = "#dfe6f5";
  ctx.lineWidth = Math.max(4, GAME.width * 0.008);
  ctx.setLineDash([28, 18]);
  ctx.beginPath();
  ctx.moveTo(0, laneMarkY);
  ctx.lineTo(GAME.width, laneMarkY);
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
  ctx.fillRect(bike.x + bike.w * 0.14, y - bike.h + 6, bike.w - bike.w * 0.3, bike.h - 10);

  ctx.fillStyle = "#6c7df2";
  ctx.fillRect(bike.x + bike.w * 0.38, y - bike.h - 7, bike.w * 0.35, 13);

  ctx.strokeStyle = "#2f3b61";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(bike.x + bike.w * 0.3, y - 6);
  ctx.lineTo(bike.x + bike.w * 0.74, y - 18);
  ctx.stroke();

  for (const wx of [bike.x + bike.w * 0.2, bike.x + bike.w * 0.82]) {
    ctx.fillStyle = "#1c2340";
    ctx.beginPath();
    ctx.arc(wx, y, Math.max(10, bike.w * 0.18), 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#9fb0d6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(wx, y, Math.max(6, bike.w * 0.1), bike.wheelSpin, bike.wheelSpin + Math.PI * 1.5);
    ctx.stroke();
  }
}

function drawHUD() {
  const hudW = Math.min(320, GAME.width * 0.62);
  const hudH = 84;
  ctx.fillStyle = "rgba(255,255,255,0.76)";
  ctx.fillRect(16, 14, hudW, hudH);

  ctx.fillStyle = "#2c3550";
  ctx.font = `bold ${Math.max(18, GAME.width * 0.04)}px Segoe UI`;
  ctx.fillText(`Дистанция: ${Math.floor(GAME.distance / 15)} м`, 26, 44);
  ctx.font = `${Math.max(13, GAME.width * 0.025)}px Segoe UI`;
  ctx.fillText("←/→, A/D или кнопки внизу", 26, 68);

  if (GAME.gameOver) {
    ctx.fillStyle = "rgba(25, 30, 50, 0.72)";
    ctx.fillRect(0, 0, GAME.width, GAME.height);

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.max(34, GAME.width * 0.08)}px Segoe UI`;
    ctx.fillText("Столкновение", GAME.width / 2 - GAME.width * 0.21, GAME.height / 2 - 24);
    ctx.font = `${Math.max(20, GAME.width * 0.042)}px Segoe UI`;
    ctx.fillText("Нажми R или кнопку для рестарта", GAME.width / 2 - GAME.width * 0.33, GAME.height / 2 + 18);
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


window.addEventListener("gesturestart", (event) => {
  event.preventDefault();
});

window.addEventListener("touchmove", (event) => {
  event.preventDefault();
}, { passive: false });

window.addEventListener("resize", resizeGame);
resizeGame();
frame();
