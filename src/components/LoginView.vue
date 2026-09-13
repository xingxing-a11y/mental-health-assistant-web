<script setup>
import { ref } from 'vue';
import { userApi } from '../api/modules';

const emit = defineEmits(['success']);

const mode = ref('login');
const form = ref({
  username: '',
  password: '',
  confirmPassword: '',
  nickname: '',
  gender: '',
  age: null,
});
const loading = ref(false);
const error = ref('');

async function submit() {
  error.value = '';
  loading.value = true;

  try {
    const response = mode.value === 'login'
      ? await userApi.login({
        username: form.value.username,
        password: form.value.password,
      })
      : await userApi.register(form.value);

    emit('success');
  } catch (requestError) {
    error.value = requestError.message;
  } finally {
    loading.value = false;
  }
}

function toggleMode() {
  mode.value = mode.value === 'login' ? 'register' : 'login';
  error.value = '';
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-card">
      <span class="eyebrow">MIND HARBOR</span>
      <h1>{{ mode === 'login' ? '欢迎回来' : '创建账号' }}</h1>
      <p class="auth-subtitle">心理陪伴与科普空间</p>

      <form @submit.prevent="submit">
        <label>
          用户名
          <input v-model.trim="form.username" required autocomplete="username" />
        </label>

        <label>
          密码
          <input
            v-model="form.password"
            required
            minlength="6"
            type="password"
            autocomplete="current-password"
          />
        </label>

        <template v-if="mode === 'register'">
          <label>
            确认密码
            <input v-model="form.confirmPassword" required minlength="6" type="password" />
          </label>

          <label>
            昵称
            <input v-model.trim="form.nickname" required />
          </label>
        </template>

        <p v-if="error" class="error-banner">{{ error }}</p>
        <button class="primary-button" :disabled="loading" type="submit">
          {{ loading ? '处理中...' : mode === 'login' ? '登录' : '注册并登录' }}
        </button>
      </form>

      <button class="text-button" type="button" @click="toggleMode">
        {{ mode === 'login' ? '还没有账号？立即注册' : '已有账号？返回登录' }}
      </button>
    </section>
  </main>
</template>
