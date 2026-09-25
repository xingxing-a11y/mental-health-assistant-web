<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

/* ------------------------------------------------------------------ *
 * 常量
 * ------------------------------------------------------------------ */

/*
 * 三档难度都是 104 张两副牌：花色数 × 组数 = 8 组，每局 8 组 A–K。
 * 初级 1 花色、中级 2 花色、高级 4 花色 —— 与 Windows 原版一致。
 */
const DIFFICULTIES = [
  { id: 'beginner', name: '初级 · 1 花色', suits: ['♠'], copies: 8 },
  { id: 'intermediate', name: '中级 · 2 花色', suits: ['♠', '♥'], copies: 4 },
  { id: 'expert', name: '高级 · 4 花色', suits: ['♠', '♥', '♦', '♣'], copies: 2 },
];

const COLUMN_COUNT = 10;
/* 前 4 列 6 张、后 6 列 5 张 = 54 张，正好是 4×6 + 6×5 */
const LONG_COLUMN_COUNT = 4;
const SHORT_COLUMN_SIZE = 5;
const LONG_COLUMN_SIZE = 6;
const FOUNDATION_TOTAL = 8;
const HISTORY_LIMIT = 200;
const START_SCORE = 500;
const MOVE_PENALTY = 1;
const DEAL_PENALTY = 1;
const COLLECT_BONUS = 100;
const DRAG_START_PX = 4;
/** 长按多久起拖；按住期间位移超过这个数就算「不是长按」而是滚动手势 */
const LONG_PRESS_MS = 280;
const LONG_PRESS_SLOP_PX = 8;
const NOTICE_MS = 2600;
const RED_SUITS = ['♥', '♦'];
const RANK_LABELS = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };

/* ------------------------------------------------------------------ *
 * 响应式状态
 * ------------------------------------------------------------------ */

const difficulty = ref('beginner');
/** 固定 10 列；每列 index 0 在底、末尾在顶 */
const tableau = ref([]);
/** 剩余发牌堆：50 张 = 5 次 */
const stock = ref([]);
const foundationCount = ref(0);
/** 已完成的完整花色组（按收集顺序存花色字符），展示在控制行右侧 */
const foundations = ref([]);
const score = ref(START_SCORE);
const moves = ref(0);
const elapsed = ref(0);
/** ready | playing | won */
const phase = ref('ready');
const notice = ref('');
/** 拖拽态：模板据此渲染影子层 */
const drag = ref(null);
const confirmNew = ref(false);
/** history 非响应式，按钮禁用态要另存一份计数 */
const undoCount = ref(0);

const tableauRef = ref(null);

/* ------------------------------------------------------------------ *
 * 非响应式状态（改动不需要重渲染）
 * ------------------------------------------------------------------ */

/** 撤销栈：深拷贝快照，**不含 elapsed** —— 撤销不回滚计时 */
let history = [];
let timerId = 0;
let noticeTimer = 0;
let cardSeq = 0;
/** 起拖那一刻缓存的 10 个列矩形，columnAtX() 直接查它 */
let colRects = [];
/** 影子的未变换原点（相对表盘边框盒左上角） */
let dragOrigin = { x: 0, y: 0 };
/** active = 这次按下仍是拖拽候选；一旦否决或作废就置 false */
const pointerState = {
  pointerId: -1,
  col: -1,
  idx: -1,
  x0: 0,
  y0: 0,
  active: false,
  pointerType: 'mouse',
  holdTimer: 0,
};

/* ------------------------------------------------------------------ *
 * 派生值
 * ------------------------------------------------------------------ */

const remainingDeals = computed(() => Math.floor(stock.value.length / COLUMN_COUNT));

const foundationLabel = computed(() => `${foundationCount.value} / ${FOUNDATION_TOTAL}`);

/* 被拖走的牌在原列留下空格：按 id 比对，不依赖对象身份 */
const draggingIds = computed(() => {
  const ids = new Set();
  if (drag.value) {
    drag.value.cards.forEach((card) => ids.add(card.id));
  }
  return ids;
});

const dragTransform = computed(() => {
  if (!drag.value) {
    return 'none';
  }
  return `translate(${drag.value.x}px, ${drag.value.y}px)`;
});

