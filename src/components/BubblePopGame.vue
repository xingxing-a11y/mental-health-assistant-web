<script>
/**
 * 泡泡音效的 AudioContext 单例。
 *
 * 项目里 App.vue 的发声函数是「一声一实例」（每次 new 再 close），那是给低频提示音
 * 用的；游戏里会连着点，反复新建会撞上浏览器对 AudioContext 数量的限制（Chrome 约 6 个），
 * 所以这里改成模块级单例 + suspended 时 resume，任何失败都静默降级 —— 没声音不影响玩。
 */
let audioContext = null;

function ensureAudioContext() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }
    if (!audioContext) {
      audioContext = new AudioContextClass();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    return audioContext;
  } catch (error) {
    return null;
  }
}

/** 一声柔和的「啵」：正弦下滑 + 快速衰减，不刺耳。 */
function playPopSound() {
  const context = ensureAudioContext();
  if (!context) {
    return;
  }
  try {
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(520, now);
    oscillator.frequency.exponentialRampToValueAtTime(180, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.18);
  } catch (error) {
    /* 静默降级：发不出声不影响继续捏 */
  }
}
</script>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { Volume2, VolumeX } from 'lucide-vue-next';

const BUBBLE_TINTS = ['lilac', 'pink', 'sky'];

/** 泡泡个数档位。 */
const COUNT_OPTIONS = [10, 15, 20, 30];

/** 固定出现：整批同时出现。随机出现：按打乱的顺序一个个冒出，间隔也随机。 */
const APPEAR_MODES = [
  { id: 'fixed', label: '固定出现' },
  { id: 'random', label: '随机出现' },
];

const REFILL_DELAY = 420;

/** 一轮结束的提示停留多久，到点自动消失并开始新一轮。 */
const RESULT_DURATION = 2000;

/**
 * 随机出现的节奏档位：每两颗之间的间隔在这个区间里随机取。
 * 只在「随机出现」下生效，所以选项也只在那个模式下显示。
 */
const SPEED_OPTIONS = [
  { id: 'fast', label: '快', min: 120, max: 220 },
  { id: 'medium', label: '中', min: 300, max: 500 },
  { id: 'slow', label: '慢', min: 700, max: 1100 },
];

/** 泡泡直径的上下限（px）。具体值由 layoutBubbles() 按格子大小算。 */
const BUBBLE_MIN = 34;
const BUBBLE_MAX = 64;

/** 画面四周留白，泡泡不贴着边框。 */
const STAGE_INSET = 14;

const soundOn = ref(true);
const appearMode = ref('fixed');
const bubbleCount = ref(COUNT_OPTIONS[0]);
const appearSpeed = ref('medium');
const bubbles = ref([]);
const bubbleSize = ref(BUBBLE_MAX);
const stageEl = ref(null);

/**
 * 随机模式的回合状态：ready = 画面里只有第一颗「启动泡泡」，等用户点它；
 * playing = 其余泡泡按节奏一个个冒出来；done = 这一轮捏完了，正在给提示。
 * 固定模式没有开始与结束，一直停在 playing。
 */
const phase = ref('ready');
const waitingStarter = computed(
  () => appearMode.value === 'random' && phase.value === 'ready',
);
const showResult = computed(() => phase.value === 'done');

let rowSeed = 0;
let refillTimer = null;
let resultTimer = null;
let revealTimers = [];
let lastStageKey = '';
let resizeObserver = null;

function clearRevealTimers() {
  revealTimers.forEach((timerId) => window.clearTimeout(timerId));
  revealTimers = [];
}

function clearRefillTimer() {
  if (refillTimer !== null) {
    window.clearTimeout(refillTimer);
    refillTimer = null;
  }
}

function clearResultTimer() {
  if (resultTimer !== null) {
    window.clearTimeout(resultTimer);
    resultTimer = null;
  }
}

function makeBubbles() {
  rowSeed += 1;
  // 固定模式一上来就全都在；随机模式先全藏起来 —— 只有第 0 颗例外，
  // 它是等着被点破的「启动泡泡」，其余交给点破之后的定时器逐个放出来。
  const fixed = appearMode.value === 'fixed';
  const starterOnly = waitingStarter.value;
  return Array.from({ length: bubbleCount.value }, (unused, index) => ({
    id: `${rowSeed}-${index}`,
    tint: BUBBLE_TINTS[index % BUBBLE_TINTS.length],
    popped: false,
    visible: fixed || (starterOnly && index === 0),
    x: 0,
    y: 0,
  }));
}

/**
 * 把泡泡随机撒在画面里。
 *
 * 用的是「抖动网格」而不是纯随机撒点：先按个数与画面宽高比切出刚好装得下的格子，
 * 每个格子只放一个泡泡，再在格子内部随机偏移。这样既看不出排列规律，
 * 又保证两两不重叠 —— 纯随机撒点会互相压住，被压住的那颗就点不到了。
 */
