<script setup lang="ts">
import { Clock, Plus, Trash2, X } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ChatPanel from '@/components/chat-panel.vue'
import { useSidebarChatAgent } from '@/composables/useSidebarChatAgent'
import { useDataStudioStore } from '@/store/dataStudioStore'
import SessionHistoryPanel from '@/views/data-studio/components/session-history-panel.vue'

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const dataStudioStore = useDataStudioStore()

const MIN_WIDTH = 320
const MAX_WIDTH = 600
const DEFAULT_WIDTH = 420

const {
  isLoading,
  error,
  messages,
  sendMessage,
  handleConfirmation: rawHandleConfirmation,
  clearChat,
  dismissError,
  activeSession,
  lastSettings,
  initContextSettings,
  cancelSession,
  stopReason,
  stopMessage,
  progress,
} = useSidebarChatAgent()

const displaySessionTitle = computed(() => {
  const customTitle = activeSession.value?.title?.trim()
  const defaultPlaceholders = new Set([
    'New Chat',
    'New Session',
    'AI Assistant',
    t('dataStudio.history.newSession'),
  ])

  if (customTitle && !defaultPlaceholders.has(customTitle)) {
    return customTitle
  }

  const firstUser = messages.value.find(m => m.role === 'user' && m.content?.trim())
  if (firstUser?.content) {
    const singleLine = firstUser.content.replace(/\s+/g, ' ').trim()
    return singleLine.length > 30 ? `${singleLine.slice(0, 30)}…` : singleLine
  }

  return t('dataStudio.history.newSession')
})

function handleConfirmation(msgId: string, event: { toolCallId: string, action: 'allow_once' | 'allow_always' | 'deny' | 'deny_always' | 'cancel' }) {
  rawHandleConfirmation(msgId, event.toolCallId, event.action)
}

const currentWidth = ref(DEFAULT_WIDTH)
const isResizing = ref(false)
const historyPanelOpen = ref(false)

function startResize(e: MouseEvent) {
  isResizing.value = true
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
  e.preventDefault()
}

function onResize(e: MouseEvent) {
  if (!isResizing.value)
    return
  const newWidth = window.innerWidth - e.clientX - 48
  currentWidth.value = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth))
}

function stopResize() {
  isResizing.value = false
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
}

function switchSession(sessionId: string) {
  dataStudioStore.sidebarSessionId = sessionId
  historyPanelOpen.value = false
}

async function deleteSession(sessionId: string) {
  await dataStudioStore.removeSession(sessionId)
}

function handleNewSession() {
  dataStudioStore.sidebarSessionId = undefined
  historyPanelOpen.value = false
}

function handleClearChat() {
  clearChat()
}

function handleClose() {
  emit('close')
}

function onModelChange(modelId: string) {
  const sess = dataStudioStore.activeSidebarSession
  if (sess?.id) {
    dataStudioStore.setSessionModelId(sess.id, modelId)
  }
}

onMounted(async () => {
  await dataStudioStore.loadSessions()
  await initContextSettings()
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
})
</script>

<template>
  <div class="ai-assistant-resizable" :style="{ width: `${currentWidth}px` }">
    <div class="resize-handle" @mousedown="startResize" />

    <!-- Session history slide-over -->
    <div v-if="historyPanelOpen" class="ai-assistant-history-overlay">
      <SessionHistoryPanel
        @select="switchSession"
        @delete="deleteSession"
        @new-session="handleNewSession"
        @close="historyPanelOpen = false"
      />
    </div>

    <ChatPanel
      :messages="messages"
      :is-loading="isLoading"
      :error="error"
      :empty-hint="t('dataStudio.agent.emptyState')"
      :input-placeholder="t('dataStudio.inputPlaceholder')"
      :session-id="activeSession?.id ?? null"
      :context-settings="lastSettings"
      :stop-reason="stopReason"
      :stop-message="stopMessage"
      :progress="progress"
      feature="sidebarAssistant"
      compact
      @send="sendMessage"
      @stop-loop="cancelSession"
      @confirm-tool-call="handleConfirmation"
      @model-change="onModelChange"
      @dismiss-error="dismissError"
    >
      <template #header>
        <div class="header-row">
          <span class="header-title truncate" :title="displaySessionTitle">
            {{ displaySessionTitle }}
          </span>
          <div class="header-actions">
            <button
              class="header-icon-btn"
              :title="t('dataStudio.history.newSession')"
              @click="handleNewSession"
            >
              <Plus class="h-3.5 w-3.5" />
            </button>
            <button
              class="header-icon-btn"
              :class="{ 'header-icon-btn--active': historyPanelOpen }"
              :title="t('dataStudio.history.title')"
              @click="historyPanelOpen = !historyPanelOpen"
            >
              <Clock class="h-3.5 w-3.5" />
            </button>
            <button
              class="header-icon-btn"
              :title="t('dataStudio.agent.clearChat')"
              @click="handleClearChat"
            >
              <Trash2 class="h-3.5 w-3.5" />
            </button>
            <button
              class="header-icon-btn header-icon-btn--close"
              :title="t('common.buttons.close')"
              @click="handleClose"
            >
              <X class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </template>
    </ChatPanel>
  </div>
</template>

<style scoped>
.ai-assistant-resizable {
  height: 100%;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  border: 1px solid hsl(var(--border) / 0.7);
  border-radius: 12px;
  position: relative;
  background: hsl(var(--card) / 0.4);
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  overflow: hidden;
}

@media (max-width: 768px) {
  .ai-assistant-resizable {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    z-index: 40;
    box-shadow: -4px 0 16px rgba(0, 0, 0, 0.15);
  }
}

.resize-handle {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  cursor: col-resize;
  z-index: 10;
  background: transparent;
  transition: background 0.15s;
}

.resize-handle:hover {
  background: hsl(var(--primary) / 0.3);
}

.ai-assistant-history-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  background: hsl(var(--background));
  display: flex;
  flex-direction: column;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 12px 12px 16px;
  border-bottom: 1px solid hsl(var(--border) / 0.4);
}

.header-title {
  font-size: var(--font-size-title);
  font-weight: 700;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.header-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  transition: all 0.15s;
}

.header-icon-btn:hover {
  background: hsl(var(--muted));
  color: hsl(var(--foreground));
}

.header-icon-btn:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 1px;
}

.header-icon-btn--active {
  background: hsl(var(--muted));
  color: hsl(var(--foreground));
}

.header-icon-btn--close {
  margin-left: 4px;
}
</style>
