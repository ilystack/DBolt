<script setup lang="ts">
import type { AgentToolCall, SessionProgress } from '@/store/dataStudioStore'
import type { ChatMessage } from '@/types/chat'
import { Bot, ShieldCheck, Square } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AgentMessageBubble from '@/components/agent-message-bubble.vue'
import { ToolPermissionReview } from '@/components/ai-permissions'
import ContextIndicator from '@/components/context-indicator.vue'
import ModelPicker from '@/components/model-picker.vue'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from '@/composables/useNotifications'
import { useAppStore } from '@/store'
import ToolConfirmationCard from '@/views/data-studio/components/tool-confirmation-card.vue'

const props = withDefaults(
  defineProps<{
    messages: ChatMessage[]
    isLoading: boolean
    error?: string
    emptyHint?: string
    inputPlaceholder?: string
    sessionId?: string | null
    contextSettings?: Record<string, unknown> | null
    progress?: SessionProgress | null
    stopReason?: string | null
    stopMessage?: string | null
    feature?: string
    compact?: boolean
    showModelPicker?: boolean
  }>(),
  {
    error: undefined,
    emptyHint: undefined,
    inputPlaceholder: undefined,
    sessionId: null,
    contextSettings: null,
    progress: null,
    stopReason: null,
    stopMessage: null,
    feature: 'dataStudio',
    compact: false,
    showModelPicker: true,
  },
)

const emit = defineEmits<{
  send: [message: string]
  stopLoop: []
  confirmToolCall: [msgId: string, event: { toolCallId: string, action: 'allow_once' | 'allow_always' | 'deny' | 'deny_always' | 'cancel' }]
  modelChange: [modelId: string]
  modelPickerOpen: []
  dismissError: []
}>()

const { t } = useI18n()
const appStore = useAppStore()
const { llmSettings } = storeToRefs(appStore)

const isDataStudio = computed(() => props.feature === 'dataStudio')

const inputText = ref('')
const scrollAreaRef = ref<{ viewportElement: HTMLElement | null } | null>(null)
const contextIndicatorRef = ref<{ refresh: () => Promise<void> } | null>(null)
const reviewingTool = ref<AgentToolCall | null>(null)
const recoveryBusy = computed(() => props.isLoading || (props.progress?.phase === 'preparing' && !props.error))
const retryToolCall = (tool: AgentToolCall) => {
  if (recoveryBusy.value)
    return
  emit('send', t('dataStudio.agent.message.retryPrompt', { tool: tool.toolName, args: tool.args }))
  forceScrollToBottom()
}
const currentTurnStart = computed(() => props.messages.reduce((index, message, current) => message.role === 'user' ? current : index, -1))
const awaitingDecision = computed(() => {
  if (props.isLoading)
    return false
  return props.messages.slice(currentTurnStart.value + 1).some(message => message.toolCalls?.some(call => call.status === 'denied' && call.denial?.kind !== 'user'))
})

// ── Smart scroll ──────────────────────────────────────────────────────

const STICKY_THRESHOLD_PX = 32
const stickToBottom = ref(true)

const getViewport = (): HTMLElement | null => scrollAreaRef.value?.viewportElement ?? null

function isNearBottom(el: HTMLElement): boolean {
  const distance = el.scrollHeight - (el.scrollTop + el.clientHeight)
  return distance <= STICKY_THRESHOLD_PX
}

let scrollRafId = 0

function scrollToBottomForce() {
  if (!stickToBottom.value)
    return
  if (scrollRafId)
    cancelAnimationFrame(scrollRafId)
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = 0
    if (!stickToBottom.value)
      return
    const el = getViewport()
    if (!el)
      return
    el.scrollTop = el.scrollHeight
  })
}

function scrollToBottomBatched() {
  if (!stickToBottom.value || scrollRafId)
    return
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = 0
    const el = getViewport()
    if (!el)
      return
    el.scrollTop = el.scrollHeight
  })
}

