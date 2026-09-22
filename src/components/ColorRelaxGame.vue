<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { Brush, Eraser, RotateCcw } from 'lucide-vue-next';
import { gameDraft } from '../utils/gameDraft';

/** 线稿的画布坐标系（与显示尺寸无关，缩放交给 viewBox + preserveAspectRatio）。 */
const ART_WIDTH = 160;
const ART_HEIGHT = 120;

/** 低饱和色板：涂多久都不扎眼。 */
const PALETTE = [
  '#e8b4b0', '#f0cfa6', '#ecdfa4', '#c5ddc1', '#a9d3cd',
  '#b6cde5', '#c8bddf', '#e2c3d4', '#d5cec2', '#9db2ac',
];

const BRUSH_SIZES = [6, 12, 20, 32];

/** 三张可直接开涂的简单线稿：一条主轮廓 + 若干细节线。 */
const ARTWORKS = [
  {
    id: 'cloud',
    label: '云朵',
    outline: 'M36 82c-12 0-20-8-20-18 0-11 8-19 19-19 2-13 13-23 27-23 13 0 24 8 27 20 3-1 6-2 9-2 12 0 22 9 22 21 0 12-10 21-22 21z',
    details: [],
  },
  {
    id: 'leaf',
    label: '叶子',
    outline: 'M80 18c30 12 42 50 0 84-42-34-30-72 0-84z',
    details: ['M80 34v58', 'M80 56l17-11', 'M80 70l14-9'],
  },
  {
    id: 'cat',
    label: '小猫',
    outline: 'M42 72a38 38 0 1 0 76 0 38 38 0 1 0-76 0',
    details: [
      'M52 46 44 14l26 16',
      'M108 46l8-32-26 16',
      'M64 68a5 5 0 1 0 10 0 5 5 0 1 0-10 0',
      'M86 68a5 5 0 1 0 10 0 5 5 0 1 0-10 0',
      'M76 88q4 5 8 0',
    ],
  },
];

/** 显示尺寸上限的 DPR，避免 3x 屏上离屏 buffer 过大。 */
const MAX_DPR = 2;

const canvasEl = ref(null);
const artId = ref(ARTWORKS[0].id);
const color = ref(PALETTE[0]);
const brushSize = ref(BRUSH_SIZES[1]);
const mode = ref('brush');

let buffer = null;
let bufferCtx = null;
let visibleCtx = null;
let drawing = false;
let resizeObserver = null;

function bufferScale() {
  const canvas = canvasEl.value;
  if (!canvas || !buffer) {
    return 1;
  }
  const width = canvas.getBoundingClientRect().width || 1;
  return buffer.width / width;
}

function flush() {
  if (!visibleCtx || !buffer) {
    return;
  }
  visibleCtx.clearRect(0, 0, visibleCtx.canvas.width, visibleCtx.canvas.height);
  visibleCtx.drawImage(buffer, 0, 0);
}

/**
 * 按可见画布的物理像素尺寸重建离屏 buffer。
 * 重建时把旧内容（或草稿）按比例缩放着带进来，所以窗口缩放不会丢笔迹。
 */
function setupBuffer() {
  const canvas = canvasEl.value;
  if (!canvas) {
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width * Math.min(window.devicePixelRatio || 1, MAX_DPR)));
  const height = Math.max(1, Math.round(rect.height * Math.min(window.devicePixelRatio || 1, MAX_DPR)));

  canvas.width = width;
  canvas.height = height;
  visibleCtx = canvas.getContext('2d');

  const previous = buffer;
  const draft = gameDraft.color;
  const next = document.createElement('canvas');
  next.width = width;
  next.height = height;
  const nextCtx = next.getContext('2d');
  if (previous && previous.width > 0) {
    nextCtx.drawImage(previous, 0, 0, previous.width, previous.height, 0, 0, width, height);
  } else if (draft && draft.width > 0) {
    nextCtx.drawImage(draft, 0, 0, draft.width, draft.height, 0, 0, width, height);
  }
  nextCtx.lineCap = 'round';
  nextCtx.lineJoin = 'round';

  buffer = next;
  bufferCtx = nextCtx;
  flush();
}

function toBufferPoint(event) {
  const rect = canvasEl.value.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * buffer.width,
    y: ((event.clientY - rect.top) / rect.height) * buffer.height,
  };
}

function applyStrokeStyle() {
  bufferCtx.globalCompositeOperation = mode.value === 'eraser' ? 'destination-out' : 'source-over';
  bufferCtx.strokeStyle = color.value;
  bufferCtx.lineWidth = Math.max(1, brushSize.value * bufferScale());
}

function onPointerDown(event) {
  if (!bufferCtx || (event.pointerType === 'mouse' && event.button !== 0)) {
    return;
  }
  event.preventDefault();
  try {
    canvasEl.value.setPointerCapture(event.pointerId);
  } catch (error) {
    /* pointerId 无效时（例如合成事件）捕获会抛错，不影响继续画这一笔 */
  }
  drawing = true;
  applyStrokeStyle();
  const point = toBufferPoint(event);
  bufferCtx.beginPath();
  bufferCtx.moveTo(point.x, point.y);
  // 点一下也要留痕，否则「点涂」完全没有反馈
  bufferCtx.lineTo(point.x + 0.01, point.y);
  bufferCtx.stroke();
  flush();
}

