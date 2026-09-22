/**
 * 静心涂色的草稿。模块级存放，跨组件实例存活，只撑过 SPA 内的页面切换。
 *
 * 明确的局限（涂色页有一行常驻说明如实披露）：刷新页面、关闭标签页、退出登录
 * 都会清空。不做 localStorage 持久化，也不挂 beforeunload —— 需求要的是「静心」，
 * 弹一个不可样式化、不可翻译的原生确认框与这个语气相冲。
 *
 * 写回时机是「每次抬笔」，不放在组件卸载钩子里。这样「放弃并退出」先清草稿、
 * 再卸载时，不会被卸载逻辑复写回来。
 */
export const gameDraft = {
  /** 承载笔迹的离屏 canvas，null 表示没有草稿。 */
  color: null,
  /** 是否已经落过笔 —— 退出确认据此决定要不要拦一下。 */
  hasStrokes: false,
};

export function clearColorDraft() {
  gameDraft.color = null;
  gameDraft.hasStrokes = false;
}
