<script setup>
import { BookOpen, ClipboardCheck, LogOut, MessageCircle, ShieldCheck, Sparkles, UserRound, X, NotebookPen } from 'lucide-vue-next';

defineProps({ active: { type: String, required: true }, open: { type: Boolean, default: false }, isAdmin: { type: Boolean, default: false } });
const emit = defineEmits(['select', 'close', 'logout']);
</script>

<template>
  <aside class="sidebar" :class="{ open }">
    <div class="brand"><div class="brand-mark"><Sparkles :size="18" /></div><div><strong>MindHarbor</strong><small>心理健康助手</small></div><button class="icon mobile-close" @click="emit('close')"><X :size="18" /></button></div>
    <nav>
      <button :class="{ active: active === 'chat' }" @click="emit('select', 'chat')"><MessageCircle :size="18" />对话陪伴</button>
      <button :class="{ active: active === 'assessment' }" @click="emit('select', 'assessment')"><ClipboardCheck :size="18" />心理测评</button>
      <button :class="{ active: active === 'articles' }" @click="emit('select', 'articles')"><BookOpen :size="18" />心理科普</button>
      <button :class="{ active: active === 'diary' }" @click="emit('select', 'diary')"><NotebookPen :size="18" />情绪日记</button>
      <button :class="{ active: active === 'profile' }" @click="emit('select', 'profile')"><UserRound :size="18" />个人中心</button>
      <button v-if="isAdmin" :class="{ active: active === 'admin' }" @click="emit('select', 'admin')"><ShieldCheck :size="18" />管理后台</button>
    </nav>
    <div class="side-note"><ShieldCheck :size="17" />你的对话仅用于提供陪伴服务，请放心表达。</div>
    <button class="logout" @click="emit('logout')"><LogOut :size="17" />退出登录</button>
  </aside>
</template>
