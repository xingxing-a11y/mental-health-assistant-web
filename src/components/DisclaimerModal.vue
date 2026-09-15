<script setup>
import { ShieldCheck } from 'lucide-vue-next';

defineProps({
  visible: { type: Boolean, default: false },
});

const emit = defineEmits(['close']);
</script>

<template>
  <div v-if="visible" class="modal-backdrop">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="disclaimer-title">
      <div class="modal-icon">
        <ShieldCheck :size="24" />
      </div>
      <h2 id="disclaimer-title">使用前须知</h2>
      <p>
        MindHarbor 仅提供心理陪伴、心理科普和自我调节建议，不能替代专业医疗诊断。
        如果你正处于危机中，请立即联系信任的人、当地心理援助热线或紧急医疗服务。
      </p>
      <button class="primary" type="button" @click="emit('close')">
        我已了解
      </button>
    </div>
  </div>
</template>

