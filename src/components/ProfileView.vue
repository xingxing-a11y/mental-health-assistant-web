<script setup>
import { reactive, watch } from 'vue';

const props = defineProps({
  profile: { type: Object, default: null },
});

const emit = defineEmits(['save-profile', 'change-password']);
const profileForm = reactive({ nickname: '', gender: '', age: null });
const passwordForm = reactive({ oldPassword: '', newPassword: '' });

watch(
  () => props.profile,
  (profile) => {
    if (!profile) {
      return;
    }
    profileForm.nickname = profile.nickname || '';
    profileForm.gender = profile.gender || '';
    profileForm.age = profile.age ?? null;
  },
  { immediate: true },
);

function saveProfile() {
  emit('save-profile', { ...profileForm });
}

function changePassword() {
  emit('change-password', { ...passwordForm });
  passwordForm.oldPassword = '';
  passwordForm.newPassword = '';
}
</script>

<template>
  <section class="content profile-page">
    <div v-if="profile" class="profile-card">
      <span class="avatar large">{{ profile.nickname?.slice(0, 1) }}</span>
      <div>
        <span class="eyebrow">YOUR PROFILE</span>
        <h2>{{ profile.nickname }}</h2>
        <p>{{ profile.username }}</p>
      </div>
    </div>

    <div v-if="profile" class="profile-form">
      <h3>基本资料</h3>
      <label>昵称 <input v-model.trim="profileForm.nickname" required /></label>
      <label>性别 <input v-model.trim="profileForm.gender" /></label>
      <label>年龄 <input v-model.number="profileForm.age" min="1" max="120" type="number" /></label>
      <button class="primary-button" type="button" @click="saveProfile">保存资料</button>
    </div>

    <div v-if="profile" class="profile-form">
      <h3>修改密码</h3>
      <label>旧密码 <input v-model="passwordForm.oldPassword" type="password" /></label>
      <label>新密码 <input v-model="passwordForm.newPassword" minlength="6" type="password" /></label>
      <button class="primary-button" type="button" @click="changePassword">更新密码</button>
    </div>

    <div v-if="!profile" class="empty-state">暂无个人资料。</div>
  </section>
</template>