/* ------------------------------------------------------------------ *
 * 牌面显示
 * ------------------------------------------------------------------ */

function isRedSuit(suit) {
  return RED_SUITS.includes(suit);
}

function cardLabel(card) {
  if (!card.faceUp) {
    return '';
  }
  const rank = RANK_LABELS[card.rank] || card.rank;
  return `${rank}${card.suit}`;
}

function cardClass(card) {
  return {
    'game-spider-card--up': card.faceUp,
    'game-spider-card--down': !card.faceUp,
    'game-spider-card--red': card.faceUp && isRedSuit(card.suit),
    'game-spider-card--dragging': draggingIds.value.has(card.id),
  };
}

/* ------------------------------------------------------------------ *
 * 建牌与开局
 * ------------------------------------------------------------------ */

function buildDeck(preset) {
  const deck = [];
  preset.suits.forEach((suit) => {
    for (let copy = 0; copy < preset.copies; copy += 1) {
      for (let rank = 1; rank <= 13; rank += 1) {
        cardSeq += 1;
        deck.push({ id: `c${cardSeq}`, suit, rank, faceUp: false });
      }
    }
  });
  return deck;
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = list[i];
    list[i] = list[j];
    list[j] = swap;
  }
}

/*
 * 开新局。难度切换与「重新开始」都走这里 —— 同值重设也会开新局，
 * 验收脚本靠这一点做重试（不必点会弹确认的「重新开始」按钮）。
 */
function applyPreset(id) {
  const preset = DIFFICULTIES.find((item) => item.id === id) || DIFFICULTIES[0];
  const deck = buildDeck(preset);
  shuffle(deck);

  const board = [];
  let cursor = 0;
  for (let col = 0; col < COLUMN_COUNT; col += 1) {
    const size = col < LONG_COLUMN_COUNT ? LONG_COLUMN_SIZE : SHORT_COLUMN_SIZE;
    const stack = [];
    for (let i = 0; i < size; i += 1) {
      const card = deck[cursor];
      cursor += 1;
      /* 每列只有末张正面 */
      card.faceUp = i === size - 1;
      stack.push(card);
    }
    board.push(stack);
  }

  difficulty.value = preset.id;
  tableau.value = board;
  stock.value = deck.slice(cursor);
  foundationCount.value = 0;
  foundations.value = [];
  score.value = START_SCORE;
  moves.value = 0;
  elapsed.value = 0;
  phase.value = 'ready';
  notice.value = '';
  confirmNew.value = false;
  drag.value = null;
  history = [];
  undoCount.value = 0;
  pointerState.active = false;
  stopTimer();
  clearNoticeTimer();
}

/* ------------------------------------------------------------------ *
 * 规则判定（纯函数）
 * ------------------------------------------------------------------ */

/** [start..末] 是否「同花 + 严格降序 + 全正面」—— 整叠能不能提起来就看它 */
function isRun(stack, start) {
  if (start < 0 || start >= stack.length) {
    return false;
  }
  for (let i = start; i < stack.length; i += 1) {
    if (!stack[i].faceUp) {
      return false;
    }
    if (i === start) {
      continue;
    }
    const previous = stack[i - 1];
    const current = stack[i];
    if (previous.suit !== current.suit || previous.rank !== current.rank + 1) {
      return false;
    }
  }
  return true;
}

/** 能提起来的整叠；提不动返回 null（此时不起拖） */
function draggableUnit(col, idx) {
  const stack = tableau.value[col];
  if (!stack || idx < 0 || idx >= stack.length) {
    return null;
  }
  return isRun(stack, idx) ? stack.slice(idx) : null;
}

/** 落点：空列收任意整叠，否则要压大一号 */
function canDrop(cards, toCol) {
  const target = tableau.value[toCol];
  if (!cards.length || !target) {
    return false;
  }
  if (!target.length) {
    return true;
  }
  const top = target[target.length - 1];
  return top.faceUp && top.rank === cards[0].rank + 1;
}

