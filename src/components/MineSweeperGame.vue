<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

/* ------------------------------------------------------------------ *
 * 常量
 * ------------------------------------------------------------------ */

const DIFFICULTIES = [
  { id: 'beginner', name: '初级', rows: 9, cols: 9, mines: 10 },
  { id: 'intermediate', name: '中级', rows: 16, cols: 16, mines: 40 },
  { id: 'expert', name: '高级', rows: 16, cols: 30, mines: 99 },
];

/*
 * 自定义上限：行 9~24、列 9~30；雷数上限 = 行×列−9。
 * 减掉 9 是为了保证「首击格 + 周围 8 格」这 9 个安全格一定放得下，见 placeMines。
 */
const CUSTOM_LIMITS = {
  minRows: 9,
  maxRows: 24,
  minCols: 9,
  maxCols: 30,
  minMines: 10,
};

const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_TOLERANCE = 10;
const TIMER_MAX = 999;
const BEST_STORAGE_KEY = 'mh-game-mine-best';
const RECORDS_STORAGE_KEY = 'mh-game-mine-records';
const RECORDS_LIMIT = 10;

/* 格子状态 */
const CLOSED = 0;
const OPEN = 1;
const FLAGGED = 2;

/* ------------------------------------------------------------------ *
 * 响应式状态
 * ------------------------------------------------------------------ */

/** 下拉框当前选中项。与 difficulty 分开：选了「自定义」还没点应用时，棋盘不动。 */
const selected = ref('beginner');

/** 当前棋盘所用的规则标识：预设 id 或 'custom'。 */
const difficulty = ref('beginner');

const rows = ref(9);
const cols = ref(9);
const mineCount = ref(10);

/* 自定义表单：用字符串缓冲，避免输入过程中被 Number() 吃掉中间态 */
const customRows = ref('9');
const customCols = ref('9');
const customMines = ref('10');
const customError = ref('');

/** ready | playing | won | lost —— 单一状态机 */
const phase = ref('ready');

const flagCount = ref(0);
const elapsed = ref(0);
const explodedIndex = ref(-1);
const confirmReset = ref(false);
const pressing = ref(false);
const showRanks = ref(false);
const rankNote = ref('');

/**
 * 每个难度键保留最快的前 RECORDS_LIMIT 局：[{ t: 秒, at: 'YYYY-MM-DD' }]，
 * 按用时升序。 bestKey 的「最佳」就是 list[0]。
 */
const records = ref({});

/**
 * 渲染用的版本号。
 *
 * mines / adjacent / cellState 是 Uint8Array —— Vue 追踪不到它们的下标写入，
 * 改完不会触发重渲染，表现就是「逻辑对了、界面不动」。
 * 所以：每次改这三个数组之后 version += 1，并让每个 cellClass / cellLabel
 * 都先读一次 version.value，把渲染依赖挂在它身上。
 */
const version = ref(0);

/* ------------------------------------------------------------------ *
 * 非响应式句柄（全部要在 onBeforeUnmount 里清掉）
 * ------------------------------------------------------------------ */

let mines = new Uint8Array(0);
let adjacent = new Uint8Array(0);
let cellState = new Uint8Array(0);

let timerId = 0;
let timerStart = 0;
let pressTimer = 0;
let pressIndex = -1;
let pressStartX = 0;
let pressStartY = 0;

/* 三个抑制标志，用途见 onPointerDown / onCellClick / onContextMenu */
let suppressTap = false;
let longPressHandled = false;
let suppressContextFlag = false;

const boardRef = ref(null);

/* ------------------------------------------------------------------ *
 * 计算属性
 * ------------------------------------------------------------------ */

const cellIndexes = computed(() => {
  void version.value;
  const total = rows.value * cols.value;
  const list = new Array(total);
  for (let index = 0; index < total; index += 1) {
    list[index] = index;
  }
  return list;
});

const remainingFlags = computed(() => mineCount.value - flagCount.value);

/**
 * 旗子计数器显示成 3 位。原版插满之后仍可继续插、计数会变负，
 * 所以负数不能截断成 0，也不能让 padStart 把它拼成 "0-1"。
 */
const flagDisplay = computed(() => {
  const remain = remainingFlags.value;
  const digits = String(Math.abs(remain)).padStart(3, '0');
  return remain < 0 ? `-${digits}` : digits;
});

const timerDisplay = computed(() => String(elapsed.value).padStart(3, '0'));

