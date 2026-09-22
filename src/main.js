import { createApp } from 'vue';

import App from './App.vue';
import './style.css';
/* 放松小游戏的样式单独一份：style.css 是 CRCRLF 行尾，改动要走字节级脚本，
   把游戏样式分出去能让它随手指改。必须在 style.css 之后引入，覆盖顺序才不变。 */
import './styles/games.css';

createApp(App).mount('#app');

