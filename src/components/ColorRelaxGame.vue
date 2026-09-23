<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { Brush, Download, Eraser, Redo2, RotateCcw, Undo2 } from 'lucide-vue-next';
import { gameDraft } from '../utils/gameDraft';

/** 线稿的画布坐标系（与显示尺寸无关，缩放交给 viewBox + preserveAspectRatio）。 */
const ART_WIDTH = 160;
const ART_HEIGHT = 120;

/** 「纸」的底色与线稿描边色：两个主题下都固定，涂色要判断颜色，跟着主题变会让颜色失真。 */
const PAPER_COLOR = '#fdfaf1';
const OUTLINE_COLOR = '#3c4a46';

/** 屏幕上线稿的描边宽度（CSS px）。导出时按这个值反推，保证导出图与屏幕观感一致。 */
const OUTLINE_WIDTH = 1.7;

/** 低饱和色板：涂多久都不扎眼。想用色板之外的颜色走下面的原生取色器。 */
const PALETTE = [
  '#e8b4b0', '#f0cfa6', '#ecdfa4', '#c5ddc1', '#a9d3cd',
  '#b6cde5', '#c8bddf', '#e2c3d4', '#d5cec2', '#9db2ac',
];

const BRUSH_SIZES = [6, 12, 20, 32];

/*
 * 20 个可直接开涂的简单线稿：一条主轮廓 + 若干细节线。
 * 全部按 160 × 120 的坐标系手写，四周留出约 12px 余量，保证任何尺寸下都不会被裁掉。
 */
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
  {
    id: 'sun',
    label: '太阳',
    outline: 'M80 40a24 24 0 1 0 0 48 24 24 0 1 0 0-48z',
    details: [
      'M80 34V20', 'M80 94v14', 'M50 64H36', 'M110 64h14',
      'M59 43l-9-9', 'M101 43l9-9', 'M59 85l-9 9', 'M101 85l9 9',
    ],
  },
  {
    id: 'moon',
    label: '月亮',
    outline: 'M96 24c-27 5-46 22-46 42s19 37 46 42c-12-13-20-25-20-42s8-29 20-42z',
    details: [],
  },
  {
    id: 'star',
    label: '星星',
    outline: 'M80 18 91 49 124 50 98 70 107 101 80 83 53 101 62 70 36 50 69 49z',
    details: [],
  },
  {
    id: 'heart',
    label: '爱心',
    outline: 'M80 100C50 80 26 62 26 42 26 28 36 18 50 18c12 0 22 8 30 20 8-12 18-20 30-20 14 0 24 10 24 24 0 20-24 38-54 58z',
    details: [],
  },
  {
    id: 'house',
    label: '房子',
    outline: 'M28 58 80 20l52 38v54H28z',
    details: ['M66 112V86h28v26', 'M44 66h16v16H44z'],
  },
  {
    id: 'pine',
    label: '松树',
    outline: 'M80 16 36 68h24L36 104h88L100 68h24z',
    details: ['M74 104v10h12v-10'],
  },
  {
    id: 'flower',
    label: '小花',
    outline: 'M80 44a18 18 0 1 0 0 36 18 18 0 1 0 0-36z',
    details: [
      'M80 18a16 16 0 1 0 0 32 16 16 0 1 0 0-32z',
      'M107 37a16 16 0 1 0 0 32 16 16 0 1 0 0-32z',
      'M96 69a16 16 0 1 0 0 32 16 16 0 1 0 0-32z',
      'M64 69a16 16 0 1 0 0 32 16 16 0 1 0 0-32z',
      'M53 37a16 16 0 1 0 0 32 16 16 0 1 0 0-32z',
    ],
  },
  {
    id: 'fish',
    label: '小鱼',
    outline: 'M30 64c0-18 18-30 42-30 22 0 38 12 40 30-2 18-18 30-40 30-24 0-42-12-42-30z',
    details: ['M30 64 8 48v32z', 'M84 54a5 5 0 1 0 0 10 5 5 0 1 0 0-10z', 'M62 38q6-14 20-10', 'M54 48q-8 16 0 32'],
  },
  {
    id: 'umbrella',
    label: '雨伞',
    outline: 'M26 72a54 54 0 0 1 108 0z',
    details: ['M80 18 40 58', 'M80 18 120 58', 'M80 72v34', 'M80 106q0 9-9 9t-9-9'],
  },
  {
    id: 'apple',
    label: '苹果',
    outline: 'M80 40c-8-12-26-18-38-8-14 12-14 38-2 54 8 11 20 20 28 20 4 0 8-2 12-2s8 2 12 2c8 0 20-9 28-20 12-16 12-42-2-54-12-10-30-4-38 8z',
    details: ['M80 40V20', 'M80 30q12-10 20-4-5 12-20 4z'],
  },
  {
    id: 'balloon',
    label: '气球',
    outline: 'M80 20c-24 0-40 18-40 40 0 20 14 34 30 38l10 6 10-6c16-4 30-18 30-38 0-22-16-40-40-40z',
    details: ['M80 104v10'],
  },
  {
    id: 'cup',
    label: '杯子',
    outline: 'M46 40h56l-7 58H53z',
    details: ['M100 52h10a12 12 0 0 1 0 24h-10'],
  },
  {
    id: 'mountain',
    label: '远山',
    outline: 'M16 96 58 34l24 34 18-24 44 52z',
    details: [],
  },
  {
    id: 'drop',
    label: '雨滴',
    outline: 'M80 20c14 20 30 34 30 50a30 30 0 0 1-60 0c0-16 16-30 30-50z',
    details: [],
  },
  {
    id: 'snowman',
    label: '雪人',
    outline: 'M80 20a16 16 0 1 0 0 32 16 16 0 1 0 0-32zM80 52a26 26 0 1 0 0 52 26 26 0 1 0 0-52z',
    details: [
      'M74 30a2 2 0 1 0 0 4 2 2 0 1 0 0-4z',
      'M86 30a2 2 0 1 0 0 4 2 2 0 1 0 0-4z',
      'M80 66a2 2 0 1 0 0 4 2 2 0 1 0 0-4z',
      'M80 80a2 2 0 1 0 0 4 2 2 0 1 0 0-4z',
    ],
  },
  {
    id: 'boat',
    label: '帆船',
    outline: 'M24 84h112l-14 22H38z',
    details: ['M80 84V24', 'M82 28 118 78H82z', 'M78 40 46 78h32z'],
  },
  {
    id: 'note',
    label: '音符',
    outline: 'M48 78a14 10 0 1 0 28 0 14 10 0 1 0-28 0z',
    details: ['M76 78V26', 'M76 26q20 6 18 22'],
  },
];

