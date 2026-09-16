<script setup>
import { ClipboardCheck, ArrowRight } from 'lucide-vue-next';
import { formatDateTime } from '../utils/dateTime';

defineProps({
  scales: { type: Array, required: true },
  selectedScale: { type: Object, default: null },
  report: { type: Object, default: null },
  history: { type: Array, required: true },
  analysisLoading: { type: Boolean, default: false },
});

const emit = defineEmits(['start', 'submit', 'analyze']);
</script>

<template>
<section class="content assessment-page">
  <div class="section-title assessment-heading">
    <div>
      <span class="eyebrow">SELF CHECK-IN</span>
      <h2>选择一份量表，了解最近的自己</h2>
      <p>用几分钟记录近期状态，结果仅用于自我觉察。</p>
    </div>
    <span class="notice">结果仅供参考，不等于临床诊断</span>
  </div>
  <div v-if="!selectedScale" class="scale-grid">
    <article v-for="(scale, scaleIndex) in scales" :key="scale.id" class="scale-card">
      <div class="scale-card-head">
        <span class="scale-index">测评 {{ String(scaleIndex + 1).padStart(2, '0') }}</span>
        <ClipboardCheck :size="19" aria-hidden="true" />
      </div>
      <div class="scale-card-copy">
        <h3>{{ scale.name || '未命名量表' }}</h3>
        <p>{{ scale.description || '暂无量表简介，开始测评了解当前状态。' }}</p>
      </div>
      <div class="scale-card-meta">
        <span v-if="scale.applicableScene">适用：{{ scale.applicableScene }}</span>
        <span v-else>适用于近期自我状态了解</span>
      </div>
      <div class="scale-card-actions">
        <button class="primary-button" type="button" @click="emit('start', scale)">
          开始测评
          <ArrowRight :size="16" />
        </button>
      </div>
    </article>
    <div v-if="!scales.length" class="empty-state scale-empty">暂无可用量表。</div>
  </div>
  <form v-else class="assessment-form" @submit.prevent="emit('submit')">
    <div class="assessment-form-head">
      <div>
        <span class="eyebrow">QUESTIONNAIRE</span>
        <h3>{{ selectedScale.name }}</h3>
      </div>
      <span>{{ selectedScale.questions?.length || 0 }} 道题目</span>
    </div>
    <div class="assessment-question-list">
      <label v-for="(question, questionIndex) in selectedScale.questions" :key="question.id" class="assessment-question">
        <span class="assessment-question-title">
          <b>{{ String(questionIndex + 1).padStart(2, '0') }}</b>
          {{ question.content }}
        </span>
        <select
          v-if="question.type === 'SINGLE' || question.type === 'JUDGE'"
          v-model="report.answers[question.id]"
          required
        >
          <option value="" disabled>请选择</option>
          <option v-for="option in question.options" :key="option.id" :value="option.id">
            {{ option.label }}
          </option>
        </select>
        <div v-else-if="question.type === 'MULTIPLE'" class="assessment-options">
          <label v-for="option in question.options" :key="option.id" class="assessment-option">
            <input v-model="report.answers[question.id]" type="checkbox" :value="option.id" />
            <span>{{ option.label }}</span>
          </label>
          <input
            v-if="question.options.some((option) => option.label === '其他' && report.answers[question.id].includes(option.id))"
            v-model="report.otherAnswers[question.id]"
            class="other-answer-input"
            type="text"
            maxlength="200"
            placeholder="请填写其他内容"
            required
          />
        </div>
        <input
          v-if="(question.type === 'SINGLE' || question.type === 'JUDGE') && question.options.some((option) => option.label === '其他' && String(report.answers[question.id]) === String(option.id))"
          v-model="report.otherAnswers[question.id]"
          class="other-answer-input"
          type="text"
          maxlength="200"
          placeholder="请填写其他内容"
          required
        />
        <div v-else-if="question.type === 'MATRIX'" class="matrix-question">
          <div v-for="row in (question.matrixRows || '').split('\n').filter(Boolean)" :key="row" class="matrix-row">
            <span>{{ row }}</span>
            <select v-model="report.answers[question.id][row]" required>
              <option value="" disabled>请选择</option>
              <option v-for="option in question.options" :key="option.id" :value="option.id">{{ option.label }}</option>
            </select>
          </div>
        </div>
        <textarea
          v-else-if="question.type === 'TEXT'"
          v-model="report.answers[question.id]"
          rows="4"
          maxlength="2000"
          required
          placeholder="请输入你的回答"
        />
      </label>
    </div>
    <button class="primary-button assessment-submit" type="submit">提交测评</button>
  </form>
  <div v-if="report?.totalScore !== undefined" class="report">
    <div class="report-heading">
      <div>
        <span class="eyebrow">YOUR RESULT</span>
        <h3>本次测评报告</h3>
      </div>
      <div class="report-score">{{ report.totalScore }}<small>分</small></div>
    </div>
    <strong>{{ report.rangeDescription }}</strong>
    <ul>
      <li v-for="item in report.suggestions" :key="item">{{ item }}</li>
    </ul>
    <div v-if="report.aiAnalysis" class="assessment-ai-analysis">
      <h4>AI 解读与安慰</h4>
      <p>{{ report.aiAnalysis }}</p>
    </div>
    <button
      v-else
      class="secondary assessment-analysis-button"
      type="button"
      :disabled="analysisLoading"
      @click="emit('analyze')"
    >
      {{ analysisLoading ? '分析中...' : 'AI 分析' }}
    </button>
  </div>
  <div v-if="!selectedScale" class="assessment-history">
    <div class="assessment-history-head">
      <div>
        <span class="eyebrow">YOUR ACTIVITY</span>
        <h3>测评历史</h3>
      </div>
      <span>{{ history.length }} 条记录</span>
    </div>
    <div v-if="!history.length" class="empty-state">暂无历史测评记录。</div>
    <article v-for="item in history" :key="item.id" class="history-item">
      <div>
        <strong>{{ item.scale?.name || '心理测评' }}</strong>
        <time>{{ formatDateTime(item.createdAt) }}</time>
      </div>
      <span class="history-score">{{ item.totalScore }} 分</span>
    </article>
  </div>
</section>
</template>

