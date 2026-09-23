<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import { RotateCcw } from 'lucide-vue-next';

/**
 * 卡片数量与配套的列数上限。
 * 卡片尺寸固定不缩，列数整除数量后行数就是 数量 / 列数：
 * 12 张排 4 列 = 3 行，16 张排 4 列 = 4 行，20 张排 5 列 = 4 行，32 张排 8 列 = 4 行。
 * 行数压在 3～4 行，再多就交给 .game-board-scroll 上下滑动。
 */
const COUNT_OPTIONS = [
  { cards: 12, columns: 4 },
  { cards: 16, columns: 4 },
  { cards: 20, columns: 5 },
  { cards: 32, columns: 8 },
];

/** 最多 16 对（32 张）。数量越大用到的图案越多，前六个与初版保持一致。 */
const EMOJIS = ['🌿', '🌙', '☁️', '🌸', '🐚', '🍃', '⭐', '🍀', '🌊', '🍂', '🦋', '🌻', '🍵', '🐟', '🔔', '🌈'];

const FLIP_BACK_DELAY = 760;

const cardCount = ref(COUNT_OPTIONS[0].cards);
const cards = ref([]);
const flipped = ref([]);
const locked = ref(false);

/**
 * 只把「列数上限」下发给样式表，卡片尺寸留在 CSS 里 ——
 * 窄屏需要整体调小尺寸时由媒体查询统一处理，内联样式反而覆盖不掉。
 */
const boardStyle = computed(() => {
  const preset = COUNT_OPTIONS.find((item) => item.cards === cardCount.value) || COUNT_OPTIONS[0];
  return { '--game-memory-cols': preset.columns };
});

/**
 * 每局的代号。翻错后的延时回调会先核对代号，期间点过「重新开始」就作废，
 * 否则上一局的回调会把新一局的牌翻回去。
 */
const generation = ref(0);

/** setTimeout 句柄集中登记，重开与卸载时统一清掉。 */
let pendingTimers = [];

const solved = computed(
  () => cards.value.length > 0 && cards.value.every((card) => card.matched),
);

function shuffle(items) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function startNewRound() {
  generation.value += 1;
  pendingTimers.forEach((timer) => window.clearTimeout(timer));
  pendingTimers = [];
  // 必须显式复位：上一局可能正停在「等两张错牌翻回去」的锁定态
  locked.value = false;
  flipped.value = [];
  const pairs = EMOJIS.slice(0, cardCount.value / 2);
  cards.value = shuffle([...pairs, ...pairs]).map((emoji, index) => ({
    key: `${index}-${emoji}`,
    emoji,
    flipped: false,
    matched: false,
  }));
}

function setCardCount(count) {
  if (count === cardCount.value) {
    return;
  }
  cardCount.value = count;
  // 换数量等于换一副牌，直接开新一局，免得新旧卡混在网格里
  startNewRound();
}

function flipCard(card) {
  if (locked.value || card.matched || card.flipped) {
    return;
  }
  card.flipped = true;
  flipped.value = [...flipped.value, card];
  if (flipped.value.length < 2) {
    return;
  }
  const [first, second] = flipped.value;
  if (first.emoji === second.emoji) {
    first.matched = true;
    second.matched = true;
    flipped.value = [];
    return;
  }
  locked.value = true;
  const ticket = generation.value;
  const timer = window.setTimeout(() => {
    pendingTimers = pendingTimers.filter((item) => item !== timer);
    if (ticket !== generation.value) {
      return;
    }
    first.flipped = false;
    second.flipped = false;
    flipped.value = [];
    locked.value = false;
  }, FLIP_BACK_DELAY);
  pendingTimers.push(timer);
}

function cardLabel(card) {
  if (card.matched) {
    return '已配对的卡片';
  }
  return card.flipped ? '翻开的卡片' : '未翻开的卡片';
}

onBeforeUnmount(() => {
  generation.value += 1;
  pendingTimers.forEach((timer) => window.clearTimeout(timer));
  pendingTimers = [];
});

startNewRound();
</script>

<template>
  <div class="game-panel game-board-panel">
    <p class="game-hint">
      不限时间，没有扣分。慢慢寻找配对，让纷乱的想法暂时停下来，感受专注的平静。
    </p>

    <div class="game-board-controls">
      <label class="game-control">
        <span class="game-tool-label">卡片数量</span>
        <select
          class="game-select"
          :value="cardCount"
          @change="setCardCount(Number($event.target.value))"
        >
          <option v-for="item in COUNT_OPTIONS" :key="item.cards" :value="item.cards">
            {{ item.cards }} 张
          </option>
        </select>
      </label>
    </div>

    <!-- 只有这一层滚动：卡片排不下时上下滑动，上下的提示与按钮都留在原地 -->
    <div class="game-board-scroll">
      <div class="game-board" :style="boardStyle">
        <button
          v-for="card in cards"
          :key="card.key"
          type="button"
          class="game-flip"
          :class="{
            'game-flip--open': card.flipped || card.matched,
            'game-flip--matched': card.matched,
          }"
          :aria-label="cardLabel(card)"
          @click="flipCard(card)"
        >
          <span class="game-flip-inner">
            <span class="game-flip-face game-flip-back" aria-hidden="true">?</span>
            <span class="game-flip-face game-flip-front" aria-hidden="true">{{ card.emoji }}</span>
          </span>
        </button>
      </div>
    </div>

    <p v-if="solved" class="game-done" role="status">
      很棒，你完成啦，可以随时重新开始
    </p>

    <div class="game-panel-foot">
      <p class="game-note">{{ cards.length }} 张卡片，{{ cards.length / 2 }} 对图案。</p>
      <button class="text-button game-switch" type="button" @click="startNewRound">
        <RotateCcw :size="15" />
        重新开始
      </button>
    </div>
  </div>
</template>