const face = computed(() => {
  if (phase.value === 'lost') {
    return '😵';
  }
  if (phase.value === 'won') {
    return '😎';
  }
  return pressing.value ? '😮' : '🙂';
});

const faceLabel = computed(() => (phase.value === 'ready' ? '开始新的一局' : '重新开始'));

const bestKey = computed(() =>
  difficulty.value === 'custom'
    ? `custom-${rows.value}x${cols.value}x${mineCount.value}`
    : difficulty.value,
);

const bestSeconds = computed(() => records.value[bestKey.value]?.[0]?.t || 0);

const bestLabel = computed(() =>
  bestSeconds.value > 0 ? `最佳 ${formatClock(bestSeconds.value)}` : '暂无最佳成绩',
);

const progressLabel = computed(() => `${rows.value} 行 × ${cols.value} 列 · ${mineCount.value} 颗雷`);

/**
 * 排行榜弹层的分组：初 / 中 / 高三档固定显示，自定义棋盘（键形如
 * custom-RxCxM，不同规格没法按同一口径比较，但都挤进同一组按时间排）有成绩才显示。
 */
const rankGroups = computed(() => {
  const groups = DIFFICULTIES.map((item) => ({
    label: item.name,
    list: records.value[item.id] || [],
  }));

  const customKeys = Object.keys(records.value).filter((key) => key.startsWith('custom-'));
  if (customKeys.length) {
    groups.push({
      label: '自定义',
      list: customKeys
        .flatMap((key) => records.value[key])
        .slice()
        .sort((a, b) => a.t - b.t)
        .slice(0, RECORDS_LIMIT),
    });
  }

  return groups;
});

/* ------------------------------------------------------------------ *
 * 纯函数工具
 * ------------------------------------------------------------------ */

function formatClock(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function neighbors(index) {
  const row = Math.floor(index / cols.value);
  const col = index % cols.value;
  const list = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      if (rowOffset === 0 && colOffset === 0) {
        continue;
      }
      const nextRow = row + rowOffset;
      const nextCol = col + colOffset;
      if (nextRow < 0 || nextRow >= rows.value || nextCol < 0 || nextCol >= cols.value) {
        continue;
      }
      list.push(nextRow * cols.value + nextCol);
    }
  }

  return list;
}

function indexFromEvent(event) {
  const target = event.target;
  const cell = target instanceof Element ? target.closest('.game-mine-cell') : null;
  if (!cell) {
    return -1;
  }
  const index = Number(cell.dataset.i);
  return Number.isInteger(index) ? index : -1;
}

/* ------------------------------------------------------------------ *
 * 渲染派生（必须在函数体内读一次 version，见其注释）
 * ------------------------------------------------------------------ */

function cellClass(index) {
  void version.value;

  const isOpen = cellState[index] === OPEN;
  const isFlagged = cellState[index] === FLAGGED;
  const isMine = mines[index] === 1;
  const classes = ['game-mine-cell'];

  if (isOpen) {
    classes.push('game-mine-cell--open');
  }
  if (isFlagged) {
    classes.push('game-mine-cell--flag');
  }

  if (phase.value === 'lost') {
    /* 失败揭示全部由渲染推导，不回写 Uint8Array */
    if (isMine && !isFlagged) {
      classes.push('game-mine-cell--mine');
    }
    if (isMine && index === explodedIndex.value) {
      classes.push('game-mine-cell--exploded');
    }
    if (!isMine && isFlagged) {
      classes.push('game-mine-cell--wrong');
    }
  } else if (isOpen && adjacent[index] > 0) {
    classes.push(`game-mine-cell--n${adjacent[index]}`);
  }

  return classes;
}

function cellLabel(index) {
  void version.value;

  const isOpen = cellState[index] === OPEN;
  const isFlagged = cellState[index] === FLAGGED;
  const isMine = mines[index] === 1;

  if (phase.value === 'lost') {
    if (isMine && !isFlagged) {
      return '✱';
    }
    if (!isMine && isFlagged) {
      return '✕';
    }
  }
  if (isFlagged) {
    return '⚑';
  }
  if (!isOpen) {
    return '';
  }
  if (adjacent[index] > 0) {
    return String(adjacent[index]);
  }
  return '';
}

