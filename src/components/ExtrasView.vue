<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts';
import {
  Bookmark,
  Compass,
  GitCompare,
  Search,
  Star,
  StarOff,
  Trash2,
} from 'lucide-vue-next';
import { formatDateTime } from '../utils/dateTime';
import { assessmentApi, chatApi } from '../api/modules';

const props = defineProps({
  section: { type: String, default: 'compare' },
});

const emit = defineEmits(['start-scale', 'notify']);

const MESSAGE_PAGE_SIZE = 10;

const scales = ref([]);
const favoriteScales = ref([]);
const recommendations = ref([]);
const comparisons = ref([]);
const selectedScaleId = ref('');
const loading = ref(false);
const error = ref('');

const favoriteMessages = ref([]);
const messageKeyword = ref('');
const messagePage = ref(0);
const messageTotal = ref(0);
const messageTotalPages = ref(0);
const messagesLoading = ref(false);

const compareChart = ref(null);
let compareChartInstance;

const selectedScaleName = computed(() => scales.value
  .find((scale) => String(scale.id) === String(selectedScaleId.value))?.name || '');

async function loadScales() {
  scales.value = await assessmentApi.scales() || [];
  if (!selectedScaleId.value && scales.value.length) {
    selectedScaleId.value = scales.value[0].id;
  }
}

async function loadFavoriteScales() {
  favoriteScales.value = await assessmentApi.favorites() || [];
}

async function loadRecommendations() {
  recommendations.value = await assessmentApi.recommendations() || [];
}

async function loadComparisons() {
  if (!selectedScaleId.value) {
    comparisons.value = [];
    return;
  }

  comparisons.value = await assessmentApi.scaleHistory(selectedScaleId.value) || [];
  await nextTick();
  renderCompareChart();
}

async function loadFavoriteMessages(page = 0) {
  messagesLoading.value = true;
  try {
    const result = await chatApi.favorites({
      page,
      size: MESSAGE_PAGE_SIZE,
      keyword: messageKeyword.value.trim(),
    });
    favoriteMessages.value = result.items || [];
    messagePage.value = result.page || 0;
    messageTotal.value = result.total || 0;
    messageTotalPages.value = result.totalPages || 0;
  } catch (requestError) {
    error.value = requestError.message;
  } finally {
    messagesLoading.value = false;
  }
}

async function loadSection() {
  loading.value = true;
  error.value = '';

  try {
    if (props.section === 'compare') {
      await loadScales();
      await loadComparisons();
    }
    if (props.section === 'favorites') {
      await Promise.all([loadScales(), loadFavoriteScales()]);
    }
    if (props.section === 'recommend') {
      await loadRecommendations();
    }
    if (props.section === 'messages') {
      await loadFavoriteMessages(0);
    }
  } catch (requestError) {
    error.value = requestError.message;
  } finally {
    loading.value = false;
  }
}

async function changeCompareScale() {
  error.value = '';
  try {
    await loadComparisons();
  } catch (requestError) {
    error.value = requestError.message;
  }
}

async function updateScaleFavorite(scaleId, favorite) {
  error.value = '';
  try {
    await assessmentApi.updateFavorite(scaleId, favorite);
    await Promise.all([loadFavoriteScales(), loadScales(), loadRecommendations()]);
    emit('notify', favorite ? '已加入收藏' : '已取消收藏');
  } catch (requestError) {
    error.value = requestError.message;
  }
}

async function removeFavoriteMessage(messageId) {
  error.value = '';
  try {
    await chatApi.removeFavorite(messageId);
    await loadFavoriteMessages(messagePage.value);
    emit('notify', '已取消收藏');
  } catch (requestError) {
    error.value = requestError.message;
  }
}

function searchFavoriteMessages() {
  loadFavoriteMessages(0);
}

function changeMessagePage(page) {
  if (page < 0 || (messageTotalPages.value && page >= messageTotalPages.value)) {
    return;
  }
  loadFavoriteMessages(page);
}

function renderCompareChart() {
  if (!compareChart.value || props.section !== 'compare') {
    return;
  }

  if (!compareChartInstance) {
    compareChartInstance = echarts.init(compareChart.value);
  }

  const points = [...comparisons.value].reverse();
  compareChartInstance.setOption({
    grid: { left: 48, right: 20, top: 24, bottom: 32 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: points.map((point) => formatDateTime(point.createdAt)),
      axisLabel: { hideOverlap: true },
    },
    yAxis: { type: 'value', scale: true },
    series: [
      {
        type: 'line',
        smooth: true,
        symbolSize: 7,
        areaStyle: { opacity: 0.16 },
        data: points.map((point) => point.standardScore),
      },
    ],
  });
}

function resizeCompareChart() {
  compareChartInstance?.resize();
}

watch(() => props.section, loadSection);
watch(() => props.section, async (section) => {
  if (section === 'compare') {
    await nextTick();
    renderCompareChart();
  }
});

onMounted(() => {
  loadSection();
  window.addEventListener('resize', resizeCompareChart);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCompareChart);
  compareChartInstance?.dispose();
  compareChartInstance = undefined;
});
</script>

