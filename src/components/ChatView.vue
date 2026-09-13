<script setup>
import { ref } from 'vue';
import { Plus, Send, Sparkles, Trash2, RotateCcw } from 'lucide-vue-next';

defineProps({
  sessions: { type: Array, required: true },
  messages: { type: Array, required: true },
  favorites: { type: Array, required: true },
  currentSessionId: { type: [Number, String], default: null },
  mode: { type: String, default: 'COMPANION' },
});

const emit = defineEmits(['create', 'open', 'delete', 'send', 'clear', 'mode', 'favorite', 'load-favorites']);
const input = ref('');

function submit() {
  const content = input.value.trim();
  if (!content) return;
  emit('send', content);
  input.value = '';
}

function handleKeydown(event) {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) {
    return;
  }

  event.preventDefault();
  submit();
}
</script>

<template>
  <section class="content chat-layout">
    <div class="session-panel">
      <div class="panel-head"><h2>我的会话</h2><button class="primary small" @click="emit('create')"><Plus :size="16" />新建</button></div>
      <div v-if="!sessions.length" class="empty-state">暂无会话。</div>
      <div v-for="session in sessions" :key="session.id" class="session-row">
        <button class="session-item" @click="emit('open', session)"><strong>{{ session.name }}</strong><span>{{ session.preview }}</span><time>{{ session.latestMessageAt }}</time></button>
        <button class="icon danger" title="删除会话" @click="emit('delete', session)"><Trash2 :size="15" /></button>
      </div>
    </div>
    <div class="chat-panel">
      <div class="chat-intro"><Sparkles :size="20" /><div><h2>和我聊聊</h2><p>我会认真听你说，也会在需要时给出温和、具体的建议。</p></div><select :value="mode" :disabled="!currentSessionId" @change="emit('mode', $event.target.value)"><option value="COMPANION">温柔陪伴</option><option value="ANALYTICAL">理性分析</option></select><button class="icon" :disabled="!currentSessionId" title="清空上下文" @click="emit('clear', currentSessionId)"><RotateCcw :size="16" /></button></div>
      <button class="text-button favorites-toggle" type="button" @click="emit('load-favorites')">查看收藏（{{ favorites.length }}）</button>
      <div v-if="favorites.length" class="favorites-list">
        <article v-for="favorite in favorites" :key="favorite.id" class="favorite-item">
          {{ favorite.content }}
        </article>
      </div>
      <div class="messages"><div v-for="(message, index) in messages" :key="index" class="message" :class="message.role.toLowerCase()"><div class="bubble">{{ message.content }}</div><button v-if="message.role === 'ASSISTANT' && message.id" class="text-btn" type="button" @click="emit('favorite', message)">{{ message.favorite ? '已收藏' : '收藏' }}</button></div><div v-if="!messages.length" class="empty-state">选择或新建一个会话后开始表达。</div></div>
      <form class="composer" @submit.prevent="submit"><textarea v-model="input" :disabled="!currentSessionId" placeholder="写下此刻的想法..." rows="2" @keydown="handleKeydown" /><button class="send" :disabled="!input.trim() || !currentSessionId" title="发送"><Send :size="18" /></button></form>
      <p class="helper">AI 仅提供心理陪伴与科普，不进行医学诊断。</p>
    </div>
  </section>
</template>