function cellAriaLabel(index) {
  void version.value;

  if (cellState[index] === FLAGGED) {
    return '已插旗';
  }
  if (cellState[index] !== OPEN) {
    return '未翻开的格子';
  }
  const number = adjacent[index];
  return number > 0 ? `已翻开，周围有 ${number} 颗雷` : '已翻开，周围没有雷';
}

/* ------------------------------------------------------------------ *
 * 计时
 * ------------------------------------------------------------------ */

function stopTimer() {
  if (timerId) {
    window.clearInterval(timerId);
    timerId = 0;
  }
}

function tickTimer() {
  /* 用时间戳差值而不是累加 tick：后台标签页被节流时累加会越走越慢 */
  const seconds = Math.floor((Date.now() - timerStart) / 1000);
  elapsed.value = Math.min(seconds, TIMER_MAX);
  if (elapsed.value >= TIMER_MAX) {
    stopTimer();
  }
}

function startTimer() {
  stopTimer();
  timerStart = Date.now();
  elapsed.value = 0;
  timerId = window.setInterval(tickTimer, 200);
}

/* 暂停后续走：从已累计的秒数接着计，不清零重来 */
function resumeTimer() {
  stopTimer();
  timerStart = Date.now() - elapsed.value * 1000;
  timerId = window.setInterval(tickTimer, 200);
}

/* ------------------------------------------------------------------ *
 * 排行榜（只在浏览器本地，读写都静默降级）
 * ------------------------------------------------------------------ */

/** 只留合法条目：t 为正整数秒、at 为字符串（旧迁移数据没有日期，at 为空串）。 */
function sanitizeRecords(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {};
  }

  const result = {};
  Object.keys(parsed).forEach((key) => {
    const list = Array.isArray(parsed[key]) ? parsed[key] : [];
    const clean = list
      .map((item) => {
        const seconds = Math.floor(Number(item && item.t));
        const at = item && typeof item.at === 'string' ? item.at : '';
        return Number.isFinite(seconds) && seconds > 0 ? { t: seconds, at } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.t - b.t)
      .slice(0, RECORDS_LIMIT);
    if (clean.length) {
      result[key] = clean;
    }
  });
  return result;
}

function loadRecords() {
  let stored = {};
  try {
    const raw = window.localStorage.getItem(RECORDS_STORAGE_KEY);
    if (raw) {
      stored = sanitizeRecords(JSON.parse(raw));
    }
  } catch (error) {
    /* 隐私模式 / 配额满 / 脏数据都只是没有成绩，不能影响游戏 */
    stored = {};
  }

  /*
   * 旧版只存每档一条最佳成绩：按键补缺迁移（新键里已有的难度不覆盖），
   * 垫底数据没有日期，排行榜里显示为 —。下次赢棋写回时落到新键。
   */
  try {
    const legacy = JSON.parse(window.localStorage.getItem(BEST_STORAGE_KEY) || 'null');
    if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) {
      Object.keys(legacy).forEach((key) => {
        if (stored[key]) {
          return;
        }
        const seconds = Math.floor(Number(legacy[key]));
        if (Number.isFinite(seconds) && seconds > 0) {
          stored[key] = [{ t: seconds, at: '' }];
        }
      });
    }
  } catch (error) {
    /* 旧数据坏了就当没有 */
  }

  return stored;
}

function saveRecords() {
  try {
    window.localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(records.value));
  } catch (error) {
    /* 存不下就算了，成绩只影响排行榜展示 */
  }
}

/** 赢一局记一笔，返回名次（1 起）；没挤进前 RECORDS_LIMIT 返回 0。 */
function recordWin() {
  const key = bestKey.value;
  const list = (records.value[key] || []).slice();
  /* 秒表口径最小 1 秒：同秒内完成也记 1，避免 0:00 与「暂无最佳成绩」打架 */
  const entry = { t: Math.max(elapsed.value, 1), at: new Date().toISOString().slice(0, 10) };
  list.push(entry);
  list.sort((a, b) => a.t - b.t);
  if (list.length > RECORDS_LIMIT) {
    list.length = RECORDS_LIMIT;
  }
  records.value = { ...records.value, [key]: list };
  saveRecords();

  const rank = list.indexOf(entry);
  return rank >= 0 ? rank + 1 : 0;
}

/* ------------------------------------------------------------------ *
 * 布雷与展开
 * ------------------------------------------------------------------ */

