// ====================== INITIALIZATION ======================
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const display = document.getElementById('display');
const soundCheck = document.getElementById('soundCheckbox');
const speedSelect = document.getElementById('speedSelect');

const resetBtn = document.getElementById('resetBtn');
const randomBtn = document.getElementById('randomBtn');
const showBtn = document.getElementById('showBtn');
const addBtn = document.getElementById('addBtn');

// ====================== CONSTANTS ======================
const NUM_COLUMNS = 9;
const LEFT_GAP = 36;
const COL_WIDTH = 62;
const START_X = LEFT_GAP;

const BEAD_W = 40;
const BEAD_H = 26;
const BEAD_HALF_H = BEAD_H / 2; // 13

const BEAM_Y = 110;
const BEAM_BOTTOM = BEAM_Y + 31; // 141

const HEAVEN_OFF_Y = 48;
const HEAVEN_ON_Y = 95;

const BOTTOM_RAIL = 348; // canvas.height - 32

// Earth beads
const ACTIVE_TOP = BEAM_BOTTOM + 3; // 144
const ACTIVE_CENTRES = [
    ACTIVE_TOP + BEAD_HALF_H,               // 157
    ACTIVE_TOP + BEAD_HALF_H + BEAD_H,      // 183
    ACTIVE_TOP + BEAD_HALF_H + 2 * BEAD_H,    // 209
    ACTIVE_TOP + BEAD_HALF_H + 3 * BEAD_H     // 235
];

const INACTIVE_BOTTOM = BOTTOM_RAIL - 4;      // 344
const INACTIVE_CENTRES = [
    INACTIVE_BOTTOM - BEAD_HALF_H - 3 * BEAD_H, // 344-13-78 = 253
    INACTIVE_BOTTOM - BEAD_HALF_H - 2 * BEAD_H, // 279
    INACTIVE_BOTTOM - BEAD_HALF_H - BEAD_H,   // 305
    INACTIVE_BOTTOM - BEAD_HALF_H             // 331
];

const EARTH_ACTIVE_Y = ACTIVE_CENTRES;   // [157, 183, 209, 235]
const EARTH_INACTIVE_Y = INACTIVE_CENTRES; // [253, 279, 305, 331]

// Colors
const FRAME_COLOR = '#1c1c1c';
const INNER_PANEL = '#252525';
const BEAM_BASE = '#5a3e2b';
const BEAM_HIGHLIGHT = '#8b6b4c';
const BEAM_SHADOW = '#3d2b1c';
const ROD_BASE = '#9e9e9e';
const ROD_SHINE = '#e8e8e8';

function getWoodGradient(x, y, w, h) {
    const grad = ctx.createLinearGradient(x - w / 2, y - h / 2, x + w / 2, y + h / 2);
    grad.addColorStop(0, '#e9b56e');
    grad.addColorStop(0.4, '#c98f4e');
    grad.addColorStop(0.6, '#b87a3a');
    grad.addColorStop(1, '#9e622c');
    return grad;
}

// ====================== STATE ======================
let columnStates = Array.from({ length: NUM_COLUMNS }, () => ({
    heavenActive: false,
    earthCount: 0
}));

let dragged = null;
let hasMoved = false;
let dragStart = { x: 0, y: 0 };
const DRAG_THRESHOLD = 5;

let lastTapTime = 0;
const DOUBLE_TAP_DELAY = 300;

let swipeStartY = 0;
let swipeStartTime = 0;
const SWIPE_VELOCITY_THRESHOLD = 0.5;

let isAnimating = false;

let audioCtx = null;
function playTick() {
    if (!soundCheck.checked) return;
    if (!audioCtx) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            return;
        }
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 600;
    gain.gain.value = 0.1;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
}

function vibrate() {
    if (soundCheck.checked && navigator.vibrate) {
        navigator.vibrate(10);
    }
}

// ====================== HELPER FUNCTIONS ======================
function getEarthYs(earthCount) {
    const n = Math.max(0, Math.min(4, earthCount));
    const m = 4 - n;
    const ys = new Array(4);
    for (let k = 0; k < n; k++) ys[k] = EARTH_ACTIVE_Y[k];
    if (m > 0) {
        const startSlot = 4 - m;
        for (let i = 0; i < m; i++) {
            ys[n + i] = EARTH_INACTIVE_Y[startSlot + i];
        }
    }
    return ys;
}

