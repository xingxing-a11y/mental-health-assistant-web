<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { LogOut } from 'lucide-vue-next';
import { lockBackground, releaseBackground, watchBackgroundLock } from '../utils/backgroundLock';
import { clearColorDraft, gameDraft } from '../utils/gameDraft';

const props = defineProps({
  game: { type: Object, required: true },
});

const emit = defineEmits(['close']);

/** 弹窗根节点的选择器，看门狗用它判断节点是否还在文档里。 */
const ROOT_SELECTOR = '.game-backdrop';

/** 只有涂色会产生需要确认才丢弃的内容。 */
const COLOR_GAME_ID = 'color-relax';

const confirmingExit = ref(false);

/** 打开弹窗前的焦点持有者，关闭时按 WAI-ARIA APG 归还给它。 */
let opener = null;

/**
 * 退出的唯一入口。遮罩刻意不绑 click.self —— 点旁边的空白处不关闭。
 * 涂色已经落过笔时先问一句，避免辛苦涂的画被一次误点清掉。
 */
function requestExit() {
  if (props.game.id === COLOR_GAME_ID && gameDraft.hasStrokes) {
    confirmingExit.value = true;
    return;
  }
  emit('close');
}

function confirmExit() {
  clearColorDraft();
  emit('close');
}

function cancelExit() {
  confirmingExit.value = false;
}

/** ESC 走与「退出游戏」按钮同一条路径；确认条开着时 ESC 先收确认条。 */
function onKeydown(event) {
  if (event.key !== 'Escape') {
    return;
  }
  event.preventDefault();
  if (confirmingExit.value) {
    cancelExit();
    return;
  }
  requestExit();
}

onMounted(() => {
  opener = document.activeElement;
  lockBackground();
  watchBackgroundLock(ROOT_SELECTOR);
  window.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  // 必须是第一条语句：dev 构建下前一个卸载钩子抛错会中断整条卸载链
  releaseBackground();
  window.removeEventListener('keydown', onKeydown);
  // 归还焦点必须在清掉 inert 之后 —— inert 子树里的元素不能被聚焦
  if (opener && opener.isConnected && typeof opener.focus === 'function') {
    opener.focus();
  }
  opener = null;
});
</script>

<template>
  <Teleport to="body">
    <div class="modal-backdrop game-backdrop">
      <section
        class="game-modal"
        role="dialog"
        aria-modal="true"
        :aria-label="game.name"
      >
        <header class="game-modal-head">
          <div class="game-modal-title">
            <span class="game-card-icon">
              <component :is="game.icon" :size="20" />
            </span>
            <div>
              <h3>{{ game.name }}</h3>
              <p>{{ game.description }}</p>
            </div>
          </div>
          <button class="text-button game-exit" type="button" @click="requestExit">
            <LogOut :size="15" />
            退出游戏
          </button>
        </header>

        <div class="game-stage">
          <component :is="game.component" />
        </div>

        <div v-if="confirmingExit" class="game-confirm" role="alertdialog" aria-live="polite">
          <p>这次涂色不会保存，确定离开吗？</p>
          <div class="game-confirm-actions">
            <button class="secondary" type="button" @click="cancelExit">继续涂色</button>
            <button class="danger-button" type="button" @click="confirmExit">确定离开</button>
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>