function placeMines(safeIndex) {
  const total = rows.value * cols.value;

  /*
   * 首击安全（口径 B）：把「首击格 + 它的 8 邻」整块排除在雷位之外。
   * 于是首击格邻雷数必为 0，一定触发洪水填充展开一片 —— 不是「只保证不炸」。
   */
  const forbidden = new Set(neighbors(safeIndex));
  forbidden.add(safeIndex);

  const pool = [];
  for (let index = 0; index < total; index += 1) {
    if (!forbidden.has(index)) {
      pool.push(index);
    }
  }

  /* 部分洗牌：取前 mineCount 个即为一组均匀随机的雷位 */
  const count = Math.min(mineCount.value, pool.length);
  for (let index = 0; index < count; index += 1) {
    const swapWith = index + Math.floor(Math.random() * (pool.length - index));
    const picked = pool[swapWith];
    pool[swapWith] = pool[index];
    pool[index] = picked;
    mines[picked] = 1;
  }
}

function computeAdjacent() {
  const total = rows.value * cols.value;

  for (let index = 0; index < total; index += 1) {
    if (mines[index] === 1) {
      adjacent[index] = 0;
      continue;
    }
    const list = neighbors(index);
    let count = 0;
    for (let k = 0; k < list.length; k += 1) {
      if (mines[list[k]] === 1) {
        count += 1;
      }
    }
    adjacent[index] = count;
  }
}

/**
 * 洪水填充。**显式栈迭代，不能递归** —— 最大棋盘 24×30=720 格，
 * 递归实现虽然不至于爆栈，但栈深随棋盘增长、且这类写法一律按迭代处理。
 * 注意：函数体内不得出现对自身的调用（交付前有静态检查核对这点）。
 */
function floodReveal(start) {
  const stack = [start];

  while (stack.length > 0) {
    const index = stack.pop();
    if (cellState[index] !== CLOSED || mines[index] === 1) {
      continue;
    }

    cellState[index] = OPEN;

    if (adjacent[index] !== 0) {
      continue;
    }

    const list = neighbors(index);
    for (let k = 0; k < list.length; k += 1) {
      const next = list[k];
      if (cellState[next] === CLOSED && mines[next] === 0) {
        stack.push(next);
      }
    }
  }

  version.value += 1;
}

function checkWin() {
  if (phase.value !== 'playing') {
    return;
  }

  const total = rows.value * cols.value;
  let opened = 0;
  for (let index = 0; index < total; index += 1) {
    if (cellState[index] === OPEN) {
      opened += 1;
    }
  }

  /* 胜利条件：所有非雷格都翻开，不要求插满旗 */
  if (opened === total - mineCount.value) {
    phase.value = 'won';
    stopTimer();

    const rank = recordWin();
    rankNote.value = rank === 1 ? '刷新了最佳纪录！' : rank > 0 ? `进入排行榜第 ${rank} 名。` : '';
  }
}

function lose(index) {
  phase.value = 'lost';
  explodedIndex.value = index;
  stopTimer();
  version.value += 1;
}

function reveal(index) {
  if (cellState[index] !== CLOSED) {
    return;
  }
  if (mines[index] === 1) {
    lose(index);
    return;
  }
  floodReveal(index);
  checkWin();
}

function toggleFlag(index) {
  if (phase.value === 'won' || phase.value === 'lost') {
    return;
  }
  if (cellState[index] === OPEN) {
    return;
  }

  if (cellState[index] === FLAGGED) {
    cellState[index] = CLOSED;
    flagCount.value -= 1;
  } else {
    /* 不限制在雷数以内：原版插满后仍可继续插，计数器会变负 */
    cellState[index] = FLAGGED;
    flagCount.value += 1;
  }

  version.value += 1;
}

function chordAt(index) {
  if (phase.value !== 'playing') {
    return;
  }
  if (cellState[index] !== OPEN) {
    return;
  }

  const number = adjacent[index];
  if (number === 0) {
    return;
  }

  const list = neighbors(index);
  let flags = 0;
  for (let k = 0; k < list.length; k += 1) {
    if (cellState[list[k]] === FLAGGED) {
      flags += 1;
    }
  }
  /* 必须恰好相等：旗少了是不确定，旗多了是误标，两种都不该替他做决定 */
  if (flags !== number) {
    return;
  }

  for (let k = 0; k < list.length; k += 1) {
    const next = list[k];
    if (cellState[next] !== CLOSED) {
      continue;
    }
    if (mines[next] === 1) {
      lose(next);
      return;
    }
    floodReveal(next);
  }

  checkWin();
}