<template>
  <section class="content extras-page">
    <div class="section-title extras-heading">
      <div>
        <span class="eyebrow">EXTENDED TOOLKIT</span>
        <h2>拓展功能</h2>
        <p>把多次测评、收藏量表和对话收藏集中在一起，方便随时回看。</p>
      </div>
    </div>

    <p v-if="loading" class="loading-state">正在加载拓展数据...</p>
    <p v-if="error" class="form-error">{{ error }}</p>

    <div v-if="section === 'compare'" class="extras-panel">
      <div class="extras-panel-head">
        <GitCompare :size="20" />
        <div>
          <h3>测评结果对比</h3>
          <p>选择一份量表，查看历次标准分的变化趋势。</p>
        </div>
      </div>

      <label class="extras-select">
        <span>选择量表</span>
        <select v-model="selectedScaleId" @change="changeCompareScale">
          <option v-for="scale in scales" :key="scale.id" :value="scale.id">
            {{ scale.name }}
          </option>
        </select>
      </label>

      <p v-if="!comparisons.length" class="empty-state">
        {{ selectedScaleName ? '这份量表还没有测评记录。' : '暂无可对比的量表。' }}
      </p>
      <template v-else>
        <div ref="compareChart" class="extras-chart"></div>
        <ul class="comparison-list">
          <li v-for="item in comparisons" :key="item.resultId">
            <time>{{ formatDateTime(item.createdAt) }}</time>
            <span>总分 {{ item.totalScore }}</span>
            <span>标准分 {{ item.standardScore }}</span>
            <span>{{ item.rangeDescription }}</span>
          </li>
        </ul>
      </template>
    </div>

    <div v-else-if="section === 'favorites'" class="extras-panel">
      <div class="extras-panel-head">
        <Star :size="20" />
        <div>
          <h3>测评收藏</h3>
          <p>收藏感兴趣的量表，下次不必再翻列表。</p>
        </div>
      </div>

      <p v-if="!favoriteScales.length" class="empty-state">
        还没有收藏量表，可以在下方“全部量表”里点击收藏。
      </p>
      <div v-else class="scale-grid">
        <article v-for="scale in favoriteScales" :key="scale.scaleId" class="scale-card">
          <div class="scale-card-copy">
            <h3>{{ scale.name }}</h3>
            <p>{{ scale.description }}</p>
          </div>
          <div class="scale-card-actions">
            <button class="primary-button" type="button" @click="emit('start-scale', scale.scaleId)">
              去测评
            </button>
            <button class="text-button" type="button" @click="updateScaleFavorite(scale.scaleId, false)">
              <StarOff :size="15" />取消收藏
            </button>
          </div>
        </article>
      </div>

      <h4 class="extras-subheading">全部量表</h4>
      <ul class="favorite-toggle-list">
        <li v-for="scale in scales" :key="scale.id">
          <span>{{ scale.name }}</span>
          <button
            class="text-button"
            type="button"
            @click="updateScaleFavorite(scale.id, !scale.favorited)"
          >
            <Star v-if="!scale.favorited" :size="15" />
            <StarOff v-else :size="15" />
            {{ scale.favorited ? '取消收藏' : '收藏' }}
          </button>
        </li>
      </ul>
    </div>

    <div v-else-if="section === 'recommend'" class="extras-panel">
      <div class="extras-panel-head">
        <Compass :size="20" />
        <div>
          <h3>量表推荐</h3>
          <p>根据你的历史测评结果排序，仅供参考，不构成诊断建议。</p>
        </div>
      </div>

      <p v-if="!recommendations.length" class="empty-state">暂无可推荐的量表。</p>
      <ul v-else class="recommendation-list">
        <li v-for="item in recommendations" :key="item.scaleId">
          <div class="recommendation-copy">
            <strong>{{ item.name }}</strong>
            <p>{{ item.description }}</p>
            <small>推荐理由：{{ item.reason }}</small>
          </div>
          <div class="recommendation-actions">
            <button class="primary-button" type="button" @click="emit('start-scale', item.scaleId)">
              去测评
            </button>
          </div>
        </li>
      </ul>
    </div>

    <div v-else-if="section === 'messages'" class="extras-panel">
      <div class="extras-panel-head">
        <Bookmark :size="20" />
        <div>
          <h3>消息收藏</h3>
          <p>集中查看收藏过的 AI 回复，最多保留最近 50 条一页。</p>
        </div>
      </div>

      <form class="extras-search" @submit.prevent="searchFavoriteMessages">
        <Search :size="16" />
        <input v-model="messageKeyword" type="search" placeholder="按关键字搜索收藏内容" />
        <button class="secondary" type="submit">搜索</button>
      </form>

      <p v-if="messagesLoading" class="loading-state">正在加载收藏消息...</p>
      <p v-else-if="!favoriteMessages.length" class="empty-state">还没有收藏消息。</p>
      <ul v-else class="favorite-message-list">
        <li v-for="message in favoriteMessages" :key="message.id">
          <p>{{ message.content }}</p>
          <div class="favorite-message-meta">
            <time>{{ formatDateTime(message.createdAt) }}</time>
            <button class="text-button" type="button" @click="removeFavoriteMessage(message.id)">
              <Trash2 :size="15" />取消收藏
            </button>
          </div>
        </li>
      </ul>

      <div v-if="messageTotalPages > 1" class="pagination">
        <button
          class="text-button"
          type="button"
          :disabled="messagePage <= 0"
          @click="changeMessagePage(messagePage - 1)"
        >
          上一页
        </button>
        <span>第 {{ messagePage + 1 }} / {{ messageTotalPages }} 页，共 {{ messageTotal }} 条</span>
        <button
          class="text-button"
          type="button"
          :disabled="messagePage >= messageTotalPages - 1"
          @click="changeMessagePage(messagePage + 1)"
        >
          下一页
        </button>
      </div>
    </div>
  </section>
</template>