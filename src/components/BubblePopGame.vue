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
import { onBeforeUnmount, ref } from 'vue';
import { Volume2, VolumeX } from 'lucide-vue-next';

const BUBBLE_TINTS = ['lilac', 'pink', 'sky'];
const BUBBLES_PER_ROW = 10;
const REFILL_DELAY = 420;

const soundOn = ref(true);
const bubbles = ref([]);

let rowSeed = 0;
let refillTimer = null;

function makeRow() {
  rowSeed += 1;
  return Array.from({ length: BUBBLES_PER_ROW }, (unused, index) => ({
    id: `${rowSeed}-${index}`,
    tint: BUBBLE_TINTS[index % BUBBLE_TINTS.length],
    popped: false,
  }));
}

function popBubble(bubble) {
  if (bubble.popped) {
    return;
  }
  bubble.popped = true;
  if (soundOn.value) {
    playPopSound();
  }
  if (bubbles.value.every((item) => item.popped) && refillTimer === null) {
    refillTimer = window.setTimeout(() => {
      refillTimer = null;
      bubbles.value = makeRow();
    }, REFILL_DELAY);
  }
}

function toggleSound() {
  soundOn.value = !soundOn.value;
}

onBeforeUnmount(() => {
  if (refillTimer !== null) {
    window.clearTimeout(refillTimer);
    refillTimer = null;
  }
});

bubbles.value = makeRow();
</script>

<template>
  <div class="game-panel game-bubbles-panel">
    <p class="game-hint">
      没有任务，没有输赢。烦躁时，慢慢捏破泡泡，把心里紧绷的情绪一点点释放出来。
    </p>

    <div class="game-bubbles">
      <button
        v-for="bubble in bubbles"
        :key="bubble.id"
        type="button"
        class="game-bubble"
        :class="[`game-bubble--${bubble.tint}`, { 'game-bubble--popped': bubble.popped }]"
        :disabled="bubble.popped"
        :aria-label="bubble.popped ? '已捏破的泡泡' : '捏破这个泡泡'"
        @click="popBubble(bubble)"
      ></button>
    </div>

    <div class="game-panel-foot">
      <p class="game-note">一整排捏完会自动再来一排，可以一直捏下去。</p>
      <button class="text-button game-switch" type="button" @click="toggleSound">
        <component :is="soundOn ? Volume2 : VolumeX" :size="15" />
        {{ soundOn ? '声音已开' : '声音已关' }}
      </button>
    </div>
  </div>
</template>
