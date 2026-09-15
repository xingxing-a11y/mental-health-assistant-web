<script setup>
import { ref } from 'vue';

defineProps({ diaries: { type: Array, required: true }, trend: { type: Array, required: true } });
const emit = defineEmits(['create', 'delete', 'analyze', 'trend']);
const content = ref('');
const emotion = ref('CALM');
const startDate = ref('');
const endDate = ref('');
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

function formatDiaryTime(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleString('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function displayEmotion(value) {
  return emotionLabels[value] || value || '未记录';
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
        <article v-for="diary in diaries" :key="diary.id" class="diary-entry">
          <div class="diary-entry-meta">
            <strong :class="`emotion-${diary.emotion.toLowerCase()}`">{{ displayEmotion(diary.emotion) }}</strong>
            <time>{{ formatDiaryTime(diary.createdAt) }}</time>
          </div>
          <p>{{ diary.content }}</p>
          <div class="diary-entry-actions">
            <button class="text-button" type="button" @click="emit('analyze', diary)">AI 分析</button>
            <button class="text-button danger-button" type="button" @click="emit('delete', diary)">删除</button>
          </div>
        </article>
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
          <span>{{ item.date }}</span>
          <div class="trend-bar" :class="item.emotion.toLowerCase()"></div>
          <strong>{{ item.emotion }}</strong>
        </div>
      </div>
      <p v-if="!trend.length" class="empty-state">暂无趋势数据。</p>
    </section>
  </section>
</template>
