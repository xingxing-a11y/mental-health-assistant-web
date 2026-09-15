import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // cpolar 临时域名会变化，允许穿透请求访问开发服务器。
    allowedHosts: true,
    proxy: {
      '/api': 'http://localhost:8080'
      //'/api': 'https://1b7178a4.r9.cpolar.top'
    }
  }
});