/** 落点只看指针 x：目标是「一条竖直车道」，纵向位移不参与判定 */
function columnAtX(clientX) {
  let nearest = -1;
  let nearestDistance = Infinity;
  for (let i = 0; i < colRects.length; i += 1) {
    const rect = colRects[i];
    if (clientX >= rect.left && clientX <= rect.right) {
      return i;
    }
    const distance = clientX < rect.left ? rect.left - clientX : clientX - rect.right;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = i;
    }
  }
  return nearest;
}

/* ------------------------------------------------------------------ *
 * 行动
 * ------------------------------------------------------------------ */

/** 列末若是背面就翻开 */
function revealTop(colIdx) {
  const stack = tableau.value[colIdx];
  if (!stack.length) {
    return;
  }
  const top = stack[stack.length - 1];
  if (!top.faceUp) {
    top.faceUp = true;
  }
}

/** 收满 K→A 同花 13 张就自动进 foundation。不收快照、不计步数 —— 它是动作的连带结果 */
function checkAutoCollect(colIdx) {
  const stack = tableau.value[colIdx];
  if (stack.length < 13) {
    return false;
  }
  const start = stack.length - 13;
  if (stack[start].rank !== 13 || !isRun(stack, start)) {
    return false;
  }

  const suit = stack[start].suit;
  stack.splice(start);
  foundations.value.push(suit);
  foundationCount.value += 1;
  score.value += COLLECT_BONUS;

  if (foundationCount.value >= FOUNDATION_TOTAL) {
    phase.value = 'won';
    stopTimer();
  }
  return true;
}

function applyMove(fromCol, fromIdx, toCol) {
  pushHistory();

  const moving = tableau.value[fromCol].splice(fromIdx);
  tableau.value[toCol].push(...moving);

  score.value -= MOVE_PENALTY;
  moves.value += 1;
  phase.value = 'playing';
  startTimer();

  revealTop(fromCol);
  checkAutoCollect(toCol);
}

function deal() {
  if (phase.value === 'won' || !stock.value.length) {
    return;
  }
  /* 原版规则：有空列时不能发牌 */
  if (tableau.value.some((col) => col.length === 0)) {
    showNotice('有空列时不能发牌，先把空列填上。');
    return;
  }

  pushHistory();

  for (let col = 0; col < COLUMN_COUNT; col += 1) {
    const card = stock.value.pop();
    card.faceUp = true;
    tableau.value[col].push(card);
  }

  score.value -= DEAL_PENALTY;
  moves.value += 1;
  phase.value = 'playing';
  startTimer();

  for (let col = 0; col < COLUMN_COUNT; col += 1) {
    checkAutoCollect(col);
  }
}

/* ------------------------------------------------------------------ *
 * 撤销
 * ------------------------------------------------------------------ */

/*
 * 一次动作（含连带的自动收牌）只压一次快照 —— 压栈点只有 applyMove / deal。
 * 快照不含 elapsed：撤销回滚牌面与分数，但不回滚计时。
 */
function pushHistory() {
  history.push({
    tableau: tableau.value.map((col) => col.map((card) => ({ ...card }))),
    stock: stock.value.map((card) => ({ ...card })),
    foundationCount: foundationCount.value,
    foundations: foundations.value.slice(),
    score: score.value,
    moves: moves.value,
  });

  if (history.length > HISTORY_LIMIT) {
    history.shift();
  }
  undoCount.value = history.length;
}

function restore(snapshot) {
  tableau.value = snapshot.tableau;
  stock.value = snapshot.stock;
  foundationCount.value = snapshot.foundationCount;
  foundations.value = snapshot.foundations || [];
  score.value = snapshot.score;
  moves.value = snapshot.moves;
}

function undo() {
  const snapshot = history.pop();
  if (!snapshot) {
    return;
  }

  restore(snapshot);
  undoCount.value = history.length;
  drag.value = null;
  pointerState.active = false;

  /* 上一动作若是收满八组，撤销后要回到进行中 */
  if (phase.value === 'won') {
    phase.value = 'playing';
    startTimer();
  }
}

/* ------------------------------------------------------------------ *
 * 计时与提示
 * ------------------------------------------------------------------ */

function startTimer() {
  if (timerId) {
    return;
  }
  timerId = window.setInterval(() => {
    elapsed.value += 1;
  }, 1000);
}

