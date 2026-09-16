<script setup>
import { ref } from 'vue';
import { X } from 'lucide-vue-next';
import { formatDateTime } from '../utils/dateTime';

defineProps({
  diaries: { type: Array, required: true },
  trend: { type: Array, required: true },
  searchResults: { type: Array, default: () => [] },
  analysisLoading: { type: Boolean, default: false },
  allVisible: { type: Boolean, default: false },
  allDiaries: { type: Array, default: () => [] },
  allLoading: { type: Boolean, default: false },
  allPage: { type: Number, default: 0 },
  allTotalPages: { type: Number, default: 0 },
  allTotal: { type: Number, default: 0 },
});
const emit = defineEmits(['create', 'delete', 'analyze', 'trend', 'update', 'open-all', 'close-all', 'all-page']);
const content = ref('');
const emotion = ref('CALM');
const startDate = ref('');
const endDate = ref('');
const selectedDiary = ref(null);
const editing = ref(false);
const editContent = ref('');
const editEmotion = ref('CALM');
const emotionLabels = {
  HAPPY: '😊 开心',
  CALM: '😌 平静',
  STRESSED: '😣 压力大',
  ANXIOUS: '😟 焦虑',
  LOW: '😔 低落',
};

function submit() {
  if (!content.value.trim()) return;
  emit('create', { content: content.value.trim(), emotion: emotion.value });
  content.value = '';
}

function displayEmotion(value) {
  return emotionLabels[value] || value || '未记录';
}

function openDiary(diary) {
  selectedDiary.value = diary;
  editing.value = false;
}

function startEdit() {
  editContent.value = selectedDiary.value.content;
  editEmotion.value = selectedDiary.value.emotion;
  editing.value = true;
}

function saveEdit() {
  if (!editContent.value.trim()) return;
  emit('update', selectedDiary.value, {
    content: editContent.value.trim(),
    emotion: editEmotion.value,
  });
  selectedDiary.value = {
    ...selectedDiary.value,
    content: editContent.value.trim(),
    emotion: editEmotion.value,
  };
  editing.value = false;
}

function closeAll() {
  emit('close-all');
}

function goPage(page) {
  if (page < 0 || page > 9999) return;
  emit('all-page', page);
}
</script>