function forceScrollToBottom() {
  stickToBottom.value = true
  if (scrollRafId)
    cancelAnimationFrame(scrollRafId)
  scrollRafId = 0
  const el = getViewport()
  if (el)
    el.scrollTop = el.scrollHeight
}

function handleViewportScroll() {
  const el = getViewport()
  if (!el)
    return
  stickToBottom.value = isNearBottom(el)
}

watch(
  () => props.messages.length,
  () => requestAnimationFrame(() => scrollToBottomForce()),
)

watch(
  () => {
    const msgs = props.messages
    if (msgs.length === 0)
      return ''
    const last = msgs[msgs.length - 1]
    return `${last.content?.length ?? 0}:${(last as any).thinking?.length ?? 0}:${(last as any).toolCalls?.length ?? 0}`
  },
  () => scrollToBottomBatched(),
)

// ── Model picker ──────────────────────────────────────────────────────

const iterationIndexMap = computed<Record<string, number>>(() => {
  let count = 0
  return props.messages.reduce<Record<string, number>>((acc, msg) => {
    if (msg.role === 'assistant' && (msg as any).toolCalls?.length) {
      acc[msg.id] = count++
    }
    return acc
  }, {})
})

const modelGroups = computed(() =>
  llmSettings.value.providers
    .filter(provider => provider.enabled && (provider.models ?? []).length > 0)
    .map(provider => ({
      id: provider.id,
      label: provider.name,
      models: (provider.models ?? []).map(modelId => ({
        id: `${provider.id}::${modelId}`,
        label: modelId,
        providerConfigId: provider.id,
      })),
    })),
)

const featureRoute = computed(() =>
  props.feature === 'sidebarAssistant'
    ? llmSettings.value.models.sidebarAssistant
    : llmSettings.value.models.dataStudio,
)

const selectedModelId = computed(() => featureRoute.value.selectedModelId ?? undefined)
const recentModelIds = computed(() => (selectedModelId.value ? [selectedModelId.value] : []))

const isLocalModel = computed(() => {
  if (!selectedModelId.value)
    return false

  const modelId = selectedModelId.value
  const providerId = modelId.includes('::') ? modelId.split('::')[0] : null
  const provider = providerId
    ? llmSettings.value.providers.find(p => p.id === providerId)
    : llmSettings.value.providers.find(p => p.enabled && (p.models ?? []).includes(modelId))

  if (!provider)
    return false

  const kind = (provider.kind || '').toLowerCase()
  const id = (provider.id || '').toLowerCase()
  const name = (provider.name || '').toLowerCase()
  const baseUrl = (provider.baseUrl || '').toLowerCase()

  if (kind === 'ollama' || kind === 'lm-studio' || kind === 'local')
    return true
  if (id.includes('ollama') || id.includes('lm-studio') || id.includes('local'))
    return true
  if (name.includes('ollama') || name.includes('lm studio') || name.includes('local'))
    return true
  if (
    baseUrl.includes('localhost')
    || baseUrl.includes('127.0.0.1')
    || baseUrl.includes('0.0.0.0')
    || baseUrl.includes('[::1]')
  ) {
    return true
  }

  return false
})

// ── Input ─────────────────────────────────────────────────────────────

function sendMessage() {
  const text = inputText.value.trim()
  if (!text || props.isLoading)
    return
  emit('send', text)
  inputText.value = ''
  forceScrollToBottom()
}

function onEnterKeydown(e: KeyboardEvent) {
  // Ignore Enter used to confirm an IME candidate (e.g. Chinese/Japanese
  // input methods) — keyCode 229 covers older Safari/WebKit during composition.
  if (e.isComposing || e.keyCode === 229)
    return
  e.preventDefault()
  sendMessage()
}

function handleContinue() {
  if (props.isLoading)
    return
  emit('send', 'continue')
}

const canSend = computed(() => inputText.value.trim().length > 0 && !props.isLoading)

// ── Model change ──────────────────────────────────────────────────────

