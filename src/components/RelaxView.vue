<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts';
import { Gauge, Moon, Pause, Play, Square, Wind } from 'lucide-vue-next';
import { formatDateTime } from '../utils/dateTime';
import { relaxApi } from '../api/modules';

const props = defineProps({
  section: { type: String, default: 'breathe' },
});

const RECORD_TYPE = {
  BREATHE: 'BREATHE',
  MEDITATION: 'MEDITATION',
};

const MAX_RECORD_SECONDS = 3600;
const TREND_DAYS = 30;
const STRESS_MIN = 1;
const STRESS_MAX = 10;

/** 4-7-8 呼吸法的三个阶段，秒数固定，前端只负责引导与计时。 */
const BREATH_PHASES = [
  { key: 'INHALE', label: '吸气', hint: '用鼻子缓慢吸气', seconds: 4 },
  { key: 'HOLD', label: '屏息', hint: '轻轻屏住呼吸', seconds: 7 },
  { key: 'EXHALE', label: '呼气', hint: '用嘴缓缓呼气', seconds: 8 },
];

const overview = ref(null);
const meditations = ref([]);
const records = ref([]);
const stressLogs = ref([]);
const stressTrend = ref([]);
const loading = ref(false);
const message = ref('');
const error = ref('');

const breathing = ref(false);
const breathPhaseIndex = ref(0);
const breathSecondsLeft = ref(BREATH_PHASES[0].seconds);
const breathRounds = ref(0);
const breathElapsed = ref(0);
let breathTimerId;

const playingMeditationId = ref(null);
const meditationSegmentIndex = ref(0);
const meditationElapsed = ref(0);
let meditationTimerId;

const stressLevel = ref(5);
const stressNote = ref('');
const stressSaving = ref(false);

const stressTrendChart = ref(null);
let stressTrendChartInstance;

const currentPhase = computed(() => BREATH_PHASES[breathPhaseIndex.value]);

const currentMeditation = computed(() => meditations.value.find(
  (item) => item.id === playingMeditationId.value,
) || null);

const currentMeditationSegment = computed(() => {
  const meditation = currentMeditation.value;
  if (!meditation || !meditation.segments?.length) {
    return '';
  }
  return meditation.segments[meditationSegmentIndex.value] || '';
});

const breathProgress = computed(() => {
  const total = currentPhase.value.seconds;
  return Math.max(0, Math.min(1, (total - breathSecondsLeft.value) / total));
});