<template>
  <section class="content diary-page">
    <div class="section-title diary-heading">
      <div>
        <h2>情绪日记</h2>
        <p>留下一点时间，记录此刻的自己。</p>
      </div>
    </div>

    <form class="diary-composer" @submit.prevent="submit">
      <div class="diary-composer-head">
        <div>
          <h3>记录今天的感受</h3>
          <p>写下发生的事，也写下你的情绪。</p>
        </div>
        <span class="diary-count">{{ content.length }} / 10000</span>
      </div>
      <label class="diary-field">
        <span>日记内容</span>
        <textarea v-model="content" rows="6" maxlength="10000" placeholder="记录此刻的感受..." />
      </label>
      <label class="diary-field diary-emotion-field">
        <span>此刻的情绪</span>
        <select v-model="emotion">
          <option value="HAPPY">😊 开心</option>
          <option value="CALM">😌 平静</option>
          <option value="STRESSED">😣 压力大</option>
          <option value="ANXIOUS">😟 焦虑</option>
          <option value="LOW">😔 低落</option>
        </select>
      </label>
      <div class="diary-actions">
        <span>内容仅用于你的个人记录与情绪分析。</span>
        <button class="primary-button" type="submit">保存日记</button>
      </div>
    </form>

    <section class="diary-section diary-history">
      <div class="diary-section-head">
        <div>
          <h3>最近记录</h3>
          <p>回看最近留下的情绪片段。</p>
        </div>
        <span>{{ diaries.length }} 条记录</span>
      </div>
      <div class="diary-entry-list">
        <article
          v-for="diary in diaries.slice(0, 2)"
          :key="diary.id"
          class="diary-entry diary-entry-clickable"
          @click="openDiary(diary)"
        >
          <div class="diary-entry-meta">
            <strong :class="`emotion-${diary.emotion.toLowerCase()}`">{{ displayEmotion(diary.emotion) }}</strong>
            <time>{{ formatDateTime(diary.createdAt) }}</time>
          </div>
          <p>{{ diary.content }}</p>
          <div class="diary-entry-actions">
            <button
              class="text-button"
              type="button"
              :disabled="analysisLoading"
              @click.stop="emit('analyze', diary)"
            >
              {{ analysisLoading ? '分析中...' : 'AI 分析' }}
            </button>
            <button class="text-button danger-button" type="button" @click.stop="emit('delete', diary)">删除</button>
          </div>
        </article>
      </div>
      <div v-if="diaries.length > 2" class="diary-all-button-container">
        <button class="secondary diary-all-button" type="button" @click="emit('open-all')">
          所有日记（{{ diaries.length }}）
        </button>
      </div>
      <div v-if="!diaries.length" class="empty-state diary-empty">暂无日记，写下第一条记录吧。</div>
    </section>

    <section class="diary-section diary-trend">
      <div class="diary-section-head">
        <div>
          <h3>情绪趋势</h3>
          <p>选择日期范围，观察情绪变化。</p>
        </div>
      </div>
      <form class="trend-filter" @submit.prevent="emit('trend', startDate, endDate)">
        <label>开始日期 <input v-model="startDate" type="date" /></label>
        <label>结束日期 <input v-model="endDate" type="date" /></label>
        <button class="secondary" type="submit">查询</button>
      </form>
      <div class="trend-list">
        <div v-for="item in trend" :key="item.date" class="trend-item">
          <span>{{ formatDateTime(item.date) }}</span>
          <div class="trend-bar" :class="item.emotion.toLowerCase()"></div>
          <strong>{{ item.emotion }}</strong>
        </div>
      </div>
      <div v-if="searchResults.length" class="diary-search-results">
        <h4>查询到的日记（{{ searchResults.length }} 条）</h4>
        <article
          v-for="diary in searchResults"
          :key="diary.id"
          class="diary-search-result diary-entry-clickable"
          @click="openDiary(diary)"
        >
          <div class="diary-entry-meta">
            <strong :class="`emotion-${diary.emotion.toLowerCase()}`">{{ displayEmotion(diary.emotion) }}</strong>
            <time>{{ formatDateTime(diary.createdAt) }}</time>
          </div>
          <p>{{ diary.content }}</p>
        </article>
      </div>
      <p v-else-if="!trend.length" class="empty-state">暂无趋势数据。</p>
    </section>

    <div v-if="allVisible" class="diary-modal-backdrop" @click.self="closeAll">
      <section class="diary-modal" role="dialog" aria-modal="true">
        <div class="diary-modal-head">
          <h3>所有日记</h3>
          <button class="icon" type="button" @click="closeAll"><X :size="18" /></button>
        </div>
        <div class="diary-modal-list">
          <div v-if="allLoading" class="loading-state">加载中...</div>
          <template v-else>
            <article
              v-for="diary in allDiaries"
              :key="diary.id"
              class="diary-entry diary-entry-clickable"
              @click="openDiary(diary)"
            >
              <div class="diary-entry-meta">
                <strong :class="`emotion-${diary.emotion.toLowerCase()}`">{{ displayEmotion(diary.emotion) }}</strong>
                <time>{{ formatDateTime(diary.createdAt) }}</time>
              </div>
              <p>{{ diary.content }}</p>
            </article>
            <div v-if="!allDiaries.length" class="empty-state diary-empty">暂无日记。</div>
          </template>
        </div>
        <div class="diary-modal-pagination">
          <span>共 {{ allTotal }} 条 · 第 {{ allPage + 1 }} / {{ Math.max(allTotalPages, 1) }} 页</span>
          <div class="diary-modal-pagination-actions">
            <button class="secondary small" type="button" :disabled="allPage === 0 || allLoading" @click="goPage(allPage - 1)">
              上一页
            </button>
            <button
              class="secondary small"
              type="button"
              :disabled="allPage + 1 >= allTotalPages || allLoading"
              @click="goPage(allPage + 1)"
            >
              下一页
            </button>
          </div>
        </div>
      </section>
    </div>

    <div v-if="selectedDiary" class="diary-modal-backdrop" @click.self="selectedDiary = null">
      <section class="diary-modal diary-detail-modal" role="dialog" aria-modal="true">
        <div class="diary-modal-head">
          <h3>{{ editing ? '编辑日记' : '日记详情' }}</h3>
          <button class="icon" type="button" @click="selectedDiary = null"><X :size="18" /></button>
        </div>
        <template v-if="editing">
          <label class="diary-field">
            <span>情绪</span>
            <select v-model="editEmotion">
              <option value="HAPPY">😊 开心</option>
              <option value="CALM">😌 平静</option>
              <option value="STRESSED">😣 压力大</option>
              <option value="ANXIOUS">😟 焦虑</option>
              <option value="LOW">😔 低落</option>
            </select>
          </label>
          <label class="diary-field">
            <span>内容</span>
            <textarea v-model="editContent" rows="10" maxlength="10000" />
          </label>
          <div class="diary-modal-actions">
            <button class="secondary" type="button" @click="editing = false">取消</button>
            <button class="primary-button" type="button" @click="saveEdit">保存修改</button>
          </div>
        </template>
        <template v-else>
          <div class="diary-entry-meta">
            <strong :class="`emotion-${selectedDiary.emotion.toLowerCase()}`">{{ displayEmotion(selectedDiary.emotion) }}</strong>
            <time>{{ formatDateTime(selectedDiary.createdAt) }}</time>
          </div>
          <p class="diary-detail-content">{{ selectedDiary.content }}</p>
          <div class="diary-modal-actions">
            <button class="secondary" type="button" @click="startEdit">编辑</button>
            <button class="primary-button" type="button" @click="selectedDiary = null">关闭</button>
          </div>
        </template>
      </section>
    </div>
  </section>
</template>
