<script setup>
defineProps({
  articles: { type: Array, required: true },
  selectedArticle: { type: Object, default: null },
});

const emit = defineEmits(['open', 'back', 'search']);
</script>

<template>


<section class="content">
  <div class="section-title">
  <h2>给自己一点理解和空间</h2>
    <input class="article-search" placeholder="搜索文章标题" @input="emit('search', $event.target.value)" />
  </div>
  <div v-if="selectedArticle" class="article-detail">
    <button class="text-btn" @click="emit('back')">返回文章列表</button>
    <h2>{{ selectedArticle.title }}</h2>
    <p>{{ selectedArticle.content }}</p>
  </div>
  <div v-else class="article-list">
    <article v-for="article in articles" :key="article.id" class="article">
      <h3>{{ article.title }}</h3>
      <p>{{ article.summary }}</p>
      <button class="text-btn" @click="emit('open', article)">阅读全文</button>
    </article>
    <div v-if="!articles.length" class="empty-state">暂无文章。</div>
  </div>
</section>
</template>



