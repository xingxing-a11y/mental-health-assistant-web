<script setup>
import { Archive, ArrowLeft, RotateCcw, Trash2 } from 'lucide-vue-next';

defineProps({
  archivedSessions: { type: Array, required: true },
  archivedVisible: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
});

const emit = defineEmits(['open-archived', 'back', 'unarchive', 'delete']);
</script>

<template>
  <section class="content settings-page">
    <div class="section-title settings-heading">
      <div>
        <span class="eyebrow">WORKSPACE SETTINGS</span>
        <h2>设置</h2>
        <p>管理会话保存方式和历史记录。</p>
      </div>
    </div>

    <div v-if="!archivedVisible" class="settings-list">
      <button class="settings-option" type="button" @click="emit('open-archived')">
        <span class="settings-option-icon"><Archive :size="19" /></span>
        <span class="settings-option-copy">
          <strong>归档会话</strong>
          <small>查看、恢复或永久删除已归档的会话</small>
        </span>
        <span class="settings-option-count">{{ archivedSessions.length }}</span>
      </button>
    </div>

    <div v-else class="archived-sessions-panel">
      <div class="archived-sessions-head">
        <div>
          <button class="text-button settings-back" type="button" @click="emit('back')">
            <ArrowLeft :size="16" />返回设置
          </button>
          <h3>归档会话</h3>
          <p>归档会话不会出现在“我的会话”中，恢复后即可继续使用。</p>
        </div>
        <span>{{ archivedSessions.length }} 个会话</span>
      </div>
      <div v-if="loading" class="empty-state">正在加载归档会话...</div>
      <div v-else-if="!archivedSessions.length" class="empty-state">暂无归档会话。</div>
      <div v-else class="archived-session-list">
        <article v-for="session in archivedSessions" :key="session.id" class="archived-session-item">
          <div>
            <strong>{{ session.name }}</strong>
            <p>{{ session.preview || '暂无会话摘要' }}</p>
          </div>
          <div class="archived-session-actions">
            <button class="text-button" type="button" @click="emit('unarchive', session)">
              <RotateCcw :size="15" />取消归档
            </button>
            <button class="text-button danger-button" type="button" @click="emit('delete', session)">
              <Trash2 :size="15" />永久删除
            </button>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>