async function onModelChange(modelId: string) {
  emit('modelChange', modelId)
  await appStore.setFeatureModelRoute(props.feature as 'sidebarAssistant' | 'dataStudio', {
    selectedModelId: modelId,
    useRecommendedModel: false,
  })
  const ok = await appStore.verifyModelAvailability(modelId)
  if (!ok)
    toast.warning(t('dataStudio.modelUnavailable') || 'Selected model is not available')
}

function onModelPickerOpen() {
  emit('modelPickerOpen')
  llmSettings.value.providers
    .filter(p => p.enabled)
    .forEach(p => appStore.syncProviderModels(p.id).catch(() => {}))
}

// ── Lifecycle ─────────────────────────────────────────────────────────

onMounted(async () => {
  await nextTick()
  const el = getViewport()
  el?.addEventListener('scroll', handleViewportScroll, { passive: true })
  forceScrollToBottom()
})

onBeforeUnmount(() => {
  const el = getViewport()
  el?.removeEventListener('scroll', handleViewportScroll)
  if (scrollRafId)
    cancelAnimationFrame(scrollRafId)
})

// ── Status helpers ────────────────────────────────────────────────────
</script>

<template>
  <div
    class="flex flex-col h-full w-full"
    :class="isDataStudio ? 'gap-2 overflow-hidden' : ''"
  >
    <!-- Top Card: Percakapan (Header + Messages) -->
    <div
      class="flex flex-1 flex-col min-h-0 w-full overflow-hidden"
      :class="isDataStudio ? 'border border-border/70 rounded-xl bg-card/40 shadow-sm' : ''"
    >
      <!-- Header slot with divider line inside Top Card -->
      <div
        v-if="$slots.header"
        class="shrink-0 w-full"
        :class="isDataStudio ? 'border-b border-border/40' : ''"
      >
        <slot name="header" />
      </div>

      <!-- Messages area -->
      <div class="flex-1 min-h-0 w-full">
        <ScrollArea ref="scrollAreaRef" class="h-full w-full">
          <div class="px-4 py-4 flex flex-col min-h-full justify-start">
            <!-- Empty state -->
            <div v-if="messages.length === 0 && !isLoading" class="px-4 py-12 text-center flex flex-1 flex-col w-full select-none items-center justify-center">
              <Bot class="text-muted-foreground mb-3 h-16 w-16 stroke-[1.5]" />
              <h2 class="text-xl text-foreground tracking-tight font-medium mb-1">
                What I can do for you?
              </h2>
              <p class="text-xs text-muted-foreground max-w-sm">
                <slot name="empty">
                  {{ emptyHint || t('dataStudio.agent.emptyState') }}
                </slot>
              </p>
            </div>

            <!-- Message bubbles -->
            <AgentMessageBubble
              v-for="(msg, index) in messages"
              :key="msg.id"
              :message="msg"
              :iteration-index="iterationIndexMap[msg.id]"
              :can-retry="!recoveryBusy"
              :historical="index < currentTurnStart"
              @review-permissions="reviewingTool = $event"
              @retry-tool-call="retryToolCall"
            />

            <!-- Tool confirmation cards -->
            <div v-for="msg in messages" :key="`conf-${msg.id}`">
              <ToolConfirmationCard
                v-for="tc in ((msg as any).toolCalls?.filter((tc: any) => tc.requiresConfirmation && tc.status === 'pending') ?? [])"
                :key="tc.id"
                :tool-call="tc"
                @confirm="emit('confirmToolCall', msg.id, $event)"
              />
            </div>

            <!-- Error banner -->
            <div v-if="error" class="text-sm text-destructive-text mb-2 p-3 border border-destructive/20 rounded-lg bg-destructive/10 flex gap-2 max-w-[85%] w-fit items-start self-start">
              <span class="i-carbon-warning mt-0.5 shrink-0 h-4 w-4" />
              <span class="flex-1 min-w-0">{{ error }}</span>
              <button
                class="text-destructive-text p-0.5 rounded shrink-0 transition-colors hover:text-destructive-text"
                @click="emit('dismissError')"
              >
                <span class="i-carbon-close h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </ScrollArea>
      </div>

      <!-- Stop banner -->
      <div v-if="stopReason && stopMessage" class="mx-4 mb-2 p-3 border rounded-xl flex gap-2 items-center justify-between" style="border-color: hsl(38 92% 50% / 0.35); background: hsl(38 92% 50% / 0.08);">
        <div class="flex gap-2 items-start">
          <span class="i-carbon-pause-filled shrink-0 h-4 w-4" style="color: hsl(38 92% 50%);" />
          <div class="flex flex-col gap-0.5">
            <span class="text-xs font-medium">{{ stopMessage }}</span>
            <span class="text-caption text-muted-foreground">{{ t('dataStudio.agent.continueHint') }}</span>
          </div>
        </div>
        <div class="flex shrink-0 gap-1.5">
          <button
            class="text-xs font-semibold px-2.5 py-1 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style="border: 1px solid transparent; background: transparent; color: hsl(var(--muted-foreground));"
            :disabled="isLoading"
            @click="emit('stopLoop')"
          >
            {{ t('dataStudio.agent.stop') }}
          </button>
          <button
            class="text-xs font-semibold px-2.5 py-1 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style="border: 1px solid hsl(38 92% 50% / 0.5); background: hsl(38 92% 50% / 0.15);"
            :disabled="isLoading"
            @click="handleContinue"
          >
            {{ t('dataStudio.agent.continue') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Bottom Card: Chat Input -->
    <div :class="isDataStudio ? 'w-full shrink-0' : 'chat-input-area'">
      <p v-if="awaitingDecision" role="status" class="text-xs text-warning mb-2 px-1 flex gap-2 items-center">
        <span aria-hidden="true" class="i-carbon-pause shrink-0 h-4 w-4" />
        {{ t('dataStudio.agent.message.awaitingPermissionDecision') }}
      </p>
      <div v-if="stopReason && stopMessage" class="loop-stopped-banner" role="status">
        <div class="loop-stopped-banner__body">
          <span class="loop-stopped-banner__icon i-carbon-pause-filled" />
          <div class="loop-stopped-banner__texts">
            <span class="loop-stopped-banner__message">{{ stopMessage }}</span>
            <span class="loop-stopped-banner__hint">{{ t('dataStudio.agent.continueHint') }}</span>
          </div>
        </div>
        <div class="loop-stopped-banner__actions">
          <button
            class="loop-stopped-banner__action loop-stopped-banner__action--secondary"
            type="button"
            :disabled="isLoading"
            @click="emit('stopLoop')"
          >
            {{ t('dataStudio.agent.stop') }}
          </button>
          <button
            class="loop-stopped-banner__action loop-stopped-banner__action--primary"
            type="button"
            :disabled="isLoading"
            @click="handleContinue"
          >
            {{ t('dataStudio.agent.continue') }}
          </button>
        </div>
      </div>

      <div
        class="chat-input-wrapper"
        :class="isDataStudio ? 'border border-border/70 rounded-xl bg-card/40! shadow-sm' : ''"
      >
        <textarea
          v-model="inputText"
          class="chat-textarea"
          rows="3"
          :placeholder="inputPlaceholder || t('dataStudio.inputPlaceholder')"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          data-form-type="other"
          :disabled="isLoading"
          @keydown.enter.exact="onEnterKeydown"
        />

        <div class="chat-toolbar">
          <div class="toolbar-left">
            <slot name="toolbar-left" />
            <ModelPicker
              v-if="showModelPicker"
              :groups="modelGroups"
              :model-value="selectedModelId"
              :recent-model-ids="recentModelIds"
              :compact="compact"
              @open="onModelPickerOpen"
              @update:model-value="onModelChange"
            />
          </div>

          <div class="toolbar-right">
            <!-- Zero Data Leak Privacy Guard Badge (Local models only) -->
            <div
              v-if="isLocalModel"
              class="text-[11px] text-emerald-600 font-medium px-2 py-0.5 border border-emerald-500/20 rounded-md bg-emerald-500/10 gap-1 hidden cursor-help select-none items-center dark:text-emerald-400 sm:inline-flex"
              title="Zero Data Leak Guard: DBolt only provides schema metadata. Production table row values are never transmitted to AI models."
            >
              <ShieldCheck class="h-3 w-3" />
              <span>Zero Data Leak</span>
            </div>
            <ContextIndicator
              ref="contextIndicatorRef"
              :session-id="sessionId"
              :settings="contextSettings ?? null"
            />
            <slot name="toolbar-right" />
            <button
              class="send-button"
              :disabled="!canSend && !isLoading"
              :title="isLoading ? t('dataStudio.agent.stop') : undefined"
              @click="isLoading ? emit('stopLoop') : sendMessage()"
            >
              <Square v-if="isLoading" class="h-3 w-3 fill-current" />
              <span v-else class="i-carbon-arrow-up h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
    <ToolPermissionReview
      v-if="reviewingTool && sessionId"
      :key="reviewingTool.id"
      :open="true"
      :denial="reviewingTool.denial ?? { kind: 'permission', source: 'unknown', message: reviewingTool.result ?? '' }"
      :tool-name="reviewingTool.toolName"
      :session-id="sessionId"
      @update:open="!$event && (reviewingTool = null)"
    />
  </div>
</template>

<style scoped>
.chat-input-area {
  padding: 10px 16px 16px;
  position: relative;
  width: 100%;
  background: transparent;
}

.chat-input-wrapper {
  display: flex;
  flex-direction: column;
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  background: hsl(var(--background));
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.chat-input-wrapper:focus-within {
  border-color: hsl(var(--ring));
  box-shadow: 0 0 0 1px hsl(var(--ring));
}

.chat-textarea {
  width: 100%;
  min-height: 60px;
  padding: 8px 10px;
  border: none;
  outline: none;
  background: transparent;
  color: hsl(var(--foreground));
  font-size: var(--font-size-body);
  resize: none;
  line-height: 1.5;
}

.chat-textarea:focus {
  outline: none;
}

.chat-textarea:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chat-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 10px;
  min-height: 38px;
  border-top: 1px solid hsl(var(--border));
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.send-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: hsl(var(--foreground));
  color: hsl(var(--background));
  border: none;
  cursor: pointer;
  transition: opacity 0.2s;
  flex-shrink: 0;
}

.send-button:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}

.send-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.loop-stopped-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid hsl(38 92% 50% / 0.35);
  background: hsl(38 92% 50% / 0.08);
  color: hsl(var(--foreground));
}

