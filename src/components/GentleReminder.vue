<script setup>
import { HeartHandshake } from 'lucide-vue-next';

defineProps({
  visible: { type: Boolean, default: false },
  prompt: { type: String, default: '' },
  level: { type: String, default: 'CARE' },
  hotline: { type: String, default: '' },
});

const emit = defineEmits(['continue', 'cancel']);
</script>

<template>
  <div v-if="visible" class="modal-backdrop" @click.self="emit('cancel')">
    <section
      class="modal gentle-reminder-modal"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="gentle-reminder-title"
      aria-describedby="gentle-reminder-message"
    >
      <span class="gentle-reminder-icon" aria-hidden="true">
        <HeartHandshake :size="20" />
      </span>
      <h2 id="gentle-reminder-title">先停一下，好吗</h2>
      <p id="gentle-reminder-message">{{ prompt || '我注意到你现在的状态可能不太好，如果情况紧急，请优先联系专业援助。' }}</p>
      <p v-if="hotline" class="gentle-reminder-hotline">心理援助热线：{{ hotline }}</p>
      <div class="confirm-modal-actions">
        <button class="text-button" type="button" @click="emit('cancel')">我先不说</button>
        <button class="primary-button" type="button" @click="emit('continue')">继续发送</button>
      </div>
    </section>
  </div>
</template>