function layoutBubbles() {
  const stage = stageEl.value;
  const list = bubbles.value;
  if (!stage || list.length === 0) {
    return;
  }

  const width = Math.max(1, stage.clientWidth - STAGE_INSET * 2);
  const height = Math.max(1, stage.clientHeight - STAGE_INSET * 2);
  const count = list.length;

  const cols = Math.max(1, Math.ceil(Math.sqrt((count * width) / height)));
  const rows = Math.max(1, Math.ceil(count / cols));
  const cellWidth = width / cols;
  const cellHeight = height / rows;
  // 每格再留 10px 空隙：一格只放一个泡泡，直径小于格子就一定不重叠
  const size = Math.min(BUBBLE_MAX, Math.max(BUBBLE_MIN, Math.min(cellWidth, cellHeight) - 10));
  bubbleSize.value = size;

  // 格子顺序打乱，避免「第几颗泡泡」决定它落在哪里
  const cells = Array.from({ length: cols * rows }, (unused, index) => index);
  for (let i = cells.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  list.forEach((bubble, index) => {
    const cell = cells[index];
    const col = cell % cols;
    const row = Math.floor(cell / cols);
    bubble.x = STAGE_INSET + col * cellWidth + Math.random() * Math.max(0, cellWidth - size);
    bubble.y = STAGE_INSET + row * cellHeight + Math.random() * Math.max(0, cellHeight - size);
  });

  // 等待启动时画面里只有第 0 颗，它是「点我开始」的提示，摆正中比缩在某个角落显眼
  if (waitingStarter.value && list[0]) {
    list[0].x = (stage.clientWidth - size) / 2;
    list[0].y = (stage.clientHeight - size) / 2;
  }
}

/**
 * 尺寸真变了才重排。
 * ResizeObserver 观察时会立刻回调一次，不比一下尺寸就会在首帧之后把位置又抖一下。
 */
function relayoutOnResize() {
  const stage = stageEl.value;
  if (!stage) {
    return;
  }
  const key = `${stage.clientWidth}x${stage.clientHeight}`;
  if (key === lastStageKey) {
    return;
  }
  lastStageKey = key;
  layoutBubbles();
}

function currentSpeed() {
  return SPEED_OPTIONS.find((item) => item.id === appearSpeed.value) || SPEED_OPTIONS[1];
}

/**
 * 随机模式：把「还没出现」的泡泡按打乱的顺序、以当前档位的随机间隔依次放出来。
 * 只处理未出现的那些，所以中途改速度只影响剩下的泡泡，不会打断当前这一轮。
 */
function scheduleReveal() {
  clearRevealTimers();
  const pending = bubbles.value
    .map((bubble, index) => (bubble.visible ? -1 : index))
    .filter((index) => index >= 0);
  if (pending.length === 0) {
    return;
  }

  for (let i = pending.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pending[i], pending[j]] = [pending[j], pending[i]];
  }

  const speed = currentSpeed();
  let delay = 0;
  pending.forEach((target) => {
    delay += speed.min + Math.random() * (speed.max - speed.min);
    revealTimers.push(window.setTimeout(() => {
      // 必须走 bubbles.value 的代理去改，直接改 makeBubbles 返回的原始对象不会触发更新
      const bubble = bubbles.value[target];
      if (bubble) {
        bubble.visible = true;
      }
    }, delay));
  });
}

function startRow() {
  clearRevealTimers();
  clearRefillTimer();
  clearResultTimer();
  // 随机模式的新一轮从「等一颗启动泡泡」开始；固定模式没有这个阶段，直接铺开
  phase.value = appearMode.value === 'random' ? 'ready' : 'playing';
  bubbles.value = makeBubbles();
  // 换一轮就换一批位置；元素还没挂载时这一步是空操作，由 onMounted 补
  layoutBubbles();
}

function popBubble(bubble) {
  // 还没冒出来的泡泡捏不到（随机模式下它是隐藏且 disabled 的）
  if (bubble.popped || !bubble.visible) {
    return;
  }
  bubble.popped = true;
  if (soundOn.value) {
    playPopSound();
  }

  // 随机模式的第一颗是「启动泡泡」：点破它这一轮才算正式开始，其余这时才开始冒
  if (waitingStarter.value) {
    phase.value = 'playing';
    scheduleReveal();
    return;
  }

  // 未出现的泡泡 popped 仍是 false，所以随机模式中途不会误判成「整轮捏完」
  if (bubbles.value.every((item) => item.popped) && refillTimer === null) {
    refillTimer = window.setTimeout(() => {
      refillTimer = null;
      finishRow();
    }, REFILL_DELAY);
  }
}