/* ------------------------------------------------------------------ *
 * 局面控制
 * ------------------------------------------------------------------ */

function resetBoard() {
  const total = rows.value * cols.value;
  mines = new Uint8Array(total);
  adjacent = new Uint8Array(total);
  cellState = new Uint8Array(total);

  flagCount.value = 0;
  elapsed.value = 0;
  explodedIndex.value = -1;
  confirmReset.value = false;
  rankNote.value = '';
  phase.value = 'ready';
  timerStart = 0;

  stopTimer();
  cancelLongPress();
  suppressTap = false;
  longPressHandled = false;
  suppressContextFlag = false;

  version.value += 1;
}

function applyPreset(id) {
  const preset = DIFFICULTIES.find((item) => item.id === id);
  selected.value = id;
  customError.value = '';

  if (!preset) {
    /* 「自定义」只是把表单亮出来，棋盘等点「应用」再换 */
    return;
  }

  difficulty.value = preset.id;
  rows.value = preset.rows;
  cols.value = preset.cols;
  mineCount.value = preset.mines;
  resetBoard();
}

function onDifficultyChange(event) {
  applyPreset(event.target.value);
}

function validateCustom() {
  const nextRows = Number(customRows.value);
  const nextCols = Number(customCols.value);
  const nextMines = Number(customMines.value);

  if (!Number.isInteger(nextRows) || !Number.isInteger(nextCols) || !Number.isInteger(nextMines)) {
    return '行、列、雷数都必须是整数。';
  }
  if (nextRows < CUSTOM_LIMITS.minRows || nextRows > CUSTOM_LIMITS.maxRows) {
    return `行数需在 ${CUSTOM_LIMITS.minRows}~${CUSTOM_LIMITS.maxRows} 之间。`;
  }
  if (nextCols < CUSTOM_LIMITS.minCols || nextCols > CUSTOM_LIMITS.maxCols) {
    return `列数需在 ${CUSTOM_LIMITS.minCols}~${CUSTOM_LIMITS.maxCols} 之间。`;
  }

  const maxMines = nextRows * nextCols - 9;
  if (nextMines < CUSTOM_LIMITS.minMines || nextMines > maxMines) {
    return `雷数需在 ${CUSTOM_LIMITS.minMines}~${maxMines} 之间（首击那 9 格得留出来）。`;
  }

  return '';
}

function applyCustom() {
  const message = validateCustom();
  customError.value = message;
  if (message) {
    return;
  }

  difficulty.value = 'custom';
  rows.value = Number(customRows.value);
  cols.value = Number(customCols.value);
  mineCount.value = Number(customMines.value);
  resetBoard();
}

function requestReset() {
  /* 还没开局或已经终局（胜负都已定格）都没有可丢的东西，直接重开不问 */
  if (phase.value !== 'playing') {
    resetBoard();
    return;
  }
  /* 确认期间对局挂起：棋盘锁死、计时停走，取消则原地恢复 */
  confirmReset.value = true;
  stopTimer();
}

function cancelReset() {
  confirmReset.value = false;
  resumeTimer();
}

function confirmDoReset() {
  confirmReset.value = false;
  resetBoard();
}

/* ------------------------------------------------------------------ *
 * 指针 / 鼠标 / 触屏
 * ------------------------------------------------------------------ */

function cancelLongPress() {
  if (pressTimer) {
    window.clearTimeout(pressTimer);
    pressTimer = 0;
  }
  pressIndex = -1;
  pressing.value = false;
}

function releaseCapture(pointerId) {
  try {
    const board = boardRef.value;
    if (board && board.hasPointerCapture(pointerId)) {
      board.releasePointerCapture(pointerId);
    }
  } catch (error) {
    /* 同上：捕获本就可能没建立起来 */
  }
}

