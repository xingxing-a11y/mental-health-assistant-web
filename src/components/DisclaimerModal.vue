<script setup>
import { ShieldCheck } from 'lucide-vue-next';

defineProps({
  visible: { type: Boolean, default: false },
});

const emit = defineEmits(['close']);
</script>

<template>


<div v-if="visible" class="modal-backdrop">
  <div class="modal">
    <div class="modal-icon">
    <ShieldCheck :size="24" />
  </div>
  <h2>先说在前面</h2>
  <p>MindHarbor 提供心理陪伴、科普和自我调节建议，不能替代专业医疗诊断。如果你正处于危机中，请联系信任的人或当地紧急援助服务。</p>
  <button class="primary" @click="emit('close')">我了解了</button>
</div>
</div>
</template>