function stopTimer() {
  if (timerId) {
    window.clearInterval(timerId);
    timerId = 0;
  }
}

function showNotice(text) {
  notice.value = text;
  clearNoticeTimer();
  noticeTimer = window.setTimeout(() => {
    notice.value = '';
    noticeTimer = 0;
  }, NOTICE_MS);
}

function clearNoticeTimer() {
  if (noticeTimer) {
    window.clearTimeout(noticeTimer);
    noticeTimer = 0;
  }
}

/* ------------------------------------------------------------------ *
 * 重新开始
 * ------------------------------------------------------------------ */

function hasProgress() {
  return moves.value > 0 || foundationCount.value > 0;
}

function requestNewGame() {
  if (hasProgress()) {
    confirmNew.value = true;
    return;
  }
  applyPreset(difficulty.value);
}

function cancelNewGame() {
  confirmNew.value = false;
}

function confirmNewGame() {
  applyPreset(difficulty.value);
}

/* 切换难度立即开新局、不弹确认 —— 与 Windows 一致 */
function onDifficultyChange(event) {
  applyPreset(event.target.value);
}

/* ------------------------------------------------------------------ *
 * 指针 / 鼠标 / 触屏
 * ------------------------------------------------------------------ */

function releaseCapture() {
  const tableauEl = tableauRef.value;
  if (!tableauEl) {
    return;
  }
  try {
    if (tableauEl.hasPointerCapture(pointerState.pointerId)) {
      tableauEl.releasePointerCapture(pointerState.pointerId);
    }
  } catch (error) {
    /* 捕获本来就可能没建起来 */
  }
}

/* 单一回收出口：三条路径（up / cancel / lostcapture）都必须经由这里 */
function abortDrag() {
  clearHold();
  drag.value = null;
  pointerState.active = false;
  releaseCapture();
}

/* 按下后立刻布防的长按计时器；手势提前结束（抬起/取消/起拖）都要拆掉 */
function clearHold() {
  if (pointerState.holdTimer) {
    clearTimeout(pointerState.holdTimer);
    pointerState.holdTimer = 0;
  }
}

function indexFromEvent(event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return -1;
  }
  const cardEl = target.closest('.game-spider-card');
  if (!cardEl) {
    return -1;
  }
  return Number(cardEl.dataset.idx);
}

function onPointerDown(event) {
  if (!event.isPrimary || event.button !== 0) {
    return;
  }

  const target = event.target;
  const colEl = target instanceof Element ? target.closest('.game-spider-col') : null;
  const idx = indexFromEvent(event);
  if (!colEl || idx < 0) {
    /* 点在列间空隙或空列上：这次按下不是拖拽候选 */
    pointerState.active = false;
    return;
  }

  pointerState.pointerId = event.pointerId;
  pointerState.col = Number(colEl.dataset.col);
  pointerState.idx = idx;
  pointerState.x0 = event.clientX;
  pointerState.y0 = event.clientY;
  pointerState.pointerType = event.pointerType || 'mouse';
  pointerState.active = true;

  /*
   * 长按起拖：按住不动到达 LONG_PRESS_MS 就直接进入拖拽，不要求横向位移。
   * 期间位移超过 slop 属于滚动手势，onPointerMove 里会提前拆掉这个计时器。
   */
  clearHold();
  pointerState.holdTimer = setTimeout(() => {
    pointerState.holdTimer = 0;
    if (pointerState.active && !drag.value) {
      beginDrag();
    }
  }, LONG_PRESS_MS);
}

/*
 * 起拖。draggableUnit 返回 null（按住的是背面牌 / 尾段不是完整同花降序）时
 * 什么都不做：不捕获指针、不渲染影子、不改 pointerState.col —— 这次按下作废。
 * 两个入口：位移过阈值（onPointerMove）与长按到点（pointerState.holdTimer）。
 */