.loop-stopped-banner__body {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex: 1 1 auto;
}

.loop-stopped-banner__texts {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.loop-stopped-banner__icon {
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
  margin-top: 1px;
  color: hsl(38 92% 50%);
}

.loop-stopped-banner__message {
  font-size: var(--font-size-body);
  font-weight: 500;
  line-height: 1.4;
}

.loop-stopped-banner__hint {
  font-size: var(--font-size-dense);
  color: hsl(var(--muted-foreground));
  line-height: 1.4;
}

.loop-stopped-banner__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.loop-stopped-banner__action {
  padding: 4px 10px;
  font-size: var(--font-size-dense);
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.loop-stopped-banner__action--primary {
  border: 1px solid hsl(38 92% 50% / 0.5);
  background: hsl(38 92% 50% / 0.15);
  color: hsl(var(--foreground));
}

.loop-stopped-banner__action--primary:hover:not(:disabled) {
  background: hsl(38 92% 50% / 0.25);
}

.loop-stopped-banner__action--secondary {
  border: 1px solid transparent;
  background: transparent;
  color: hsl(var(--muted-foreground));
}

.loop-stopped-banner__action--secondary:hover:not(:disabled) {
  background: hsl(var(--secondary));
  color: hsl(var(--foreground));
}

.loop-stopped-banner__action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
