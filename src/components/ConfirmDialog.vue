<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '操作确认' },
  message: { type: String, default: '' },
  confirmText: { type: String, default: '确认' },
  cancelText: { type: String, default: '取消' },
  danger: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
});

const emit = defineEmits(['confirm', 'cancel']);
</script>

<template>
  <div v-if="visible" class="modal-backdrop" @click.self="emit('cancel')">
    <section
      class="modal confirm-modal"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-message"
    >
      <h2 id="confirm-modal-title">{{ title }}</h2>
      <p id="confirm-modal-message">{{ message }}</p>
      <div class="confirm-modal-actions">
        <button
          class="text-button"
          type="button"
          :disabled="busy"
          @click="emit('cancel')"
        >
          {{ cancelText }}
        </button>
        <button
          class="primary-button"
          :class="{ 'confirm-modal-danger': danger }"
          type="button"
          :disabled="busy"
          @click="emit('confirm')"
        >
          {{ busy ? '处理中...' : confirmText }}
        </button>
      </div>
    </section>
  </div>
</template>
