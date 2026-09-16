<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { Archive, MoreHorizontal, Pencil, Pin, Plus, RotateCcw, Send, Sparkles } from 'lucide-vue-next';

const props = defineProps({
  sessions: { type: Array, required: true },
  messages: { type: Array, required: true },
  favorites: { type: Array, required: true },
  pending: { type: Boolean, default: false },
  currentSessionId: { type: [Number, String], default: null },
  mode: { type: String, default: 'COMPANION' },
  disclaimerVisible: { type: Boolean, default: false },
});

const emit = defineEmits(['create', 'open', 'archive', 'send', 'clear', 'mode', 'favorite', 'load-favorites', 'rename', 'pin']);
const input = ref('');
const sessionWidth = ref(280);
const renamingId = ref(null);
const renameValue = ref('');
const renameInput = ref(null);
const messagesContainer = ref(null);
const favoritesVisible = ref(false);
const openMenuId = ref(null);

const visibleFavorites = computed(() => props.favorites.filter(
  (favorite) => String(favorite.sessionId) === String(props.currentSessionId),
));

const hasPersistedSession = computed(() => props.currentSessionId
  && !String(props.currentSessionId).startsWith('draft-'));

function setRenameInput(element) {
  renameInput.value = element;
}

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

function scrollMessagesToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
}

watch(
  () => [props.messages, props.pending],
  scrollMessagesToBottom,
  { deep: true },
);

function startResize(event) {
  const startX = event.clientX;
  const startWidth = sessionWidth.value;
  const move = (moveEvent) => {
    sessionWidth.value = Math.min(420, Math.max(220, startWidth + moveEvent.clientX - startX));
  };
  const stop = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', stop);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', stop);
}

function startRename(session) {
  renamingId.value = session.id;
  renameValue.value = session.name;
  nextTick(() => {
    renameInput.value?.focus();
    renameInput.value?.select();
  });
}

function saveRename(session) {
  const name = renameValue.value.trim();
  if (name) {
    emit('rename', session, name);
  }
  renamingId.value = null;
}

function toggleSessionMenu(sessionId) {
  openMenuId.value = openMenuId.value === sessionId ? null : sessionId;
}

function closeSessionMenuOnOutsideClick(event) {
  if (!event.target.closest('.session-actions')) {
    openMenuId.value = null;
  }
}

function selectSessionAction(action, session) {
  openMenuId.value = null;

  if (action === 'pin') {
    emit('pin', session);
    return;
  }

  if (action === 'archive') {
    emit('archive', session);
    return;
  }

  startRename(session);
}

</script>

<template>
  <section class="content chat-layout" :class="{ 'disclaimer-open': props.disclaimerVisible }" :style="{ gridTemplateColumns: `${sessionWidth}px 6px minmax(0, 1fr)` }" @click="closeSessionMenuOnOutsideClick">
    <div class="session-panel">
      <div class="panel-head"><h2>我的会话</h2><button class="primary small" :class="{ 'disclaimer-open': props.disclaimerVisible }" @click="emit('create')"><Plus :size="16" />新建</button></div>
      <div v-if="!sessions.length" class="empty-state">暂无会话。</div>
      <div v-for="session in sessions" :key="session.id" class="session-row">
        <button class="session-item" @click="emit('open', session)">
          <input
            v-if="renamingId === session.id"
            :ref="setRenameInput"
            v-model="renameValue"
            @click.stop
            @keydown.enter.prevent="saveRename(session)"
            @blur="saveRename(session)"
          />
          <strong
            v-else
            :class="{ 'session-title-scrollable': session.name && session.name.length > 16 }"
            @dblclick.stop="startRename(session)"
          >
            <Pin v-if="session.pinned" :size="13" class="session-pin" />
            {{ session.name }}
          </strong>
        </button>
        <div class="session-actions">
          <button
            class="icon session-menu-trigger"
            type="button"
            title="会话操作"
            :aria-expanded="openMenuId === session.id"
            aria-haspopup="menu"
            @click.stop="toggleSessionMenu(session.id)"
          >
            <MoreHorizontal :size="17" />
          </button>
          <div v-if="openMenuId === session.id" class="session-menu" role="menu">
            <button type="button" role="menuitem" @click="selectSessionAction('pin', session)">
              <Pin :size="14" />{{ session.pinned ? '取消置顶' : '置顶' }}
            </button>
            <button type="button" role="menuitem" @click="selectSessionAction('rename', session)">
              <Pencil :size="14" />重命名
            </button>
            <button type="button" role="menuitem" @click="selectSessionAction('archive', session)">
              <Archive :size="14" />归档
            </button>
          </div>
        </div>
      </div>
    </div>
    <div class="chat-divider" title="拖动调整宽度" @pointerdown="startResize"></div>
    <div class="chat-panel">
      <div class="chat-intro"><Sparkles :size="20" /><div class="intro-copy"><h2>和我聊聊</h2><p>我会认真听你说，也会在需要时给出温和、具体的建议。</p></div><div class="intro-controls"><select :value="mode" :disabled="!hasPersistedSession" @change="emit('mode', $event.target.value)"><option value="COMPANION">温柔陪伴</option><option value="ANALYTICAL">理性分析</option></select><button class="icon" :disabled="!hasPersistedSession" title="清空上下文" @click="emit('clear', currentSessionId)"><RotateCcw :size="16" /></button></div></div>
      <button class="text-button favorites-toggle" type="button" @click="favoritesVisible = !favoritesVisible; emit('load-favorites')">
        {{ favoritesVisible ? '收起收藏' : '查看当前会话收藏' }}（{{ visibleFavorites.length }}）
      </button>
      <div v-if="favoritesVisible && visibleFavorites.length" class="favorites-list">
        <article v-for="favorite in visibleFavorites" :key="favorite.id" class="favorite-item">
          <span>{{ favorite.content }}</span>
          <button class="text-button" type="button" @click="emit('favorite', { ...favorite, favorite: true })">取消收藏</button>
        </article>
      </div>
      <div ref="messagesContainer" class="messages"><div v-for="(message, index) in messages" :key="index" class="message" :class="message.role.toLowerCase()"><div class="bubble">{{ message.content }}</div><button v-if="message.role === 'ASSISTANT' && message.id" class="text-btn" type="button" @click="emit('favorite', message)">{{ message.favorite ? '已收藏' : '收藏' }}</button></div><div v-if="pending" class="message assistant pending-message"><div class="bubble">正在思考…</div></div><div v-if="!messages.length && !pending" class="empty-state">选择或新建一个会话后开始表达。</div></div>
      <form class="composer" @submit.prevent="submit"><textarea v-model="input" :disabled="!currentSessionId" placeholder="写下此刻的想法..." rows="2" @keydown="handleKeydown" /><button class="send" :disabled="!input.trim() || !currentSessionId" title="发送"><Send :size="18" /></button></form>
      <p class="helper">AI 仅提供心理陪伴与科普，不进行医学诊断。</p>
    </div>
  </section>
</template>