/** 显示尺寸上限的 DPR，避免 3x 屏上离屏 buffer 过大。 */
const MAX_DPR = 2;

const canvasEl = ref(null);
const artId = ref(ARTWORKS[0].id);
const color = ref(PALETTE[0]);
const brushSize = ref(BRUSH_SIZES[1]);
const mode = ref('brush');
const notice = ref('');
/*
 * 「撤销 / 重做」按钮的可用态。历史数组故意不做成响应式 —— 每落一个点都要往里塞，
 * 深度代理化会白白拖慢涂色，所以只把两个数量同步到 ref 上驱动按钮。
 */
const undoCount = ref(0);
const redoCount = ref(0);
const canUndo = computed(() => undoCount.value > 0);
const canRedo = computed(() => redoCount.value > 0);

let buffer = null;
let bufferCtx = null;
let visibleCtx = null;
let drawing = false;
let resizeObserver = null;
let noticeTimer = null;

/*
 * 撤销 / 重做靠「记下每一笔 + 重放」，不存画布快照：
 * 一步的内存从整幅像素的几 MB 降到约 1KB，撤销是同步的（不用等图片解码），
 * 而且窗口缩放后重放出来照样清晰，不会像快照那样越撤销越糊。
 * 记录有两种：一笔（points 是归一化到 0..1 的扁平坐标，width 是相对画布宽度的线宽比例），
 * 和一次「清空」（clear: true）。
 */
const strokes = [];
const undone = [];
let activeStroke = null;

/*
 * 只渲染当前选中的那一张线稿。
 * 早先是把 20 张全渲染出来、用 v-show 切换，但在 SFC 编译路径下 v-show 挂在 v-for 生成的
 * SVG <g> 上时更新不可靠（按钮选中态变了、纸上的线稿不变），改成单张渲染后这个坑直接消失。
 */
const currentArt = computed(
  () => ARTWORKS.find((item) => item.id === artId.value) || ARTWORKS[0],
);

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

/** 把当前历史换算成两个按钮的可用态。历史数组不是响应式的，每次变更后手动同步。 */
function syncHistoryState() {
  undoCount.value = strokes.length;
  redoCount.value = undone.length;
}

/** 画布上还剩笔迹吗：最后一条记录不是「清空」，就说明清空之后又落过笔。 */
function hasInk() {
  return strokes.length > 0 && !strokes[strokes.length - 1].clear;
}