function beginDrag() {
  const unit = draggableUnit(pointerState.col, pointerState.idx);
  const tableauEl = tableauRef.value;
  if (!unit || !tableauEl) {
    pointerState.active = false;
    return;
  }

  const cardEl = tableauEl.querySelector(
    `.game-spider-col[data-col="${pointerState.col}"] .game-spider-card[data-idx="${pointerState.idx}"]`,
  );
  if (!cardEl) {
    pointerState.active = false;
    return;
  }

  /*
   * 影子的未变换原点 = 影子层 padding box 左上角；影子层 inset:0 贴在表盘上，
   * 而表盘没有 padding / border（静态自查盯着这一条），所以它的边框盒左上角
   * 就是那个原点 —— 起拖这一刻量一次即可，不需要 nextTick、起拖不跳。
   */
  const baseRect = tableauEl.getBoundingClientRect();
  const cardRect = cardEl.getBoundingClientRect();
  dragOrigin = { x: cardRect.left - baseRect.left, y: cardRect.top - baseRect.top };

  colRects = Array.from(tableauEl.querySelectorAll('.game-spider-col')).map((el) => el.getBoundingClientRect());

  drag.value = {
    cards: unit,
    fromCol: pointerState.col,
    fromIdx: pointerState.idx,
    x: dragOrigin.x,
    y: dragOrigin.y,
  };

  clearHold();

  try {
    tableauEl.setPointerCapture(pointerState.pointerId);
  } catch (error) {
    /* 指针可能已经抬起：捕获建不起来也不影响这一轮 */
  }
}

/*
 * 位移一律用「相对按下点的绝对差值」：元素级监听与 window 兜底监听是同一批
 * 函数，同一次 pointermove 会被命中两次 —— 累加式位移会走双倍。
 */
function onPointerMove(event) {
  if (!event.isPrimary || !pointerState.active) {
    return;
  }

  const dx = event.clientX - pointerState.x0;
  const dy = event.clientY - pointerState.y0;

  if (!drag.value) {
    /* 位移超过长按 slop：这是滚动手势，不是长按，拆掉计时器 */
    if (Math.hypot(dx, dy) > LONG_PRESS_SLOP_PX) {
      clearHold();
    }
    if (pointerState.pointerType === 'mouse') {
      /* 鼠标：任意方向过了 4px 就起拖，纵向拖动是合法意图 */
      if (Math.hypot(dx, dy) < DRAG_START_PX) {
        return;
      }
    } else if (Math.abs(dx) < DRAG_START_PX || Math.abs(dx) <= Math.abs(dy)) {
      /* 触屏 / 笔：横向主导才快速起拖，纵向让给页面滚动（长按路径不走这里） */
      return;
    }
    beginDrag();
    return;
  }

  /*
   * 已经在拖：影子全程跟随指针，任意方向都不打断。
   * 触屏的滚动接管由浏览器 pointercancel 兜底回收，不再按纵横比作废拖拽。
   */
  drag.value.x = dragOrigin.x + dx;
  drag.value.y = dragOrigin.y + dy;
}

function endDragAt(clientX) {
  const current = drag.value;
  if (current) {
    const toCol = columnAtX(clientX);
    if (toCol >= 0 && toCol !== current.fromCol && canDrop(current.cards, toCol)) {
      applyMove(current.fromCol, current.fromIdx, toCol);
    }
  }
  abortDrag();
}

function onPointerUp(event) {
  if (!event.isPrimary) {
    return;
  }
  if (!drag.value) {
    clearHold();
    pointerState.active = false;
    return;
  }
  endDragAt(event.clientX);
}

function onPointerCancel(event) {
  if (!event.isPrimary) {
    return;
  }
  clearHold();
  if (!drag.value) {
    return;
  }
  abortDrag();
}

function onLostPointerCapture(event) {
  if (!event.isPrimary || !drag.value) {
    return;
  }
  abortDrag();
}

/* ------------------------------------------------------------------ *
 * 生命周期
 * ------------------------------------------------------------------ */

/*
 * 长按起拖后压住浏览器的滚动接管：表盘是 touch-action: pan-y，手指纵向移动
 * 浏览器就会抢走手势并 pointercancel。非被动 touchmove 里 preventDefault
 * 可以把滚动否掉 —— 只在 drag 活跃时生效，平时滚动不受影响。
 */
function suppressTouchScroll(event) {
  if (drag.value) {
    event.preventDefault();
  }
}

/*
 * pointerup / pointercancel 额外挂在 window 上兜底：手指按住后移出表盘再抬起，
 * 表盘上就收不到抬起了。挂的与元素级是同一批函数，所以它们必须幂等。
 */
