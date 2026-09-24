import { createApp } from 'vue';

import App from './App.vue';
import './style.css';
/* 放松小游戏的样式单独一份：style.css 是 CRCRLF 行尾，改动要走字节级脚本，
   把游戏样式分出去能让它随手指改。必须在 style.css 之后引入，覆盖顺序才不变。 */
import './styles/games.css';

/* 手机上的「可见高度」会跟着键盘和地址栏伸缩，而 100vh 恒定等于大视口（地址栏
   收起时的高度）—— 比此刻真正看得见的那块高 60~100px，键盘弹出时它也不缩。
   拿它当容器高度，页面就会多出一截可滚动空间、标题栏被翻上去，输入框也会被键盘盖住。
   visualViewport.height 才是「此刻真正可见」的高度，写进 --vvh 供 CSS 取用。 */
let lastViewportHeight = 0;

function syncViewportHeight() {
  const viewport = window.visualViewport;
  const height = Math.round(viewport ? viewport.height : window.innerHeight);
  /* 键盘弹出时 visualViewport 的 scroll 事件会连发，高度不变就别写样式，
     省掉无谓的重排。 */
  if (height === lastViewportHeight) {
    return;
  }
  lastViewportHeight = height;
  document.documentElement.style.setProperty('--vvh', `${height}px`);
}

syncViewportHeight();
window.addEventListener('resize', syncViewportHeight);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', syncViewportHeight);
  window.visualViewport.addEventListener('scroll', syncViewportHeight);
}

createApp(App).mount('#app');