/**
 * 把一条记录画到画布上。撤销 / 重做重放时用。
 * 参数与落笔那一刻完全一致，重放出来的画面才会和一笔一笔画出来的一样。
 */
function paintAction(item) {
  if (item.clear) {
    bufferCtx.globalCompositeOperation = 'source-over';
    bufferCtx.clearRect(0, 0, buffer.width, buffer.height);
    return;
  }
  bufferCtx.globalCompositeOperation = item.eraser ? 'destination-out' : 'source-over';
  bufferCtx.strokeStyle = item.color;
  bufferCtx.lineWidth = Math.max(1, item.width * buffer.width);

  const points = item.points;
  const firstX = points[0] * buffer.width;
  const firstY = points[1] * buffer.height;
  bufferCtx.beginPath();
  bufferCtx.moveTo(firstX, firstY);
  if (points.length === 2) {
    // 点涂也要留痕，和落笔时那条 0.01 的短线段保持一致
    bufferCtx.lineTo(firstX + 0.01, firstY);
  } else {
    for (let i = 2; i < points.length; i += 2) {
      bufferCtx.lineTo(points[i] * buffer.width, points[i + 1] * buffer.height);
    }
  }
  bufferCtx.stroke();
}

/** 按历史把整幅画重画一遍。撤销 / 重做共用这一条路径。 */
function restoreFromHistory() {
  if (!bufferCtx || !buffer) {
    return;
  }
  bufferCtx.globalCompositeOperation = 'source-over';
  bufferCtx.lineCap = 'round';
  bufferCtx.lineJoin = 'round';
  bufferCtx.clearRect(0, 0, buffer.width, buffer.height);
  strokes.forEach(paintAction);
  bufferCtx.globalCompositeOperation = 'source-over';
  flush();
  gameDraft.color = buffer;
  gameDraft.hasStrokes = hasInk();
}

function undo() {
  if (strokes.length === 0) {
    return;
  }
  undone.push(strokes.pop());
  restoreFromHistory();
  syncHistoryState();
}

function redo() {
  if (undone.length === 0) {
    return;
  }
  strokes.push(undone.pop());
  restoreFromHistory();
  syncHistoryState();
}

/** 直接抹掉画布内容、不记历史 —— 换线稿时用。 */
function wipeCanvas() {
  if (!bufferCtx || !buffer) {
    return;
  }
  bufferCtx.globalCompositeOperation = 'source-over';
  bufferCtx.clearRect(0, 0, buffer.width, buffer.height);
  flush();
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
  // 从落笔这一刻开始记这一步，撤销会把整条笔画一起回退。
  // 线宽按画布物理宽度归一化（和 applyStrokeStyle 里的换算等价），重放时乘回当时的宽度。
  activeStroke = {
    color: color.value,
    width: brushSize.value / Math.max(1, canvasEl.value.getBoundingClientRect().width),
    eraser: mode.value === 'eraser',
    points: [point.x / buffer.width, point.y / buffer.height],
  };
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
  if (activeStroke) {
    activeStroke.points.push(point.x / buffer.width, point.y / buffer.height);
  }
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
  if (activeStroke) {
    strokes.push(activeStroke);
    activeStroke = null;
    // 落过新笔之后，「重做」那条支线就作废了
    undone.length = 0;
    syncHistoryState();
  }
  // 笔画内容的唯一写回点：抬笔即保存，卸载时不再写回。
  // （下方 clearCanvas / pickArtwork 也会动 gameDraft，但那是把画布重置，不是写回笔迹。）
  gameDraft.color = buffer;
  gameDraft.hasStrokes = hasInk();
}

function pickColor(value) {
  color.value = value;
  mode.value = 'brush';
}

/** 清空同样记进历史：手滑点到了，按一次撤销就能救回来。 */
function clearCanvas() {
  if (!bufferCtx || !buffer) {
    return;
  }
  if (!hasInk()) {
    showNotice('画布上还没有笔迹');
    return;
  }
  wipeCanvas();
  strokes.push({ clear: true });
  undone.length = 0;
  syncHistoryState();
  gameDraft.color = buffer;
  gameDraft.hasStrokes = false;
}

/** 换线稿等于换一张干净的纸，否则新线稿会跟上一张的涂色叠在一起。 */
function pickArtwork(id) {
  if (id === artId.value) {
    return;
  }
  artId.value = id;
  // 换一张干净的纸：画布和撤销记录一起清，否则撤销会把上一张纸的涂色倒到新纸上
  strokes.length = 0;
  undone.length = 0;
  activeStroke = null;
  syncHistoryState();
  wipeCanvas();
  gameDraft.color = buffer;
  gameDraft.hasStrokes = false;
  showNotice(`已换成「${ARTWORKS.find((item) => item.id === id)?.label || ''}」，画布已清空`);
}