function onPointerDown(event) {
  /* 重开确认期间对局挂起：不响应按下（含和弦与触屏长按） */
  if (confirmReset.value) {
    return;
  }
  const index = indexFromEvent(event);
  if (index < 0) {
    return;
  }

  /* 左右键同时按下 = 和弦（Windows 原版的经典操作） */
  if (event.buttons === 3) {
    suppressContextFlag = true;
    cancelLongPress();
    chordAt(index);
    return;
  }

  /* 这一按不是和弦，把上一次和弦留下的抑制标志清掉 */
  suppressContextFlag = false;

  if (event.pointerType !== 'touch') {
    return;
  }
  if (phase.value === 'won' || phase.value === 'lost') {
    return;
  }

  /* 上一次长按如果没能合成出 click，标志会一直挂着 —— 每次按下先复位 */
  suppressTap = false;
  cancelLongPress();

  pressIndex = index;
  pressStartX = event.clientX;
  pressStartY = event.clientY;
  pressing.value = true;

  try {
    boardRef.value?.setPointerCapture(event.pointerId);
  } catch (error) {
    /* 合成事件里的 pointerId 并不存在，捕获会抛错；有 window 兜底监听就够 */
  }

  pressTimer = window.setTimeout(() => {
    pressTimer = 0;
    if (pressIndex !== index) {
      return;
    }
    /* 长按成功：吃掉随后合成的 click，并让紧跟的 contextmenu 别把它取消掉 */
    longPressHandled = true;
    suppressTap = true;
    pressing.value = false;
    toggleFlag(index);
  }, LONG_PRESS_MS);
}

function onPointerMove(event) {
  if (!pressTimer) {
    return;
  }

  const movedX = Math.abs(event.clientX - pressStartX);
  const movedY = Math.abs(event.clientY - pressStartY);
  if (movedX > LONG_PRESS_MOVE_TOLERANCE || movedY > LONG_PRESS_MOVE_TOLERANCE) {
    cancelLongPress();
  }
}

function onPointerUp(event) {
  cancelLongPress();
  releaseCapture(event.pointerId);
}

function onPointerCancel(event) {
  cancelLongPress();
  releaseCapture(event.pointerId);
}

function onLostPointerCapture() {
  cancelLongPress();
}

function onCellClick(event) {
  if (confirmReset.value) {
    return;
  }
  if (suppressTap) {
    /* 长按插旗之后浏览器合成的 click，必须吃掉，否则插了又翻开 */
    suppressTap = false;
    return;
  }
  if (phase.value === 'won' || phase.value === 'lost') {
    return;
  }

  const index = indexFromEvent(event);
  if (index < 0) {
    return;
  }
  if (cellState[index] !== CLOSED) {
    /* 已翻开或已插旗：左键都不该有动作（和弦走双击 / 左右同按） */
    return;
  }

  if (phase.value === 'ready') {
    placeMines(index);
    computeAdjacent();
    phase.value = 'playing';
    startTimer();
  }

  reveal(index);
}

function onCellDblClick(event) {
  if (confirmReset.value) {
    return;
  }
  const index = indexFromEvent(event);
  if (index < 0) {
    return;
  }
  chordAt(index);
}

function onContextMenu(event) {
  event.preventDefault();

  /* 确认期间右键也不插旗，但默认菜单照旧被拦 */
  if (confirmReset.value) {
    return;
  }
  if (suppressContextFlag) {
    suppressContextFlag = false;
    return;
  }
  if (longPressHandled) {
    /* Chrome Android 长按到 500ms 附近会同时触发 contextmenu，这里要放行插旗结果 */
    longPressHandled = false;
    return;
  }

  const index = indexFromEvent(event);
  if (index < 0) {
    return;
  }
  toggleFlag(index);
}

function onAuxClick(event) {
  /* 中键 / 侧键一律不做动作 */
  event.preventDefault();
}

/* ------------------------------------------------------------------ *
 * 生命周期
 * ------------------------------------------------------------------ */

/*
 * pointerup / pointercancel 额外挂在 window 上兜底：
 * 手指按住后移出棋盘再抬起，棋盘上就收不到抬起了 —— 长按计时器会继续跑，
 * 到点就在错误的位置插一面旗。
 */
onMounted(() => {
  records.value = loadRecords();
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerCancel);
});

onBeforeUnmount(() => {
  stopTimer();
  cancelLongPress();
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerCancel);
});

const emit = defineEmits(['dirty']);

/* 无人监听时 emit 是安全的空操作；父组件本轮尚未接线 */
watch(
  phase,
  (value) => {
    emit('dirty', value === 'playing');
  },
  { immediate: true },
);

applyPreset('beginner');
</script>

