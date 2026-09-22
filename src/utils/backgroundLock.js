/**
 * 游戏弹窗开启期间把「背景」锁死：指针、键盘、无障碍树三条路一起封。
 *
 * 锁的载体是侧边栏与内容区两棵子树，**不是 `#app`** —— `LoginView` 是 `.shell`
 * 的兄弟节点，401 自动切登录页时它不能被冻住，否则登录表单点不动、只能刷新。
 * App 自己的浮层（公告 / 分析 / 确认框 / toast）也不是这两棵子树的成员，同样不受影响。
 *
 * 本模块是模块级的（不是组件实例级），因为看门狗必须在组件卸载之后仍能解锁。
 */
const LOCK_SELECTORS = ['.shell > .sidebar', '.shell > main'];

let locked = null;
let observer = null;

export function lockBackground() {
  if (locked) {
    return;
  }
  locked = LOCK_SELECTORS
    .map((selector) => document.querySelector(selector))
    .filter(Boolean);
  locked.forEach((element) => {
    element.inert = true;
  });
}

/** 幂等：未持锁时直接返回，重复调用无副作用。关闭路径与卸载钩子都走它。 */
export function releaseBackground() {
  if (!locked) {
    return;
  }
  locked.forEach((element) => {
    element.inert = false;
  });
  locked = null;
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

/**
 * 兜底看门狗：只在「锁还持着，但弹窗根节点已经不在文档里」时自动解锁。
 *
 * 覆盖面要说清楚，别把它当成主防线：Vue 的 `unmountComponent` 里
 * `invokeArrayFns(bum)` 抛错时会连 `unmount(subTree)` 一起跳过，组件 DOM 根本不会
 * 被摘除 —— 那种路径下本看门狗的条件**永远不成立**，所以它防不住「卸载钩子整条被
 * 跳过」。而那条路径本身只在 dev 构建下才重抛（生产构建只 console.error 后继续卸载）。
 * 主防线仍是「载体收窄 + 释放写在卸载钩子第一条语句」，见 GameModal.vue。
 */
export function watchBackgroundLock(rootSelector) {
  if (observer || typeof MutationObserver === 'undefined') {
    return;
  }
  observer = new MutationObserver(() => {
    if (locked && !document.querySelector(rootSelector)) {
      releaseBackground();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