function drawBead(x, y) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 6;

    const woodGrad = getWoodGradient(x, y, BEAD_W, BEAD_H);
    ctx.fillStyle = woodGrad;
    ctx.beginPath();
    ctx.moveTo(x - BEAD_W / 2, y);
    ctx.lineTo(x, y - BEAD_H / 2);
    ctx.lineTo(x + BEAD_W / 2, y);
    ctx.lineTo(x, y + BEAD_H / 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#8b5a3a';
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(x - BEAD_W / 2 + 4, y + 2);
    ctx.lineTo(x, y - BEAD_H / 2 + 5);
    ctx.lineTo(x + BEAD_W / 2 - 4, y + 2);
    ctx.lineTo(x, y + BEAD_H / 2 - 5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffe9b8';
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(x - BEAD_W / 2 + 8, y - 4);
    ctx.lineTo(x - 3, y - BEAD_H / 2 + 6);
    ctx.lineTo(x + 3, y - BEAD_H / 2 + 6);
    ctx.lineTo(x + BEAD_W / 2 - 8, y - 4);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#3c2c1f';
    ctx.beginPath();
    ctx.ellipse(x, y, 4, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function draw() {
    ctx.fillStyle = FRAME_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = INNER_PANEL;
    ctx.fillRect(18, 24, canvas.width - 36, canvas.height - 48);

    ctx.fillStyle = FRAME_COLOR;
    ctx.fillRect(18, 18, canvas.width - 36, 14);
    ctx.fillRect(18, canvas.height - 32, canvas.width - 36, 14);

    // Rods first
    for (let i = 0; i < NUM_COLUMNS; i++) {
        const x = START_X + i * COL_WIDTH;
        ctx.strokeStyle = ROD_BASE;
        ctx.lineWidth = 5.4;
        ctx.beginPath();
        ctx.moveTo(x, 36);
        ctx.lineTo(x, canvas.height - 36);
        ctx.stroke();

        ctx.strokeStyle = ROD_SHINE;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(x - 1.2, 36);
        ctx.lineTo(x - 1.2, canvas.height - 36);
        ctx.stroke();
    }

    // Beam on top of rods
    ctx.fillStyle = BEAM_BASE;
    ctx.fillRect(30, BEAM_Y, canvas.width - 60, 31);
    ctx.fillStyle = BEAM_HIGHLIGHT;
    ctx.fillRect(30, BEAM_Y, canvas.width - 60, 6);
    ctx.fillStyle = BEAM_SHADOW;
    ctx.fillRect(30, BEAM_Y + 25, canvas.width - 60, 4);

    // Unit markers
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < NUM_COLUMNS; i++) {
        if (i % 3 === 0) {
            const x = START_X + i * COL_WIDTH;
            ctx.beginPath();
            ctx.arc(x, BEAM_Y + 15, 4, 0, 2 * Math.PI);
            ctx.fill();
        }
    }

    // Beads and digits (always on top)
    ctx.textAlign = 'center';
    ctx.font = '700 22px monospace';
    ctx.fillStyle = '#f5e8c7';

    for (let i = 0; i < NUM_COLUMNS; i++) {
        const x = START_X + i * COL_WIDTH;
        const state = columnStates[i];

        let hy = state.heavenActive ? HEAVEN_ON_Y : HEAVEN_OFF_Y;
        if (dragged && dragged.col === i && dragged.type === 'heaven') {
            hy = Math.max(HEAVEN_OFF_Y, Math.min(HEAVEN_ON_Y, dragged.currentY));
        }
        drawBead(x, hy);

        const earthYs = getEarthYs(state.earthCount);
        for (let k = 0; k < 4; k++) {
            let ey = earthYs[k];
            if (dragged && dragged.col === i && dragged.type === 'earth' && dragged.beadIndex === k) {
                ey = dragged.currentY;
            }
            drawBead(x, ey);
        }

        const val = (state.heavenActive ? 5 : 0) + state.earthCount;
        ctx.fillText(val.toString(), x, canvas.height - 10);
    }
}

function getTotal() {
    let total = 0;
    for (let i = 0; i < NUM_COLUMNS; i++) {
        const state = columnStates[i];
        const val = (state.heavenActive ? 5 : 0) + state.earthCount;
        total += val * Math.pow(10, NUM_COLUMNS - 1 - i);
    }
    return total;
}

function updateDisplay() {
    display.textContent = getTotal().toLocaleString('en-US');
}

function getColumnValue(col) {
    const state = columnStates[col];
    return (state.heavenActive ? 5 : 0) + state.earthCount;
}

function setColumnValue(col, value) {
    if (col < 0 || col >= NUM_COLUMNS) return;
    const v = Math.min(9, Math.max(0, value));
    columnStates[col].heavenActive = v >= 5;
    columnStates[col].earthCount = v >= 5 ? v - 5 : v;
    playTick();
    vibrate();
    draw();
    updateDisplay();
}

function clearColumn(col) {
    setColumnValue(col, 0);
}

// ====================== ANIMATION (with speed factor) ======================
function getBaseDelay() {
    const speed = parseFloat(speedSelect.value);
    return 1000 / speed;
}

function animateToNumber(targetNumber, direction, callback) {
    if (isAnimating) return;

    if (targetNumber === 0) {
        if (callback) callback();
        return;
    }

    isAnimating = true;
    resetBtn.disabled = true;
    randomBtn.disabled = true;
    showBtn.disabled = true;
    addBtn.disabled = true;

    let numStr = targetNumber.toString().padStart(NUM_COLUMNS, '0').slice(-NUM_COLUMNS);

    let firstNonZero = 0;
    if (direction === 'ltr') {
        while (firstNonZero < NUM_COLUMNS && numStr[firstNonZero] === '0') {
            firstNonZero++;
        }
        if (firstNonZero >= NUM_COLUMNS) {
            isAnimating = false;
            resetBtn.disabled = false;
            randomBtn.disabled = false;
            showBtn.disabled = false;
            addBtn.disabled = false;
            if (callback) callback();
            return;
        }
    }

    let indices;
    if (direction === 'ltr') {
        indices = [];
        for (let i = firstNonZero; i < NUM_COLUMNS; i++) {
            indices.push(i);
        }
    } else {
        indices = Array.from({ length: NUM_COLUMNS }, (_, i) => NUM_COLUMNS - 1 - i);
    }

    let i = 0;
    const delay = getBaseDelay();

    function next() {
        if (i >= indices.length) {
            isAnimating = false;
            resetBtn.disabled = false;
            randomBtn.disabled = false;
            showBtn.disabled = false;
            addBtn.disabled = false;
            if (callback) callback();
            return;
        }
        const col = indices[i];
        const digit = parseInt(numStr[col], 10);
        setColumnValue(col, digit);
        i++;
        setTimeout(next, delay);
    }
    next();
}

// ====================== STEPWISE ADDITION/SUBTRACTION ======================
function borrowOneFromLeft(col, tempVals, ops) {
    if (col < 0) {
        console.warn("Cannot borrow from left of leftmost column – underflow");
        return;
    }
    let leftVal = tempVals[col];
    if (leftVal > 0) {
        tempVals[col] = leftVal - 1;
        ops.push({ col, value: tempVals[col] });
    } else {
        borrowOneFromLeft(col - 1, tempVals, ops);
        tempVals[col] = 9;
        ops.push({ col, value: 9 });
    }
}

function performStepwiseOperation(b, op, onComplete) {
    let bStr = b.toString().padStart(NUM_COLUMNS, '0').slice(-NUM_COLUMNS);
    let operations = [];
    let tempVals = [];
    for (let i = 0; i < NUM_COLUMNS; i++) {
        tempVals.push(getColumnValue(i));
    }

    for (let i = 0; i < NUM_COLUMNS; i++) {
        let digit = parseInt(bStr[i], 10);
        if (digit === 0) continue;

        if (op === '+') {
            let col = i;
            let carry = digit;
            while (carry > 0) {
                let cur = tempVals[col];
                let sum = cur + carry;
                if (sum < 10) {
                    tempVals[col] = sum;
                    operations.push({ col, value: sum });
                    carry = 0;
                } else {
                    tempVals[col] = sum - 10;
                    operations.push({ col, value: sum - 10 });
                    carry = 1;
                    col--;
                    if (col < 0) {
                        console.warn("Overflow");
                        carry = 0;
                    }
                }
            }
        } else { // subtraction
            let col = i;
            let need = digit;
            while (need > 0) {
                let cur = tempVals[col];
                if (cur >= need) {
                    tempVals[col] = cur - need;
                    operations.push({ col, value: tempVals[col] });
                    need = 0;
                } else {
                    if (col === 0) {
                        console.warn("Underflow (result negative) – setting to 0");
                        tempVals[col] = 0;
                        operations.push({ col, value: 0 });
                        need = 0;
                    } else {
                        borrowOneFromLeft(col - 1, tempVals, operations);
                        tempVals[col] = cur + 10;
                    }
                }
            }
        }
    }

    if (operations.length === 0) {
        onComplete();
        return;
    }

    isAnimating = true;
    resetBtn.disabled = true;
    randomBtn.disabled = true;
    showBtn.disabled = true;
    addBtn.disabled = true;

    let idx = 0;
    const delay = getBaseDelay();

    function nextOp() {
        if (idx >= operations.length) {
            isAnimating = false;
            resetBtn.disabled = false;
            randomBtn.disabled = false;
            showBtn.disabled = false;
            addBtn.disabled = false;
            if (onComplete) onComplete();
            return;
        }
        let op = operations[idx];
        setColumnValue(op.col, op.value);
        idx++;
        setTimeout(nextOp, delay);
    }
    nextOp();
}

// ====================== PUBLIC API ======================
window.clearAbacus = function () {
    if (isAnimating) return;
    columnStates = Array.from({ length: NUM_COLUMNS }, () => ({
        heavenActive: false,
        earthCount: 0
    }));
    playTick();
    vibrate();
    draw();
    updateDisplay();
};

window.randomize = function () {
    if (isAnimating) return;
    columnStates = Array.from({ length: NUM_COLUMNS }, () => ({
        heavenActive: Math.random() > 0.5,
        earthCount: Math.floor(Math.random() * 5)
    }));
    playTick();
    vibrate();
    draw();
    updateDisplay();
};

window.showMeNumber = function () {
    if (isAnimating) return;
    clearAbacus();
    const input = document.getElementById('showNumber');
    let num = parseInt(input.value, 10);
    if (isNaN(num) || num < 0) num = 0;
    animateToNumber(num, 'ltr');
};

window.addNumbers = function () {
    if (isAnimating) return;
    const a = parseInt(document.getElementById('add1').value, 10) || 0;
    const b = parseInt(document.getElementById('add2').value, 10) || 0;
    const op = document.getElementById('operation').value;

    if (op === '-' && a < b) {
        alert('Cannot subtract: result would be negative.');
        return;
    }

    clearAbacus();

    animateToNumber(a, 'ltr', function () {
        performStepwiseOperation(b, op, function () { });
    });
};

// ====================== PRECISION HIT DETECTION ======================
function getColumnFromXY(mx, my) {
    const candidates = [];

    for (let i = 0; i < NUM_COLUMNS; i++) {
        const x = START_X + i * COL_WIDTH;
        const dx = Math.abs(mx - x);
        if (dx > BEAD_W / 2 + 10) continue;

        let hy = columnStates[i].heavenActive ? HEAVEN_ON_Y : HEAVEN_OFF_Y;
        let top = hy - BEAD_HALF_H;
        let bottom = hy + BEAD_HALF_H;
        if (my >= top && my <= bottom) {
            candidates.push({ col: i, type: 'heaven', index: -1, dy: Math.abs(my - hy) });
        }

        const earthYs = getEarthYs(columnStates[i].earthCount);
        for (let j = 0; j < 4; j++) {
            const ey = earthYs[j];
            top = ey - BEAD_HALF_H;
            bottom = ey + BEAD_HALF_H;
            if (my >= top && my <= bottom) {
                candidates.push({ col: i, type: 'earth', index: j, dy: Math.abs(my - ey) });
            }
        }
    }

    if (candidates.length > 0) {
        candidates.sort((a, b) => a.dy - b.dy);
        return candidates[0];
    }

    const HIT_RADIUS_BASE = Math.max(BEAD_W, BEAD_H) / 2 + 15;
    const isTouch = 'ontouchstart' in window;
    const HIT_RADIUS = isTouch ? HIT_RADIUS_BASE + 10 : HIT_RADIUS_BASE;

    let best = null;
    let bestDistSq = HIT_RADIUS * HIT_RADIUS;

    for (let i = 0; i < NUM_COLUMNS; i++) {
        const x = START_X + i * COL_WIDTH;

        let hy = columnStates[i].heavenActive ? HEAVEN_ON_Y : HEAVEN_OFF_Y;
        let dx = mx - x;
        let dy = my - hy;
        let distSq = dx * dx + dy * dy;
        if (distSq < bestDistSq) {
            bestDistSq = distSq;
            best = { col: i, type: 'heaven', index: -1 };
        }

        const earthYs = getEarthYs(columnStates[i].earthCount);
        for (let j = 0; j < 4; j++) {
            const ey = earthYs[j];
            dx = mx - x;
            dy = my - ey;
            distSq = dx * dx + dy * dy;
            if (distSq < bestDistSq) {
                bestDistSq = distSq;
                best = { col: i, type: 'earth', index: j };
            }
        }
    }
    return best;
}

// ====================== POINTER EVENT HANDLING ======================
function handlePointerDown(e) {
    if (isAnimating) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    dragStart = { x: mx, y: my };
    swipeStartY = my;
    swipeStartTime = performance.now();

    const hit = getColumnFromXY(mx, my);
    if (hit) {
        if (hit.type === 'heaven') {
            dragged = { col: hit.col, type: 'heaven', currentY: my, startY: my };
        } else {
            dragged = { col: hit.col, type: 'earth', beadIndex: hit.index, currentY: my, startY: my };
        }
        hasMoved = false;
    } else {
        dragged = null;
    }
    canvas.setPointerCapture(e.pointerId);
}

function handlePointerMove(e) {
    if (!dragged || isAnimating) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const my = e.clientY - rect.top;
    const dx = e.clientX - rect.left - dragStart.x;
    const dy = my - dragStart.y;

    if (!hasMoved && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
        hasMoved = true;
    }

    if (hasMoved) {
        if (dragged.type === 'heaven') {
            dragged.currentY = Math.max(HEAVEN_OFF_Y, Math.min(HEAVEN_ON_Y, my));
        } else {
            dragged.currentY = Math.max(110, Math.min(canvas.height - 36, my));
        }
        draw();
    }
}

function handlePointerUp(e) {
    if (!dragged || isAnimating) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const my = e.clientY - rect.top;
    const now = performance.now();
    const dt = now - swipeStartTime;
    const dy = my - swipeStartY;
    const speed = Math.abs(dy) / dt;

    // Swipe detection
    if (speed > SWIPE_VELOCITY_THRESHOLD && Math.abs(dy) > 30) {
        if (dy < 0) {
            setColumnValue(dragged.col, 9);
        } else {
            setColumnValue(dragged.col, 0);
        }
        dragged = null;
        hasMoved = false;
        draw();
        updateDisplay();
        return;
    }

    // Double‑tap detection
    const nowTime = Date.now();
    if (nowTime - lastTapTime < DOUBLE_TAP_DELAY) {
        clearColumn(dragged.col);
        lastTapTime = 0;
        dragged = null;
        hasMoved = false;
        draw();
        updateDisplay();
        return;
    }
    lastTapTime = nowTime;

    if (!hasMoved) {
        // Click/tap – no movement
        if (dragged.type === 'heaven') {
            columnStates[dragged.col].heavenActive = !columnStates[dragged.col].heavenActive;
        } else {
            const beadIdx = dragged.beadIndex;
            const currentEarth = columnStates[dragged.col].earthCount;
            const isActive = beadIdx < currentEarth;

            if (isActive) {
                columnStates[dragged.col].earthCount = beadIdx;
            } else {
                columnStates[dragged.col].earthCount = beadIdx + 1;
            }
        }
        playTick();
        vibrate();
    } else {
        // Drag end – determine new state based on final position
        if (dragged.type === 'heaven') {
            const mid = (HEAVEN_OFF_Y + HEAVEN_ON_Y) / 2;
            columnStates[dragged.col].heavenActive = dragged.currentY > mid;
        } else {
            const j = dragged.beadIndex;
            const activeY = EARTH_ACTIVE_Y[j];
            const inactiveY = EARTH_INACTIVE_Y[j];
            const mid = (activeY + inactiveY) / 2;
            const isUp = dragged.currentY < mid;
            const newCount = isUp ? j + 1 : j;
            columnStates[dragged.col].earthCount = Math.max(0, Math.min(4, newCount));
        }
        playTick();
        vibrate();
    }

    dragged = null;
    hasMoved = false;
    draw();
    updateDisplay();
}

function handlePointerLeave(e) {
    if (dragged) {
        dragged = null;
        hasMoved = false;
        draw();
    }
}

canvas.addEventListener('pointerdown', handlePointerDown);
canvas.addEventListener('pointermove', handlePointerMove);
canvas.addEventListener('pointerup', handlePointerUp);
canvas.addEventListener('pointerleave', handlePointerLeave);

// ====================== INITIAL DRAW ======================
draw();
updateDisplay();

console.log('✅ Beam on top, speed control, larger beads – ready!');