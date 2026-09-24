<script setup>
import { ChevronDown, LogOut, ShieldCheck, Sparkles, X } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import { NAV_GROUPS, NAV_ITEMS } from '../navigation';

const props = defineProps({
  active: { type: String, required: true },
  adminSection: { type: String, default: 'overview' },
  relaxSection: { type: String, default: 'breathe' },
  extrasSection: { type: String, default: 'compare' },
  open: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
});

const emit = defineEmits([
  'select',
  'select-admin',
  'select-relax',
  'select-extras',
  'close',
  'logout',
]);

/** 各分组当前选中的子项，供子项 button 判 active。 */
const currentSections = computed(() => ({
  relax: props.relaxSection,
  extras: props.extrasSection,
  admin: props.adminSection,
}));

/** 按权限过滤后的分组（管理后台仅管理员可见）。 */
const groups = computed(() => NAV_GROUPS.filter((group) => !group.adminOnly || props.isAdmin));

/** 各分组的展开状态。 */
const expanded = ref(Object.fromEntries(
  NAV_GROUPS.map((group) => [group.key, props.active === group.key]),
));

watch(() => props.active, (value) => {
  NAV_GROUPS.forEach((group) => {
    if (value !== group.key) {
      expanded.value[group.key] = false;
    }
  });
});

function toggleGroup(key) {
  expanded.value[key] = !expanded.value[key];
}
</script>

<template>
  <aside class="sidebar" :class="{ open }">
    <div class="brand">
      <div class="brand-mark">
        <Sparkles :size="18" />
      </div>
      <div>
        <strong>MindHarbor</strong>
        <small>心理健康助手</small>
      </div>
      <button class="icon mobile-close" @click="emit('close')">
        <X :size="18" />
      </button>
    </div>
    <nav>
      <button
        v-for="item in NAV_ITEMS"
        :key="item.key"
        :class="{ active: active === item.key }"
        @click="emit('select', item.key)"
      >
        <component :is="item.icon" :size="18" />
        {{ item.label }}
      </button>

      <template v-for="group in groups" :key="group.key">
        <button
          class="sidebar-nav-toggle"
          :class="{ active: active === group.key }"
          :aria-expanded="expanded[group.key]"
          @click="toggleGroup(group.key)"
        >
          <component :is="group.icon" :size="18" />
          <span>{{ group.label }}</span>
          <ChevronDown
            class="sidebar-nav-caret"
            :class="{ expanded: expanded[group.key] }"
            :size="15"
          />
        </button>
        <div v-if="expanded[group.key]" class="sidebar-subnav">
          <button
            v-for="section in group.sections"
            :key="section.key"
            :class="{ active: active === group.key && currentSections[group.key] === section.key }"
            @click="emit(group.event, section.key)"
          >
            <component :is="section.icon" :size="16" />
            {{ section.label }}
          </button>
        </div>
      </template>
    </nav>
    <div class="side-note">
      <ShieldCheck :size="17" />
      你的对话仅用于提供陪伴服务，请放心表达。
    </div>
    <button class="logout" @click="emit('logout')">
      <LogOut :size="17" />
      退出登录
    </button>
  </aside>
</template>