<template>
  <div class="game-panel game-mine">
    <p class="game-hint">
      左键翻开格子，右键插旗标雷；已翻开的数字格上双击（或左右键同时按）可以「和弦」，
      一次翻开周围 —— 前提是周围的旗数正好等于这个数字。手机：点一下翻开，长按半秒插旗。
    </p>

    <div class="game-board-controls">
      <label class="game-control">
        <span class="game-tool-label">难度</span>
        <select class="game-select" :value="selected" @change="onDifficultyChange">
          <option v-for="item in DIFFICULTIES" :key="item.id" :value="item.id">
            {{ item.name }}
          </option>
          <option value="custom">自定义</option>
        </select>
      </label>

      <button class="text-button" type="button" @click="requestReset">重新开始</button>
      <button class="text-button" type="button" @click="showRanks = true">排行榜</button>
      <span class="game-note">{{ bestLabel }}</span>
    </div>

    <div v-if="selected === 'custom'" class="game-mine-custom">
      <label>
        <span class="game-tool-label">行</span>
        <input v-model="customRows" class="game-mine-input" type="number" inputmode="numeric" />
      </label>
      <label>
        <span class="game-tool-label">列</span>
        <input v-model="customCols" class="game-mine-input" type="number" inputmode="numeric" />
      </label>
      <label>
        <span class="game-tool-label">雷</span>
        <input v-model="customMines" class="game-mine-input" type="number" inputmode="numeric" />
      </label>
      <button class="secondary" type="button" @click="applyCustom">应用</button>
      <p v-if="customError" class="game-mine-error" role="alert">{{ customError }}</p>
    </div>

    <div class="game-mine-status">
      <span class="game-mine-counter" :aria-label="`剩余旗子 ${remainingFlags}`">{{ flagDisplay }}</span>
      <button class="game-mine-face" type="button" :aria-label="faceLabel" @click="requestReset">
        {{ face }}
      </button>
      <span class="game-mine-timer" :aria-label="`用时 ${elapsed} 秒`">{{ timerDisplay }}</span>
    </div>

    <div class="game-mine-scroll">
      <div
        ref="boardRef"
        class="game-mine-board"
        :style="{ '--game-mine-cols': cols }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerCancel"
        @lostpointercapture="onLostPointerCapture"
        @click="onCellClick"
        @dblclick="onCellDblClick"
        @contextmenu="onContextMenu"
        @auxclick="onAuxClick"
      >
        <button
          v-for="index in cellIndexes"
          :key="index"
          type="button"
          :class="cellClass(index)"
          :data-i="index"
          :aria-label="cellAriaLabel(index)"
        >
          {{ cellLabel(index) }}
        </button>
      </div>
    </div>

    <p v-if="phase === 'won'" class="game-done" role="status">
      全部排完了，用时 {{ timerDisplay }} 秒。
      <span v-if="rankNote">{{ rankNote }}</span>
    </p>

    <div class="game-panel-foot">
      <p class="game-note">{{ progressLabel }}</p>
      <p class="game-note">成绩只存在这台设备的浏览器里。</p>
    </div>

    <div v-if="confirmReset" class="game-confirm" role="alertdialog" aria-live="polite">
      <p>这一局还没结束，确定重新开始吗？</p>
      <div class="game-confirm-actions">
        <button class="secondary" type="button" @click="cancelReset">继续这一局</button>
        <button class="danger-button" type="button" @click="confirmDoReset">确定重开</button>
      </div>
    </div>

    <div v-if="showRanks" class="game-mine-ranks" role="dialog" aria-label="扫雷排行榜">
      <div class="game-mine-ranks-card">
        <h4>排行榜</h4>
        <p class="game-mine-ranks-note">每个难度记录最快的 {{ RECORDS_LIMIT }} 局，只存在这台设备上。</p>
        <div v-for="group in rankGroups" :key="group.label" class="game-mine-rank-group">
          <h5>{{ group.label }}</h5>
          <p v-if="!group.list.length" class="game-mine-rank-empty">还没有成绩，赢一局就记上了。</p>
          <ol v-else>
            <li v-for="(item, index) in group.list" :key="`${item.t}-${item.at}-${index}`">
              <span class="game-mine-rank-no">{{ index + 1 }}</span>
              <span class="game-mine-rank-time">{{ formatClock(item.t) }}</span>
              <span class="game-mine-rank-date">{{ item.at || '—' }}</span>
            </li>
          </ol>
        </div>
        <button class="secondary" type="button" @click="showRanks = false">关闭</button>
      </div>
    </div>
  </div>
</template>