function showNotice(text) {
  notice.value = text;
  if (noticeTimer !== null) {
    window.clearTimeout(noticeTimer);
  }
  noticeTimer = window.setTimeout(() => {
    notice.value = '';
    noticeTimer = null;
  }, 2200);
}

function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
    + `-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

/**
 * 把线稿描到导出用的画布上。
 * 线稿是 160 × 120 的 viewBox + preserveAspectRatio="xMidYMid meet"，
 * 这里用同一套缩放/居中规则换算，否则导出图里的线稿会和屏幕上错位。
 */
function paintOutline(ctx, width, height, cssWidth) {
  const art = currentArt.value;
  const scale = Math.min(width / ART_WIDTH, height / ART_HEIGHT);
  const offsetX = (width - ART_WIDTH * scale) / 2;
  const offsetY = (height - ART_HEIGHT * scale) / 2;

  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
  // 屏幕上靠 vector-effect: non-scaling-stroke 固定成 1.7 CSS px，这里按同一观感反推
  ctx.lineWidth = (OUTLINE_WIDTH * ART_WIDTH) / Math.max(1, cssWidth);
  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  [art.outline, ...art.details].forEach((pathData) => {
    ctx.stroke(new Path2D(pathData));
  });
  ctx.restore();
}

/** 导出「纸 + 涂色 + 线稿」三层合成后的 PNG，下载到本地。 */
function exportPng() {
  const canvas = canvasEl.value;
  if (!canvas || !buffer) {
    return;
  }
  try {
    const output = document.createElement('canvas');
    output.width = buffer.width;
    output.height = buffer.height;
    const ctx = output.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.fillStyle = PAPER_COLOR;
    ctx.fillRect(0, 0, output.width, output.height);
    ctx.drawImage(buffer, 0, 0);
    paintOutline(ctx, output.width, output.height, canvas.getBoundingClientRect().width);

    const link = document.createElement('a');
    link.download = `静心涂色-${currentArt.value.label}-${timestamp()}.png`;
    link.href = output.toDataURL('image/png');
    link.click();
    showNotice('图片已保存到下载目录');
  } catch (error) {
    showNotice('导出失败，可以截屏保存这一张');
  }
}

onMounted(() => {
  setupBuffer();
  if (typeof ResizeObserver !== 'undefined' && canvasEl.value) {
    resizeObserver = new ResizeObserver(() => setupBuffer());
    resizeObserver.observe(canvasEl.value.parentElement || canvasEl.value);
  }
});

onBeforeUnmount(() => {
  // 卸载不写回草稿（写回已在每次抬笔完成），只收尾自己的观察者与定时器
  drawing = false;
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (noticeTimer !== null) {
    window.clearTimeout(noticeTimer);
    noticeTimer = null;
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
        <label class="game-picker-row">
          <span class="game-picker" :style="{ background: color }">
            <input
              type="color"
              class="game-picker-input"
              :value="color"
              aria-label="自定义颜色"
              @input="pickColor($event.target.value)"
            />
          </span>
          <span class="game-picker-hint">自定义颜色</span>
        </label>

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
          <button type="button" class="secondary" @click="exportPng">
            <Download :size="15" />
            保存
          </button>
          <button type="button" class="secondary" :disabled="!canUndo" @click="undo">
            <Undo2 :size="15" />
            撤销
          </button>
          <button type="button" class="secondary" :disabled="!canRedo" @click="redo">
            <Redo2 :size="15" />
            重做
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
            @click="pickArtwork(item.id)"
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
            <path :d="currentArt.outline" />
            <path v-for="(detail, index) in currentArt.details" :key="index" :d="detail" />
          </svg>
        </div>
      </div>
    </div>

    <div class="game-panel-foot">
      <p class="game-note">
        <template v-if="notice">{{ notice }}</template>
        <template v-else>
          涂色只保留在本次页面里，刷新或关掉标签页就会清空；线稿共 {{ ARTWORKS.length }} 张，切换会换一张干净的纸，撤销记录也一起清空。
        </template>
      </p>
      <p class="game-note">
        当前{{ mode === 'eraser' ? '橡皮' : '画笔' }}，粗细 {{ brushSize }}。
      </p>
    </div>
  </div>
</template>
