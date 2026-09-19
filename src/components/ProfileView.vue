<script setup>
import { reactive, ref, watch } from 'vue';

const props = defineProps({
  profile: { type: Object, default: null },
  avatarUploading: { type: Boolean, default: false },
});

const emit = defineEmits(['save-profile', 'change-password', 'upload-avatar']);
const profileForm = reactive({ nickname: '', gender: '', age: null });
const passwordForm = reactive({ oldPassword: '', newPassword: '' });
const avatarInput = ref(null);

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

function avatarSource(url) {
  if (!url) {
    return '';
  }
  return `/api/v1${url}`;
}

function chooseAvatar() {
  avatarInput.value?.click();
}

function uploadAvatar(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) {
    return;
  }
  emit('upload-avatar', file);
}
</script>

<template>
  <section class="content profile-page">
    <div v-if="profile" class="profile-card">
      <div class="profile-avatar-wrap">
        <img
          v-if="profile.avatarUrl"
          class="avatar large profile-avatar-image"
          :src="avatarSource(profile.avatarUrl)"
          alt="用户头像"
        />
        <span v-else class="avatar large">{{ profile.nickname?.slice(0, 1) || 'U' }}</span>
        <button
          class="secondary small"
          type="button"
          :disabled="props.avatarUploading"
          @click="chooseAvatar"
        >
          {{ props.avatarUploading ? '上传中...' : '更换头像' }}
        </button>
        <input
          ref="avatarInput"
          class="visually-hidden"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          @change="uploadAvatar"
        />
      </div>
      <div class="profile-identity">
        <span class="eyebrow">YOUR PROFILE</span>
        <h2>{{ profile.nickname || '未设置用户名' }}</h2>
        <p>账号：{{ profile.username }}</p>
        <span class="profile-status">资料信息</span>
      </div>
    </div>

    <div v-if="profile" class="profile-grid">
      <div class="profile-form">
        <div class="profile-form-heading">
          <div>
            <span class="eyebrow">PERSONAL DETAILS</span>
            <h3>基本资料</h3>
          </div>
          <span>完善信息后保存即可</span>
        </div>
        <label>
          用户名
          <input v-model.trim="profileForm.nickname" required />
        </label>
        <label>
          性别
          <select v-model="profileForm.gender">
            <option value="">请选择</option>
            <option value="男">男</option>
            <option value="女">女</option>
            <option value="不愿透露">不愿透露</option>
          </select>
        </label>
        <label>
          年龄
          <input v-model.number="profileForm.age" min="1" max="120" type="number" />
        </label>
        <button class="primary-button" type="button" @click="saveProfile">保存资料</button>
      </div>

      <div class="profile-form">
        <div class="profile-form-heading">
          <div>
            <span class="eyebrow">SECURITY</span>
            <h3>修改密码</h3>
          </div>
          <span>定期更新密码更安全</span>
        </div>
        <label>
          旧密码
          <input v-model="passwordForm.oldPassword" type="password" />
        </label>
        <label>
          新密码
          <input v-model="passwordForm.newPassword" minlength="6" type="password" />
        </label>
        <button class="primary-button" type="button" @click="changePassword">更新密码</button>
      </div>
    </div>

    <div v-if="!profile" class="empty-state">暂无个人资料。</div>
  </section>
</template>