/**
 * 一轮捏完之后的收尾。
 * 固定模式维持原样「悄悄换一批」；随机模式先给一条小提示，到点自动消失并开始新一轮。
 */
function finishRow() {
  if (appearMode.value === 'fixed') {
    startRow();
    return;
  }
  phase.value = 'done';
  clearResultTimer();
  resultTimer = window.setTimeout(() => {
    resultTimer = null;
    startRow();
  }, RESULT_DURATION);
}

function setAppearMode(id) {
  if (id === appearMode.value) {
    return;
  }
  appearMode.value = id;
  startRow();
}

function setBubbleCount(count) {
  if (count === bubbleCount.value) {
    return;
  }
  bubbleCount.value = count;
  startRow();
}

function setAppearSpeed(id) {
  if (id === appearSpeed.value) {
    return;
  }
  appearSpeed.value = id;
  // 只给还没冒出来的泡泡重新排期：已经露出来的保持原样，不打断当前这一轮
  // 待启动阶段不能排期，否则其余泡泡会绕过启动泡泡自己冒出来
  if (appearMode.value === 'random' && phase.value === 'playing') {
    scheduleReveal();
  }
}

function toggleSound() {
  soundOn.value = !soundOn.value;
}

onMounted(() => {
  relayoutOnResize();
  if (typeof ResizeObserver !== 'undefined' && stageEl.value) {
    resizeObserver = new ResizeObserver(relayoutOnResize);
    resizeObserver.observe(stageEl.value);
  }
});

onBeforeUnmount(() => {
  clearRevealTimers();
  clearRefillTimer();
  clearResultTimer();
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
});

startRow();
</script>

<template>
  <div class="game-panel game-bubbles-panel">
    <p class="game-hint">
      没有任务，没有输赢。烦躁时，慢慢捏破泡泡，把心里紧绷的情绪一点点释放出来。
    </p>

    <div class="game-bubble-controls">
      <label class="game-control">
        <span class="game-tool-label">出现方式</span>
        <select class="game-select" :value="appearMode" @change="setAppearMode($event.target.value)">
          <option v-for="item in APPEAR_MODES" :key="item.id" :value="item.id">{{ item.label }}</option>
        </select>
      </label>

      <label class="game-control">
        <span class="game-tool-label">泡泡个数</span>
        <select
          class="game-select"
          :value="bubbleCount"
          @change="setBubbleCount(Number($event.target.value))"
        >
          <option v-for="item in COUNT_OPTIONS" :key="item" :value="item">{{ item }} 个</option>
        </select>
      </label>

      <!-- 固定出现是整批同时出来，没有「速度」可言，所以这一项整个不渲染 -->
      <label v-if="appearMode === 'random'" class="game-control">
        <span class="game-tool-label">出现速度</span>
        <select class="game-select" :value="appearSpeed" @change="setAppearSpeed($event.target.value)">
          <option v-for="item in SPEED_OPTIONS" :key="item.id" :value="item.id">{{ item.label }}</option>
        </select>
      </label>
    </div>

    <div
      ref="stageEl"
      class="game-bubbles"
      :style="{ '--game-bubble-size': `${bubbleSize}px` }"
    >
      <button
        v-for="(bubble, index) in bubbles"
        :key="bubble.id"
        type="button"
        class="game-bubble"
        :class="[
          `game-bubble--${bubble.tint}`,
          {
            'game-bubble--popped': bubble.popped,
            'game-bubble--hidden': !bubble.visible,
            'game-bubble--starter': waitingStarter && index === 0,
          },
        ]"
        :style="{ left: `${bubble.x}px`, top: `${bubble.y}px` }"
        :disabled="bubble.popped || !bubble.visible"
        :aria-label="bubble.popped ? '已捏破的泡泡' : '捏破这个泡泡'"
        @click="popBubble(bubble)"
      ></button>
    </div>

    <div class="game-panel-foot">
      <p class="game-note">
        <template v-if="appearMode === 'random'">
          先点破那颗泡泡正式开始，其余的按随机顺序一个个冒出来；全部捏完会出现一条提示，随后开始新一轮。
        </template>
        <template v-else>
          泡泡随机散布在画面里，全部捏完会自动换一批，可以一直捏下去。
        </template>
      </p>
      <button class="text-button game-switch" type="button" @click="toggleSound">
        <component :is="soundOn ? Volume2 : VolumeX" :size="15" />
        {{ soundOn ? '声音已开' : '声音已关' }}
      </button>
    </div>

    <!-- 一轮结束的小提示：只在画面正中浮一小块，不铺遮罩、不吃点击，到点自己消失 -->
    <div v-if="showResult" class="game-result" role="status" aria-live="polite">
      <p class="game-result-toast">
        <span class="game-result-check" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </span>
        这一轮完成啦
      </p>
    </div>
  </div>
</template>
