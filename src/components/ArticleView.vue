<script setup>
import { ArrowLeft, ArrowRight, BookOpen, Search } from 'lucide-vue-next';
import { formatDateTime } from '../utils/dateTime';

defineProps({
  articles: { type: Array, required: true },
  selectedArticle: { type: Object, default: null },
});

const emit = defineEmits(['open', 'back', 'search']);
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
        <ArrowLeft :size="16" />
        返回文章列表
      </button>
      <div class="article-detail-head">
        <span class="article-label"><BookOpen :size="14" />心理科普</span>
        <time>{{ formatDateTime(selectedArticle.updatedAt) }}</time>
      </div>
      <h2>{{ selectedArticle.title }}</h2>
      <p>{{ selectedArticle.content }}</p>
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
