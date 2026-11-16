<script setup>
import { ArrowLeft, ArrowRight, BookOpen, Search } from 'lucide-vue-next';
import { formatDateTime } from '../utils/dateTime';

defineProps({
  articles: { type: Array, required: true },
  selectedArticle: { type: Object, default: null },
});

const emit = defineEmits(['open', 'back', 'search']);

/**
 * 判断正文是富文本还是旧版纯文本。
 * 含脚本类标签的一律按纯文本渲染——历史数据没有经过后端清洗，不能直接交给 v-html。
 */
function isRichContent(content) {
  const text = content || '';
  if (/<(script|iframe|object|embed|form|style)\b/i.test(text)) {
    return false;
  }
  return /<\/?(p|h[1-6]|ul|ol|li|strong|em|u|s|blockquote|span|a|br|hr)\b/i.test(text);
}
</script>

<template>
  <section class="content article-page">
    <div class="section-title article-heading">
      <div>
        <span class="eyebrow">READ & REFLECT</span>
        <h2>给自己一点理解和空间</h2>
        <p>从可靠的科普内容开始，慢慢了解自己的情绪和状态。</p>
      </div>
      <label class="article-search-wrap">
        <Search :size="17" aria-hidden="true" />
        <input
          class="article-search"
          placeholder="搜索文章标题"
          @input="emit('search', $event.target.value)"
        />
      </label>
    </div>
    <div v-if="selectedArticle" class="article-detail">
      <button class="text-button article-back" type="button" @click="emit('back')">
        <ArrowLeft :size="15" />
        返回文章列表
      </button>
      <div class="article-detail-head">
        <span class="article-label"><BookOpen :size="14" />心理科普</span>
        <time>{{ formatDateTime(selectedArticle.updatedAt) }}</time>
      </div>
      <h2>{{ selectedArticle.title }}</h2>
      <div
        v-if="isRichContent(selectedArticle.content)"
        class="article-rich"
        v-html="selectedArticle.content"
      ></div>
      <p v-else>{{ selectedArticle.content }}</p>
    </div>
    <div v-else class="article-list">
      <article v-for="(article, articleIndex) in articles" :key="article.id" class="article">
        <div class="article-card-head">
          <span class="article-number">{{ String(articleIndex + 1).padStart(2, '0') }}</span>
          <BookOpen :size="19" aria-hidden="true" />
        </div>
        <div class="article-card-copy">
          <h3>{{ article.title || '未命名文章' }}</h3>
          <p>{{ article.summary || '暂无文章摘要，点击阅读全文查看完整内容。' }}</p>
        </div>
        <div class="article-card-footer">
          <time>{{ formatDateTime(article.updatedAt) }}</time>
          <button class="text-button" type="button" @click="emit('open', article)">
            阅读全文
            <ArrowRight :size="15" />
          </button>
        </div>
      </article>
      <div v-if="!articles.length" class="empty-state article-empty">暂无文章。</div>
    </div>
  </section>
</template>