onMounted(() => {
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerCancel);
  window.addEventListener('touchmove', suppressTouchScroll, { passive: false });
});

onBeforeUnmount(() => {
  stopTimer();
  clearNoticeTimer();
  clearHold();
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerCancel);
  window.removeEventListener('touchmove', suppressTouchScroll);
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
  <div class="game-panel game-spider" :data-phase="phase">
    <div class="game-board-controls">
      <label class="game-control">
        <span class="game-tool-label">难度</span>
        <select class="game-select" :value="difficulty" @change="onDifficultyChange">
          <option v-for="item in DIFFICULTIES" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
      </label>

      <button class="text-button" type="button" @click="requestNewGame">重新开始</button>

      <div class="game-spider-foundations" aria-label="已完成的花色组">
        <span
          v-for="(suit, index) in foundations"
          :key="`done-${index}`"
          class="game-spider-foundations-card"
          :class="{ 'game-spider-foundations-card--red': isRedSuit(suit) }"
        >{{ suit }}</span>
      </div>
    </div>

    <div class="game-spider-status">
      <span>分数 <span class="game-spider-score">{{ score }}</span></span>
      <span>步数 <span class="game-spider-moves">{{ moves }}</span></span>
      <span>用时 <span class="game-spider-timer">{{ elapsed }}</span></span>
      <span>组数 <span class="game-spider-foundation">{{ foundationLabel }}</span></span>
    </div>

    <p v-if="notice" class="game-spider-notice" role="status">{{ notice }}</p>

    <div class="game-spider-scroll">
      <div
        ref="tableauRef"
        class="game-spider-tableau"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerCancel"
        @lostpointercapture="onLostPointerCapture"
      >
        <div
          v-for="(column, colIndex) in tableau"
          :key="colIndex"
          class="game-spider-col"
          :class="{ 'game-spider-col--empty': column.length === 0 }"
          :data-col="colIndex"
          :data-len="column.length"
        >
          <div
            v-for="(card, cardIndex) in column"
            :key="card.id"
            class="game-spider-card"
            :class="cardClass(card)"
            :data-col="colIndex"
            :data-idx="cardIndex"
            :data-rank="card.rank"
            :data-suit="card.suit"
          >
            <span class="game-spider-rank">{{ cardLabel(card) }}</span>
            <span class="game-spider-suit">{{ card.suit }}</span>
            <span class="game-spider-pip">{{ card.suit }}</span>
          </div>
        </div>

        <div v-if="drag" class="game-spider-drag-layer">
          <div class="game-spider-drag" :style="{ transform: dragTransform }">
            <div
              v-for="(card, cardIndex) in drag.cards"
              :key="card.id"
              class="game-spider-card game-spider-card--up"
              :class="{ 'game-spider-card--red': isRedSuit(card.suit) }"
              :data-col="drag.fromCol"
              :data-idx="cardIndex"
              :data-rank="card.rank"
              :data-suit="card.suit"
            >
              <span class="game-spider-rank">{{ cardLabel(card) }}</span>
              <span class="game-spider-suit">{{ card.suit }}</span>
              <span class="game-spider-pip">{{ card.suit }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <p v-if="phase === 'won'" class="game-done" role="status">八组全部收完了，本局得分 {{ score }}。</p>

    <div class="game-panel-foot">
      <button
        class="game-spider-stock"
        :class="{ 'game-spider-stock--empty': !stock.length }"
        type="button"
        :data-remaining="remainingDeals"
        :disabled="!stock.length"
        @click="deal"
      >
        发牌（剩 {{ remainingDeals }} 次）
      </button>

      <button class="secondary" type="button" :disabled="undoCount === 0" @click="undo">撤销一步</button>
    </div>

    <div v-if="confirmNew" class="game-confirm" role="alertdialog" aria-live="polite">
      <p>这一局还没结束，确定重新开始吗？</p>
      <div class="game-confirm-actions">
        <button class="secondary" type="button" @click="cancelNewGame">继续这一局</button>
        <button class="danger-button" type="button" @click="confirmNewGame">确定重开</button>
      </div>
    </div>
  </div>
</template>
