<script setup>
defineProps({
  scales: { type: Array, required: true },
  selectedScale: { type: Object, default: null },
  report: { type: Object, default: null },
  history: { type: Array, required: true },
});

const emit = defineEmits(['start', 'submit']);
</script>

<template>


<section class="content">
  <div class="section-title">
  <h2>选择一份量表，了解最近的自己</h2>
    <span class="notice">结果仅供参考，不等于临床诊断</span>
    </div>
    <div v-if="!selectedScale" class="scale-grid">
      <article v-for="scale in scales" :key="scale.id" class="scale-card">
        <h3>{{ scale.name }}</h3>
        <p>{{ scale.description }}</p>
        <button class="secondary" @click="emit('start', scale)">开始测评</button>
      </article>
      <div v-if="!scales.length" class="empty-state">暂无量表。</div>
    </div>
    <form v-else class="assessment-form" @submit.prevent="emit('submit')">
      <h3>{{ selectedScale.name }}</h3>
      <label v-for="question in selectedScale.questions" :key="question.id">
        {{ question.content }}
        <select v-model="report.answers[question.id]" required>
          <option value="" disabled>请选择</option>
          <option v-for="option in question.options" :key="option.id" :value="option.id">{{ option.label }}</option>
        </select>
      </label>
      <button class="primary" type="submit">提交测评</button>
    </form>
    <div v-if="report?.totalScore !== undefined" class="report">
      <h3>本次测评报告</h3>
      <div class="report-score">{{ report.totalScore }}<small>分</small>
        </div>
        <strong>{{ report.rangeDescription }}</strong>
        <ul>
        <li v-for="item in report.suggestions" :key="item">{{ item }}</li>
        </ul>
      </div>

    <div v-if="!selectedScale" class="assessment-history">
      <h3>测评历史</h3>
      <div v-if="!history.length" class="empty-state">暂无历史测评记录。</div>
      <article v-for="item in history" :key="item.id" class="history-item">
        <strong>{{ item.scale?.name || '心理测评' }}</strong>
        <span>{{ item.totalScore }} 分</span>
        <time>{{ item.createdAt }}</time>
      </article>
    </div>
    </section>
  </template>