function onPointerMove(event) {
  if (!drawing || !bufferCtx) {
    return;
  }
  const point = toBufferPoint(event);
  bufferCtx.lineTo(point.x, point.y);
  bufferCtx.stroke();
  flush();
}

/**
 * 笔画的收尾。抬笔、指针被系统取消、失去捕获都走这里，
 * 否则用手指划到画布外再松开会留下一根悬着的线。
 */
function endStroke() {
  if (!drawing) {
    return;
  }
  drawing = false;
  flush();
  // 笔画内容的唯一写回点：抬笔即保存，卸载时不再写回。
  // （下方 clearCanvas 也会动 gameDraft，但那是把草稿重置成空画布，不是写回笔迹。）
  gameDraft.color = buffer;
  gameDraft.hasStrokes = true;
}

function pickColor(value) {
  color.value = value;
  mode.value = 'brush';
}

function clearCanvas() {
  if (!bufferCtx || !buffer) {
    return;
  }
  bufferCtx.globalCompositeOperation = 'source-over';
  bufferCtx.clearRect(0, 0, buffer.width, buffer.height);
  flush();
  gameDraft.color = buffer;
  gameDraft.hasStrokes = false;
}

onMounted(() => {
  setupBuffer();
  if (typeof ResizeObserver !== 'undefined' && canvasEl.value) {
    resizeObserver = new ResizeObserver(() => setupBuffer());
    resizeObserver.observe(canvasEl.value.parentElement || canvasEl.value);
  }
});

onBeforeUnmount(() => {
  // 卸载不写回草稿（写回已在每次抬笔完成），只收尾自己的观察者
  drawing = false;
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
});
</script>

<template>
  <div class="game-panel game-paint">
    <p class="game-hint">
      不必画得好看，没有对错。按照你的喜好涂色，把当下的感受，变成画面里的色彩。
    </p>

    <div class="game-paint-body">
      <div class="game-paint-tools">
        <p class="game-tool-label">颜色</p>
        <div class="game-palette">
          <button
            v-for="item in PALETTE"
            :key="item"
            type="button"
            class="game-swatch"
            :class="{ 'game-swatch--active': mode === 'brush' && color === item }"
            :style="{ background: item }"
            :aria-label="`选择颜色 ${item}`"
            @click="pickColor(item)"
          ></button>
        </div>

        <p class="game-tool-label">笔刷</p>
        <div class="game-range">
          <button
            v-for="item in BRUSH_SIZES"
            :key="item"
            type="button"
            class="game-range-dot"
            :class="{ 'game-range-dot--active': brushSize === item }"
            :aria-label="`笔刷粗细 ${item}`"
            @click="brushSize = item"
          >
            <span :style="{ width: `${item}px`, height: `${item}px` }"></span>
          </button>
        </div>

        <p class="game-tool-label">工具</p>
        <div class="game-tool-list">
          <button
            type="button"
            class="secondary"
            :class="{ 'is-active': mode === 'brush' }"
            @click="mode = 'brush'"
          >
            <Brush :size="15" />
            涂色
          </button>
          <button
            type="button"
            class="secondary"
            :class="{ 'is-active': mode === 'eraser' }"
            @click="mode = 'eraser'"
          >
            <Eraser :size="15" />
            橡皮
          </button>
          <button type="button" class="secondary" @click="clearCanvas">
            <RotateCcw :size="15" />
            清空
          </button>
        </div>

        <p class="game-tool-label">线稿</p>
        <div class="game-art-list">
          <button
            v-for="item in ARTWORKS"
            :key="item.id"
            type="button"
            class="text-button game-switch"
            :class="{ 'is-active': artId === item.id }"
            @click="artId = item.id"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <div class="game-paint-stage">
        <div class="game-paint-paper">
          <canvas
            ref="canvasEl"
            class="game-paint-canvas"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="endStroke"
            @pointercancel="endStroke"
            @lostpointercapture="endStroke"
          ></canvas>
          <svg
            class="game-paint-art"
            :viewBox="`0 0 ${ART_WIDTH} ${ART_HEIGHT}`"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            <g v-for="item in ARTWORKS" v-show="item.id === artId" :key="item.id">
              <path :d="item.outline" />
              <path v-for="(detail, index) in item.details" :key="index" :d="detail" />
            </g>
          </svg>
        </div>
      </div>
    </div>

    <div class="game-panel-foot">
      <p class="game-note">
        涂色只保留在本次页面里，刷新或关掉标签页就会清空，不会保存到账号。
      </p>
      <p class="game-note">
        当前{{ mode === 'eraser' ? '橡皮' : '画笔' }}，粗细 {{ brushSize }}。
      </p>
    </div>
  </div>
</template>