function formatSeconds(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

async function loadOverview() {
  try {
    overview.value = await relaxApi.overview();
  } catch (requestError) {
    error.value = requestError.message;
  }
}

async function loadMeditations() {
  try {
    meditations.value = await relaxApi.meditations() || [];
  } catch (requestError) {
    error.value = requestError.message;
  }
}

async function loadRecords() {
  try {
    const page = await relaxApi.records(0, 10);
    records.value = page.items || [];
  } catch (requestError) {
    error.value = requestError.message;
  }
}

async function loadStressLogs() {
  try {
    const page = await relaxApi.stressLogs(0, 10);
    stressLogs.value = page.items || [];
  } catch (requestError) {
    error.value = requestError.message;
  }
}

async function loadStressTrend() {
  try {
    stressTrend.value = await relaxApi.stressTrend(TREND_DAYS) || [];
    await nextTick();
    renderStressTrend();
  } catch (requestError) {
    error.value = requestError.message;
  }
}

async function loadAll() {
  loading.value = true;
  error.value = '';
  await Promise.all([
    loadOverview(),
    loadMeditations(),
    loadRecords(),
    loadStressLogs(),
    loadStressTrend(),
  ]);
  loading.value = false;
}

function clearBreathTimer() {
  if (breathTimerId) {
    window.clearInterval(breathTimerId);
    breathTimerId = undefined;
  }
}

function advanceBreathPhase() {
  const nextIndex = (breathPhaseIndex.value + 1) % BREATH_PHASES.length;
  breathPhaseIndex.value = nextIndex;
  breathSecondsLeft.value = BREATH_PHASES[nextIndex].seconds;

  if (nextIndex === 0) {
    breathRounds.value += 1;
  }
}

function startBreathing() {
  clearBreathTimer();
  breathing.value = true;
  breathElapsed.value = 0;
  breathRounds.value = 0;
  breathPhaseIndex.value = 0;
  breathSecondsLeft.value = BREATH_PHASES[0].seconds;

  breathTimerId = window.setInterval(() => {
    breathElapsed.value += 1;

    if (breathElapsed.value >= MAX_RECORD_SECONDS) {
      stopBreathing(true);
      return;
    }

    if (breathSecondsLeft.value > 1) {
      breathSecondsLeft.value -= 1;
      return;
    }

    advanceBreathPhase();
  }, 1000);
}

function stopBreathing(saveRecord = false) {
  clearBreathTimer();
  breathing.value = false;

  if (!saveRecord || breathElapsed.value < 1) {
    return;
  }

  saveRelaxRecord({
    type: RECORD_TYPE.BREATHE,
    durationSeconds: breathElapsed.value,
    rounds: Math.max(breathRounds.value, 1),
  });
}

async function saveRelaxRecord(payload) {
  try {
    await relaxApi.createRecord(payload);
    message.value = '练习记录已保存';
    await Promise.all([loadRecords(), loadOverview()]);
  } catch (requestError) {
    error.value = requestError.message;
  }
}

function clearMeditationTimer() {
  if (meditationTimerId) {
    window.clearInterval(meditationTimerId);
    meditationTimerId = undefined;
  }
}

/** 用浏览器内置语音合成朗读引导词，不引入任何音频素材。 */
function speakSegment(text) {
  if (!window.speechSynthesis || !text) {
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

function playMeditation(meditation) {
  if (playingMeditationId.value === meditation.id) {
    stopMeditation(true);
    return;
  }

  stopMeditation(false);
  playingMeditationId.value = meditation.id;
  meditationSegmentIndex.value = 0;
  meditationElapsed.value = 0;
  speakSegment(currentMeditationSegment.value);

  meditationTimerId = window.setInterval(() => {
    meditationElapsed.value += 1;

    const segments = currentMeditation.value?.segments || [];
    if (meditationElapsed.value % 20 === 0 && meditationSegmentIndex.value < segments.length - 1) {
      meditationSegmentIndex.value += 1;
      speakSegment(segments[meditationSegmentIndex.value]);
    }

    if (meditationElapsed.value >= MAX_RECORD_SECONDS) {
      stopMeditation(true);
    }
  }, 1000);
}

function stopMeditation(saveRecord = false) {
  const meditationId = playingMeditationId.value;
  const elapsed = meditationElapsed.value;

  clearMeditationTimer();
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  playingMeditationId.value = null;
  meditationSegmentIndex.value = 0;

  if (!saveRecord || !meditationId || elapsed < 1) {
    return;
  }

  saveRelaxRecord({
    type: RECORD_TYPE.MEDITATION,
    durationSeconds: elapsed,
    rounds: null,
  });
}

async function submitStressLog() {
  if (stressSaving.value) {
    return;
  }

  stressSaving.value = true;
  error.value = '';
  try {
    await relaxApi.createStressLog({
      level: stressLevel.value,
      note: stressNote.value.trim() || null,
    });
    stressNote.value = '';
    message.value = '压力打卡已记录';
    await Promise.all([loadStressLogs(), loadStressTrend(), loadOverview()]);
  } catch (requestError) {
    error.value = requestError.message;
  } finally {
    stressSaving.value = false;
  }
}

function renderStressTrend() {
  if (!stressTrendChart.value || props.section !== 'stress') {
    return;
  }

  if (!stressTrendChartInstance) {
    stressTrendChartInstance = echarts.init(stressTrendChart.value);
  }

  stressTrendChartInstance.setOption({
    grid: { left: 44, right: 20, top: 24, bottom: 32 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: stressTrend.value.map((point) => point.logDate),
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: STRESS_MAX,
    },
    series: [
      {
        type: 'line',
        smooth: true,
        symbolSize: 7,
        areaStyle: { opacity: 0.18 },
        data: stressTrend.value.map((point) => point.averageLevel),
      },
    ],
  });
}

function resizeStressTrend() {
  stressTrendChartInstance?.resize();
}

watch(
  () => props.section,
  async (section) => {
    if (section === 'stress') {
      await nextTick();
      renderStressTrend();
    }
  },
);

onMounted(() => {
  loadAll();
  window.addEventListener('resize', resizeStressTrend);
});

onBeforeUnmount(() => {
  clearBreathTimer();
  clearMeditationTimer();
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  window.removeEventListener('resize', resizeStressTrend);
  stressTrendChartInstance?.dispose();
  stressTrendChartInstance = undefined;
});
</script>

<template>
  <section class="content relax-page">
    <div class="section-title relax-heading">
      <div>
        <span class="eyebrow">RELAX TOOLKIT</span>
        <h2>放松小工具</h2>
        <p>用几分钟的呼吸、冥想或一次压力打卡，让情绪先慢下来。</p>
      </div>
    </div>

    <p v-if="loading" class="loading-state">正在加载放松数据...</p>
    <p v-if="error" class="form-error">{{ error }}</p>
    <p v-if="message" class="success-message">{{ message }}</p>

    <div class="metric-grid">
      <article class="metric-card">
        <span>本周练习次数</span>
        <strong>{{ overview?.weekPracticeCount ?? 0 }}</strong>
      </article>
      <article class="metric-card metric-card-gold">
        <span>本周平均压力</span>
        <strong>{{ overview?.weekAverageStress ?? '暂无' }}</strong>
      </article>
      <article class="metric-card metric-card-blue">
        <span>累计练习次数</span>
        <strong>{{ overview?.totalPracticeCount ?? 0 }}</strong>
      </article>
      <article class="metric-card">
        <span>最近压力打卡</span>
        <strong>{{ overview?.latestStressLevel ?? '暂无' }}</strong>
        <small>
          {{ overview?.latestStressAt ? formatDateTime(overview.latestStressAt) : '还没有打卡记录' }}
        </small>
      </article>
    </div>

    <div v-if="section === 'breathe'" class="relax-panel">
      <div class="relax-panel-head">
        <Wind :size="20" />
        <div>
          <h3>4-7-8 呼吸放松</h3>
          <p>吸气 4 秒、屏息 7 秒、呼气 8 秒，跟着圆的节奏重复即可。</p>
        </div>
      </div>

      <div class="breath-stage">
        <div
          class="breath-circle"
          :class="{ active: breathing, 'phase-exhale': currentPhase.key === 'EXHALE' }"
          :style="{ '--breath-progress': breathProgress }"
        >
          <strong>{{ breathing ? currentPhase.label : '准备' }}</strong>
          <span>{{ breathing ? breathSecondsLeft : BREATH_PHASES[0].seconds }} 秒</span>
        </div>
        <div class="breath-meta">
          <span>已完成 {{ breathRounds }} 轮</span>
          <span>计时 {{ formatSeconds(breathElapsed) }}</span>
          <span v-if="breathing">{{ currentPhase.hint }}</span>
        </div>
      </div>

      <div class="relax-actions">
        <button v-if="!breathing" class="primary-button" type="button" @click="startBreathing">
          <Play :size="16" />开始呼吸练习
        </button>
        <button v-else class="primary-button" type="button" @click="stopBreathing(true)">
          <Square :size="16" />结束并记录
        </button>
        <button class="text-button" type="button" :disabled="!breathing" @click="stopBreathing(false)">
          <Pause :size="15" />放弃本次
        </button>
      </div>

      <div class="relax-history">
        <h4>最近练习</h4>
        <p v-if="!records.length" class="empty-state">还没有练习记录。</p>
        <ul v-else>
          <li v-for="record in records" :key="record.id">
            <span>{{ record.type === 'BREATHE' ? '呼吸放松' : '正念冥想' }}</span>
            <span>{{ formatSeconds(record.durationSeconds) }}</span>
            <span>{{ record.rounds ? `${record.rounds} 轮` : '—' }}</span>
            <time>{{ formatDateTime(record.createdAt) }}</time>
          </li>
        </ul>
      </div>
    </div>

    <div v-else-if="section === 'meditation'" class="relax-panel">
      <div class="relax-panel-head">
        <Moon :size="20" />
        <div>
          <h3>正念冥想引导</h3>
          <p>选择一段引导词，浏览器会用语音合成逐段朗读，无需下载音频。</p>
        </div>
      </div>

      <div class="meditation-grid">
        <article
          v-for="meditation in meditations"
          :key="meditation.id"
          class="meditation-card"
          :class="{ playing: playingMeditationId === meditation.id }"
        >
          <div class="meditation-card-head">
            <strong>{{ meditation.title }}</strong>
            <span>{{ meditation.minutes }} 分钟</span>
          </div>
          <p>{{ meditation.description }}</p>
          <button
            class="primary-button"
            type="button"
            @click="playMeditation(meditation)"
          >
            <template v-if="playingMeditationId === meditation.id">
              <Square :size="15" />结束并记录
            </template>
            <template v-else>
              <Play :size="15" />开始引导
            </template>
          </button>
        </article>
      </div>

      <div v-if="currentMeditation" class="meditation-player">
        <span class="eyebrow">NOW PLAYING</span>
        <h4>{{ currentMeditation.title }}</h4>
        <p>{{ currentMeditationSegment }}</p>
        <small>已进行 {{ formatSeconds(meditationElapsed) }}，结束后会保存练习记录。</small>
      </div>
    </div>

    <div v-else-if="section === 'stress'" class="relax-panel">
      <div class="relax-panel-head">
        <Gauge :size="20" />
        <div>
          <h3>压力打卡</h3>
          <p>给此刻的压力打分（1 分很轻松，10 分非常紧绷），不需要写长篇日记。</p>
        </div>
      </div>

      <form class="stress-form" @submit.prevent="submitStressLog">
        <label class="stress-level-field">
          <span>当前压力等级：{{ stressLevel }} 分</span>
          <input v-model.number="stressLevel" type="range" :min="STRESS_MIN" :max="STRESS_MAX" step="1" />
          <span class="stress-level-scale">
            <small>{{ STRESS_MIN }} 分 轻松</small>
            <small>{{ STRESS_MAX }} 分 紧绷</small>
          </span>
        </label>
        <label class="stress-note-field">
          <span>备注（可选，最多 200 字）</span>
          <textarea v-model="stressNote" maxlength="200" rows="3" placeholder="简单描述触发压力的事情..." />
        </label>
        <button class="primary-button" type="submit" :disabled="stressSaving">
          {{ stressSaving ? '记录中...' : '记录这次压力' }}
        </button>
      </form>

      <div class="relax-history">
        <h4>近 30 天压力曲线</h4>
        <p v-if="!stressTrend.length" class="empty-state">还没有压力打卡，记录一次即可看到曲线。</p>
        <div v-else ref="stressTrendChart" class="stress-trend-chart"></div>
      </div>

      <div class="relax-history">
        <h4>最近打卡</h4>
        <p v-if="!stressLogs.length" class="empty-state">还没有打卡记录。</p>
        <ul v-else>
          <li v-for="log in stressLogs" :key="log.id">
            <span>{{ log.level }} 分</span>
            <span>{{ log.note || '未填写备注' }}</span>
            <time>{{ formatDateTime(log.createdAt) }}</time>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
