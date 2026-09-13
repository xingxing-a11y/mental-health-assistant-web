<script setup>
import { ref } from 'vue';

defineProps({ diaries: { type: Array, required: true }, trend: { type: Array, required: true } });
const emit = defineEmits(['create', 'delete', 'analyze', 'trend']);
const content = ref('');
const emotion = ref('CALM');
const startDate = ref('');
const endDate = ref('');

function submit() {
  if (!content.value.trim()) return;
  emit('create', { content: content.value.trim(), emotion: emotion.value });
  content.value = '';
}
</script>

<template>
  <section class="content">
    <div class="section-title"><h2>情绪日记</h2></div>
    <form class="assessment-form" @submit.prevent="submit">
      <textarea v-model="content" rows="5" maxlength="10000" placeholder="记录此刻的感受..." />
      <select v-model="emotion">
        <option value="HAPPY">开心</option><option value="CALM">平静</option>
        <option value="STRESSED">压力大</option><option value="ANXIOUS">焦虑</option>
        <option value="LOW">低落</option>
      </select>
      <button class="primary-button" type="submit">保存日记</button>
    </form>
    <div class="admin-section">
      <h3>最近记录</h3>
      <article v-for="diary in diaries" :key="diary.id" class="article">
        <strong>{{ diary.emotion }}</strong><time>{{ diary.createdAt }}</time>
        <p>{{ diary.content }}</p>
        <button class="text-button" type="button" @click="emit('analyze', diary)">AI 分析</button>
        <button class="text-button" type="button" @click="emit('delete', diary)">删除</button>
      </article>
      <div v-if="!diaries.length" class="empty-state">暂无日记。</div>
    </div>
    <div class="admin-section">
      <h3>情绪趋势</h3>
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
    </div>
  </section>
</template>
