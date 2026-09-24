/**
 * 左侧导航的单一数据源。
 *
 * 背景：这里原先分散着三处「各自登记一遍」——
 *   ① AppSidebar.vue 里 22 个硬编码 <button>，每个都手写 active 判断 + emit 值 + 图标 + 文案；
 *   ② App.vue applyLocation() 里三个独立的 section 白名单数组（admin 10 项 / relax 4 项 /
 *      extras 4 项），和 ① 必须人工保持一致；
 *   ③ 各子组件的 v-if="section === 'xxx'" 模板分支。
 *
 * ① 与 ② 不一致时**不会报错**，只会在刷新 / 前进后退 / 分享链接时静默回落到聊天页
 * —— 已经真实发生过一次（侧栏发 recommend / messages，白名单写的是 recommendations，
 * 页内点击正常、刷新即丢）。
 *
 * 现在 ① 与 ② 都从本文件派生，只剩 ③ 需要手工加模板分支，而它与前两者天然解耦，
 * 不再存在「两处必须同步」的隐患。
 */
import {
  BarChart3,
  Bookmark,
  BookOpen,
  ClipboardCheck,
  Compass,
  FileText,
  Gamepad2,
  Gauge,
  GitCompare,
  History,
  Inbox,
  Megaphone,
  MessageCircle,
  Moon,
  NotebookPen,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Star,
  Users,
  Wind,
} from 'lucide-vue-next';

/** 顶层导航：点击即切页，没有子项。 */
export const NAV_ITEMS = [
  { key: 'chat', label: '对话陪伴', icon: MessageCircle },
  { key: 'assessment', label: '心理测评', icon: ClipboardCheck },
  { key: 'articles', label: '心理科普', icon: BookOpen },
  { key: 'diary', label: '情绪日记', icon: NotebookPen },
];

/**
 * 可展开分组。
 * key 同时承担三重身份：路由前缀（/extras/xxx）、白名单来源、侧栏 active 标记。
 */
export const NAV_GROUPS = [
  {
    key: 'relax',
    label: '放松小工具',
    icon: Wind,
    event: 'select-relax',
    adminOnly: false,
    sections: [
      { key: 'breathe', label: '呼吸放松', icon: Wind },
      { key: 'meditation', label: '正念冥想', icon: Moon },
      { key: 'stress', label: '压力打卡', icon: Gauge },
      { key: 'games', label: '游戏列表', icon: Gamepad2 },
    ],
  },
  {
    key: 'extras',
    label: '拓展功能',
    icon: Compass,
    event: 'select-extras',
    adminOnly: false,
    sections: [
      { key: 'compare', label: '测评结果对比', icon: GitCompare },
      { key: 'favorites', label: '测评收藏', icon: Star },
      { key: 'recommend', label: '量表推荐', icon: Compass },
      { key: 'messages', label: '消息收藏', icon: Bookmark },
    ],
  },
  {
    key: 'admin',
    label: '管理后台',
    icon: ShieldCheck,
    event: 'select-admin',
    adminOnly: true,
    sections: [
      { key: 'overview', label: '数据概览', icon: BarChart3 },
      { key: 'users', label: '用户管理', icon: Users },
      { key: 'scales', label: '测评量表', icon: Scale },
      { key: 'articles', label: '科普文章', icon: BookOpen },
      { key: 'knowledge', label: '知识库', icon: FileText },
      { key: 'announcements', label: '系统公告', icon: MessageCircle },
      { key: 'push', label: '通知推送', icon: Megaphone },
      { key: 'sensitive', label: '敏感词词库', icon: ShieldAlert },
      { key: 'feedbacks', label: '反馈工单', icon: Inbox },
      { key: 'logs', label: '操作日志', icon: History },
    ],
  },
];

/** 某个分组的合法子项。路由白名单直接取这里，不要再手抄一份。 */
export function sectionKeys(groupKey) {
  const group = NAV_GROUPS.find((item) => item.key === groupKey);
  return group ? group.sections.map((item) => item.key) : [];
}

/** 各分组的默认子项，用于 /extras 这类不带子路径的地址。 */
export function defaultSections() {
  return Object.fromEntries(NAV_GROUPS.map((group) => [group.key, group.sections[0].key]));
}
