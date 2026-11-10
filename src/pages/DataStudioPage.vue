<script setup lang="ts">
import type { ServerConnection } from '@/store/connectionStore'
import { onClickOutside } from '@vueuse/core'
import { Bot, Check, ChevronDown, DatabaseZap, FileText, HelpCircle, Link2, Lock, PanelRight, Plus, Search, Settings, Shield, Square, SquarePen, Trash2 } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ChatPanel from '@/components/chat-panel.vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import { disposeAgentRuntime, initAgentRuntime } from '@/composables/agentRuntime'
import { useDatabaseIcon } from '@/composables/useDatabaseIcon'
import { useDataStudioChatAgent } from '@/composables/useDataStudioChatAgent'
import { useAppStore } from '@/store'
import { DatabaseType, useConnectionStore } from '@/store/connectionStore'
import { useDataStudioStore } from '@/store/dataStudioStore'
import { useEntitlementStore } from '@/store/entitlementStore'
import ModifySourceModal from '@/views/data-studio/components/modify-source-modal.vue'
import SessionHistoryPanel from '@/views/data-studio/components/session-history-panel.vue'

const { t } = useI18n()
const connectionStore = useConnectionStore()
const { connections } = storeToRefs(connectionStore)
const dataStudioStore = useDataStudioStore()
const { attachedSources, activeSession } = storeToRefs(dataStudioStore)

const { getDatabaseIcon } = useDatabaseIcon()

// All PG-wire and MySQL-wire compatible databases + popular standalone engines
// Knowledge blocks exist for PostgreSQL, MySQL, SQL Server, SQLite dialects;
// wire-compatible types use the same SQL dialect through their respective bridge.
const AGENT_SUPPORTED_TYPES = new Set<DatabaseType>([
  // Native adapters (direct knowledge blocks)
  DatabaseType.POSTGRESQL,
  DatabaseType.MYSQL,
  DatabaseType.SQLITE,
  DatabaseType.SQLSERVER,
  // PG-wire compatible
  DatabaseType.MARIADB,
  DatabaseType.COCKROACHDB,
  DatabaseType.REDSHIFT,
  DatabaseType.YUGABYTEDB,
  DatabaseType.TIMESCALEDB,
  DatabaseType.KINGBASEES,
  DatabaseType.GAUSSDB,
  DatabaseType.HIGHGO,
  DatabaseType.UXDB,
  DatabaseType.OPENGAUSS,
  DatabaseType.GBASE8C,
  DatabaseType.QUESTDB,
  DatabaseType.VASTBASE,
  DatabaseType.YASHANDB,
  DatabaseType.GREENPLUM,
  DatabaseType.ENTERPRISEDB,
  DatabaseType.CRATEDB,
  DatabaseType.MATERIALIZE,
  DatabaseType.ALLOYDB,
  DatabaseType.CLOUDSQLPG,
  DatabaseType.FUJITSUPG,
  // MySQL-wire compatible
  DatabaseType.TIDB,
  DatabaseType.OCEANBASE,
  DatabaseType.TDSQL,
  DatabaseType.POLARDB,
  DatabaseType.DAMENG,
  DatabaseType.DORIS,
  DatabaseType.SELECTDB,
  DatabaseType.STARROCKS,
  DatabaseType.DATABEND,
  DatabaseType.GOLDENDB,
  DatabaseType.MANTICORESEARCH,
  DatabaseType.SINGLESTOREMEMSQL,
  DatabaseType.CLOUDSQLMYSQL,
  // Popular standalone engines (well-known syntax, LLM understands them)
  DatabaseType.DUCKDB,
  DatabaseType.ORACLE,
])

const {
  isLoading,
  error,
  messages,
  sendMessage,
  handleConfirmation: rawHandleConfirmation,
  cancelSession,
  clearChat,
  dismissError,
  activeSessionSources,
  lastSettings,
  initContextSettings,
  stopReason,
  stopMessage,
  progress,
} = useDataStudioChatAgent()

function handleConfirmation(msgId: string, event: { toolCallId: string, action: 'allow_once' | 'allow_always' | 'deny' | 'deny_always' | 'cancel' }) {
  rawHandleConfirmation(msgId, event.toolCallId, event.action)
}

const historyPanelOpen = ref(false)
const modeMenuOpen = ref(false)
const modePickerRef = ref<HTMLElement | null>(null)
onClickOutside(modePickerRef, () => {
  modeMenuOpen.value = false
})

const modeOptions = [
  { value: 'Ask', label: 'Ask', icon: HelpCircle },
  { value: 'Agent', label: 'Agent', icon: Bot },
  { value: 'Plan', label: 'Plan', icon: FileText },
] as const

const currentMode = computed<'Ask' | 'Agent' | 'Plan'>(() => {
  const m = activeSession.value?.permissionsMode
  if (m === 'Auto')
    return 'Agent'
  if (m === 'Plan')
    return 'Plan'
  return 'Ask'
})

async function selectMode(mode: 'Ask' | 'Agent' | 'Plan') {
  modeMenuOpen.value = false
  const target = mode === 'Agent' ? 'Auto' : mode
  await dataStudioStore.setSessionPermissionsMode(target as any)
}

const isEditingTitle = ref(false)
const editingTitleText = ref('')
const titleInputRef = ref<HTMLInputElement | null>(null)

const displaySessionTitle = computed(() => {
  const customTitle = activeSession.value?.title?.trim()
  const defaultPlaceholders = new Set([
    'New Chat',
    'New Session',
    'AI Assistant',
    t('dataStudio.history.newSession'),
  ])

  // 1. If user custom-named the session
  if (customTitle && !defaultPlaceholders.has(customTitle)) {
    return customTitle
  }

  // 2. Otherwise summarize/derive from the first user message
  const firstUser = messages.value.find(m => m.role === 'user' && m.content?.trim())
  if (firstUser?.content) {
    const singleLine = firstUser.content.replace(/\s+/g, ' ').trim()
    return singleLine.length > 45 ? `${singleLine.slice(0, 45)}…` : singleLine
  }

  // 3. Fallback when there is no chat yet
  return t('dataStudio.history.newSession')
})

function startEditTitle() {
  editingTitleText.value = displaySessionTitle.value
  isEditingTitle.value = true
  nextTick(() => {
    titleInputRef.value?.focus()
    titleInputRef.value?.select()
  })
}

function saveTitle() {
  if (!isEditingTitle.value)
    return
  const newTitle = editingTitleText.value.trim()
  if (activeSession.value && newTitle) {
    activeSession.value.title = newTitle
    const sess = dataStudioStore.sessions.find(s => s.id === activeSession.value?.id)
    if (sess) {
      sess.title = newTitle
    }
  }
  isEditingTitle.value = false
}

function cancelEditTitle() {
  isEditingTitle.value = false
}

const showModifyModal = ref(false)
const selectedSourceIdx = ref<number>(-1)
const addSourceOpen = ref(false)
const addSourceQuery = ref('')
const addSourceSelectedId = ref('')
const addSourceMode = ref<'Ask' | 'Inherit'>('Inherit')
const addSourcePickerRef = ref<HTMLElement | null>(null)

function resetAddSourceState() {
  addSourceOpen.value = false
  addSourceQuery.value = ''
  addSourceSelectedId.value = ''
  addSourceMode.value = 'Inherit'
}

onClickOutside(addSourcePickerRef, resetAddSourceState)

const hasMessages = computed(() => messages.value.length > 0)

const emptyHint = computed(() =>
  activeSessionSources.value.length > 0
    ? t('dataStudio.agent.emptyState')
    : t('dataStudio.agent.noSource'),
)

const availableAddConnections = computed(() => {
  const sessionConnIds = new Set(
    activeSessionSources.value.flatMap((s) => {
      const attached = attachedSources.value.find(a => a.sourceId === s.sourceId)
      return attached?.kind === 'database'
        ? [(attached as { connectionId: string }).connectionId]
        : []
    }),
  )
  return connections.value.filter(
    conn =>
      !sessionConnIds.has(String(conn.id ?? ''))
      && AGENT_SUPPORTED_TYPES.has(conn.type as DatabaseType),
  )
})

const filteredAddConnections = computed(() => {
  const q = addSourceQuery.value.toLowerCase().trim()
  return q
    ? availableAddConnections.value.filter(
        c => c.name.toLowerCase().includes(q) || c.type.toLowerCase().includes(q),
      )
    : availableAddConnections.value
})

const addSourceEmptyMessage = computed(() => {
  if (connections.value.length === 0)
    return t('dataStudio.addSource.noConnections')
  if (availableAddConnections.value.length === 0)
    return t('dataStudio.addSource.allAttached')
  return t('dataStudio.addSource.noConnections')
})

function getConnectionMeta(conn: ServerConnection): string {
  const label = conn.type
  if (conn.type === DatabaseType.SQLITE)
    return `${label} • ${conn.host}`
  return `${label} • ${conn.host}:${conn.port}`
}

function getConnectionIcon(type: string): string {
  return getDatabaseIcon(type as DatabaseType)
}

function selectAddConnection(conn: ServerConnection) {
  addSourceSelectedId.value = String(conn.id)
}

async function confirmAddSource() {
  if (!addSourceSelectedId.value)
    return
  const conn = connections.value.find(c => String(c.id) === addSourceSelectedId.value)
  if (!conn || conn.id === undefined)
    return

  try {
    const newSource = await dataStudioStore.addDatabaseSourceFromConnection({
      connectionId: String(conn.id),
      name: conn.name,
      databaseType: conn.type as 'POSTGRESQL' | 'MYSQL' | 'SQLSERVER' | 'SQLITE',
      permissions: { read: true, create: false, update: false, delete: false },
    })

    if (!dataStudioStore.activeSession) {
      await dataStudioStore.getOrCreateSession()
    }
    await dataStudioStore.attachSourceToActiveSession(newSource.sourceId)
    if (addSourceMode.value === 'Ask' && dataStudioStore.activeSession) {
      dataStudioStore.updateSessionSourceMode(
        newSource.sourceId,
        'custom',
      )
    }
    resetAddSourceState()
  }
  catch (err) {
    console.error('Failed to add data source:', err)
  }
}

async function switchSession(sessionId: string) {
  dataStudioStore.setActiveSession(sessionId)
  await dataStudioStore.reloadSessionMessages(sessionId)
  await dataStudioStore.loadConfirmationRulesFromDb(sessionId)
  historyPanelOpen.value = false
}

async function deleteSession(sessionId: string) {
  await dataStudioStore.removeSession(sessionId)
}

function startNewSession() {
  dataStudioStore.setActiveSession('')
  historyPanelOpen.value = false
}

function openModifyModal(index: number) {
  selectedSourceIdx.value = index
  showModifyModal.value = true
}

async function onModelChange(modelId: string) {
  const sess = dataStudioStore.activeSession
  if (sess?.id) {
    dataStudioStore.setSessionModelId(sess.id, modelId)
  }
}

async function initDataStudio() {
  await dataStudioStore.loadSessions()
  await connectionStore.fetchConnections()
  await dataStudioStore.loadAttachedSourcesFromDb()
  if (dataStudioStore.activeSessionId) {
    await dataStudioStore.loadConfirmationRulesFromDb(dataStudioStore.activeSessionId)
  }
  await initContextSettings()
}

const entitlementStore = useEntitlementStore()

onMounted(async () => {
  await initAgentRuntime()
  if (entitlementStore.isLocalUltimate) {
    await initDataStudio()
  }
})

// while gated, the store/session loads stay dormant; a restored subscription
// initializes the page in place
watch(
  () => entitlementStore.isLocalUltimate,
  (ultimate) => {
    if (ultimate)
      void initDataStudio()
  },
)

onBeforeUnmount(() => {
  disposeAgentRuntime()
})

const appStore = useAppStore()
const { llmSettings } = storeToRefs(appStore)

function syncAllProviderModels() {
  llmSettings.value.providers
    .filter(p => p.enabled)
    .forEach(p => appStore.syncProviderModels(p.id).catch(() => {}))
}
</script>

<template>
  <AppLayout :hide-ai-button="true" :plain="true">
    <div class="flex flex-1 gap-2 min-h-0 w-full relative overflow-hidden">
      <!-- Main Conversation Area -->
      <div class="flex flex-1 flex-col h-full min-w-0 w-full relative">
        <!-- Chat Panel -->
        <div class="flex-1 h-full min-h-0 w-full">
          <ChatPanel
            :messages="messages"
            :is-loading="isLoading"
            :error="error"
            :empty-hint="emptyHint"
            :input-placeholder="t('dataStudio.inputPlaceholder')"
            :session-id="activeSession?.id ?? null"
            :context-settings="lastSettings"
            :stop-reason="stopReason"
            :stop-message="stopMessage"
            :progress="progress"
            feature="dataStudio"
            compact
            @send="sendMessage"
            @stop-loop="cancelSession"
            @confirm-tool-call="handleConfirmation"
            @model-change="onModelChange"
            @model-picker-open="syncAllProviderModels"
            @dismiss-error="dismissError"
          >
            <!-- Top Card Header: Title & Actions -->
            <template #header>
              <div class="px-5 py-2.5 flex shrink-0 items-center justify-between">
                <div class="flex gap-2 min-w-0 items-center">
                  <div v-if="isEditingTitle" class="flex min-w-0 items-center">
                    <input
                      ref="titleInputRef"
                      v-model="editingTitleText"
                      class="text-sm text-foreground font-medium px-2 py-0.5 outline-none border border-primary/50 rounded bg-background h-7 w-64 focus:ring-1 focus:ring-primary"
                      @keydown.enter="saveTitle"
                      @keydown.esc="cancelEditTitle"
                      @blur="saveTitle"
                    >
                  </div>
                  <span
                    v-else
                    class="text-sm text-foreground font-medium max-w-md cursor-pointer truncate transition-colors hover:text-foreground/80"
                    :title="t('common.buttons.edit') || 'Click to edit title'"
                    @click="startEditTitle"
                  >
                    {{ displaySessionTitle }}
                  </span>
                </div>
                <div class="flex gap-1.5 items-center">
                  <button
                    v-if="isLoading"
                    class="text-destructive rounded-md inline-flex h-7 w-7 cursor-pointer transition-colors items-center justify-center hover:bg-destructive/10"
                    :title="t('dataStudio.agent.stop')"
                    @click="cancelSession"
                  >
                    <Square class="h-3.5 w-3.5" />
                  </button>
                  <button
                    v-if="hasMessages"
                    class="text-muted-foreground rounded-md inline-flex h-7 w-7 cursor-pointer transition-colors items-center justify-center hover:text-foreground hover:bg-muted/40"
                    :title="t('dataStudio.agent.clearChat')"
                    @click="clearChat"
                  >
                    <Trash2 class="h-3.5 w-3.5" />
                  </button>
                  <button
                    class="text-muted-foreground rounded-md inline-flex h-7 w-7 cursor-pointer transition-colors items-center justify-center hover:text-foreground hover:bg-muted/40"
                    :title="t('dataStudio.history.newSession')"
                    @click="startNewSession"
                  >
                    <SquarePen class="h-3.5 w-3.5" />
                  </button>
                  <button
                    class="text-muted-foreground rounded-md inline-flex h-7 w-7 cursor-pointer transition-colors items-center justify-center hover:text-foreground hover:bg-muted/40"
                    :class="{ 'text-foreground bg-muted/40': historyPanelOpen }"
                    :title="t('dataStudio.history.title')"
                    @click="historyPanelOpen = !historyPanelOpen"
                  >
                    <PanelRight class="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </template>
            <!-- toolbar-left: [+] button FIRST, then attached source chips -->
            <template #toolbar-left>
              <!-- Add source dropdown -->
              <div ref="addSourcePickerRef" class="add-source-picker">
                <button
                  class="icon-button-sm"
                  :aria-expanded="addSourceOpen"
                  :title="t('dataStudio.addSource.title')"
                  @click.stop="addSourceOpen = !addSourceOpen"
                >
                  <Plus class="h-4 w-4" />
                </button>

                <Transition name="menu-rise">
                  <div v-if="addSourceOpen" class="add-source-menu" @click.stop>
                    <div class="add-source-menu-title">
                      {{ t('dataStudio.addSource.selectConnection') }}
                    </div>

                    <div class="add-source-search-wrap">
                      <Search class="add-source-search-icon h-3.5 w-3.5" />
                      <input
                        v-model="addSourceQuery"
                        class="add-source-search"
                        :placeholder="t('dataStudio.addSource.searchPlaceholder')"
                        autocomplete="off"
                      >
                    </div>

                    <div class="add-source-list">
                      <button
                        v-for="conn in filteredAddConnections"
                        :key="String(conn.id)"
                        class="add-source-item"
                        :class="{ 'add-source-item--selected': addSourceSelectedId === String(conn.id) }"
                        @click="selectAddConnection(conn)"
                      >
                        <div class="add-source-item-icon">
                          <img
                            :src="getConnectionIcon(conn.type)"
                            class="h-4 w-4 object-contain"
                            :alt="conn.type"
                          >
                        </div>
                        <div class="add-source-item-info">
                          <span class="add-source-item-name">{{ conn.name }}</span>
                          <span class="add-source-item-meta">{{ getConnectionMeta(conn) }}</span>
                        </div>
                        <span
                          v-if="addSourceSelectedId === String(conn.id)"
                          class="text-foreground ml-auto shrink-0 h-3.5 w-3.5"
                        />
                      </button>
                      <div v-if="filteredAddConnections.length === 0" class="add-source-empty">
                        {{ addSourceEmptyMessage }}
                      </div>
                    </div>

                    <div v-if="addSourceSelectedId" class="add-source-permissions">
                      <div class="add-source-permissions-header">
                        <Shield class="h-3.5 w-3.5" />
                        <span class="text-xs font-semibold">
                          {{ t('dataStudio.modifySource.accessPermissions') }}
                        </span>
                      </div>
                      <div class="add-source-mode-row">
                        <button
                          class="mode-btn" :class="[addSourceMode === 'Ask' && 'mode-btn--active']"
                          @click="addSourceMode = 'Ask'"
                        >
                          <Lock class="h-3.5 w-3.5" />
                          <span>{{ t('aiPermissions.conversationReadOnly') }}</span>
                        </button>
                        <button
                          class="mode-btn" :class="[addSourceMode === 'Inherit' && 'mode-btn--active']"
                          @click="addSourceMode = 'Inherit'"
                        >
                          <Link2 class="h-3.5 w-3.5" />
                          <span>{{ t('dataStudio.modifySource.inheritTitle') }}</span>
                        </button>
                      </div>
                    </div>

                    <div class="add-source-footer">
                      <button
                        class="add-source-connect-btn"
                        :disabled="!addSourceSelectedId"
                        @click="confirmAddSource"
                      >
                        <DatabaseZap class="h-3.5 w-3.5" />
                        {{ t('dataStudio.addSource.connectSource') }}
                      </button>
                    </div>
                  </div>
                </Transition>
              </div>

              <!-- Connected source chips -->
              <button
                v-for="(source, idx) in activeSessionSources"
                :key="source.sourceId"
                class="source-chip"
                :title="t('dataStudio.modifySource.title')"
                @click="openModifyModal(idx)"
              >
                <img
                  :src="getConnectionIcon(source.databaseType)"
                  class="shrink-0 h-3.5 w-3.5 object-contain"
                  :alt="source.databaseType"
                >
                <span class="source-chip-name">{{ source.alias }}</span>
                <Settings class="source-chip-edit h-3.5 w-3.5" />
              </button>
            </template>

            <!-- toolbar-right: Mode selector (Ask / Agent / Plan) next to Send button -->
            <template #toolbar-right>
              <div ref="modePickerRef" class="relative">
                <button
                  class="mode-trigger-btn"
                  :title="t('dataStudio.modifySource.accessPermissions')"
                  @click.stop="modeMenuOpen = !modeMenuOpen"
                >
                  <span>{{ currentMode }}</span>
                  <ChevronDown class="opacity-60 h-3 w-3 transition-transform duration-150" :class="{ 'rotate-180': modeMenuOpen }" />
                </button>

                <Transition name="menu-rise">
                  <div v-if="modeMenuOpen" class="mode-dropdown-menu" @click.stop>
                    <button
                      v-for="opt in modeOptions"
                      :key="opt.value"
                      class="mode-menu-row"
                      :class="{ 'mode-menu-row--active': currentMode === opt.value }"
                      @click="selectMode(opt.value)"
                    >
                      <div class="flex gap-2 items-center">
                        <component :is="opt.icon" class="h-3.5 w-3.5" />
                        <span class="text-xs font-medium">{{ opt.label }}</span>
                      </div>
                      <Check v-if="currentMode === opt.value" class="text-foreground ml-auto h-3.5 w-3.5" />
                    </button>
                  </div>
                </Transition>
              </div>
            </template>
          </ChatPanel>
        </div>
      </div>

      <!-- History Panel (Right Sidebar) -->
      <div
        v-if="historyPanelOpen"
        class="border border-border/70 rounded-xl bg-card/40 flex shrink-0 flex-col h-full w-72 shadow-sm overflow-hidden md:w-80"
      >
        <SessionHistoryPanel
          @select="switchSession"
          @delete="deleteSession"
          @new-session="startNewSession"
          @close="historyPanelOpen = false"
        />
      </div>

      <!-- Modals -->
      <ModifySourceModal v-model:open="showModifyModal" :source-idx="selectedSourceIdx" />
    </div>
  </AppLayout>
</template>

<style scoped>
.data-studio-container {
  background: hsl(var(--background));
}

.data-studio-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.data-studio-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid hsl(var(--border));
  flex-shrink: 0;
}

.data-studio-conversation {
  flex: 1;
  min-height: 0;
}

.data-studio-history {
  width: 288px;
  flex-shrink: 0;
  border-right: 1px solid hsl(var(--border));
  overflow-y: auto;
}

.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  transition: all 0.15s;
}

.icon-button:hover {
  background: hsl(var(--muted));
  color: hsl(var(--foreground));
}

.icon-button--active {
  background: hsl(var(--muted));
  color: hsl(var(--foreground));
}

.icon-button-sm {
  display: inline-flex;
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

.icon-button-sm:hover {
  background: hsl(var(--muted) / 0.4);
  color: hsl(var(--foreground));
}

.source-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  max-width: 140px;
  padding: 0 6px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: hsl(var(--muted-foreground));
  font-size: var(--font-size-dense);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.source-chip:hover {
  background: hsl(var(--muted) / 0.4);
  color: hsl(var(--foreground));
}

.source-chip-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.source-chip-edit {
  opacity: 0.5;
  flex-shrink: 0;
  transition: opacity 0.15s;
}

.source-chip:hover .source-chip-edit {
  opacity: 0.8;
}

.source-chip .source-chip-edit:hover {
  opacity: 1;
}

/* ── Add source ── */

.add-source-picker {
  position: relative;
}

.add-source-menu {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 0;
  z-index: 50;
  width: 288px;
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  background: hsl(var(--popover));
  box-shadow: 0 8px 24px hsl(0 0% 0% / 0.12);
  overflow: hidden;
}

.add-source-menu-title {
  padding: 10px 12px 6px;
  font-size: var(--font-size-dense);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
}

.add-source-search-wrap {
  position: relative;
  margin: 0 12px 8px;
}

.add-source-search-icon {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: hsl(var(--muted-foreground));
  pointer-events: none;
}

.add-source-search {
  width: 100%;
  padding: 7px 10px 7px 28px;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  font-size: var(--font-size-body);
  outline: none;
}

.add-source-search:focus {
  border-color: hsl(var(--foreground) / 0.4);
}

.add-source-search::placeholder {
  color: hsl(var(--muted-foreground));
}

.add-source-list {
  max-height: 192px;
  overflow-y: auto;
}

.add-source-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid hsl(var(--border) / 0.5);
  cursor: pointer;
  transition: background-color 0.12s;
}

.add-source-item:last-child {
  border-bottom: none;
}

.add-source-item:hover {
  background: hsl(var(--muted) / 0.5);
}

.add-source-item--selected {
  background: hsl(var(--muted) / 0.5);
}

.add-source-item-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  background: hsl(var(--muted));
  flex-shrink: 0;
}

.add-source-item-icon svg {
  color: hsl(var(--muted-foreground));
}

.add-source-item-info {
  flex: 1;
  min-width: 0;
}

.add-source-item-name {
  display: block;
  font-size: var(--font-size-body);
  font-weight: 500;
  color: hsl(var(--foreground));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.add-source-item-meta {
  display: block;
  font-size: var(--font-size-caption);
  color: hsl(var(--muted-foreground));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.add-source-empty {
  font-size: var(--font-size-dense);
  color: hsl(var(--muted-foreground));
  padding: 16px;
  text-align: center;
}

.add-source-permissions {
  padding: 8px 12px;
  border-top: 1px solid hsl(var(--border));
}

.add-source-permissions-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  color: hsl(var(--muted-foreground));
}

.add-source-mode-row {
  display: flex;
  gap: 8px;
}

.mode-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: transparent;
  color: hsl(var(--muted-foreground));
  font-size: var(--font-size-dense);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.12s;
}

.mode-btn:hover {
  background: hsl(var(--muted) / 0.4);
}

.mode-btn--active {
  border-color: hsl(var(--primary) / 0.5);
  background: hsl(var(--primary) / 0.08);
  color: hsl(var(--foreground));
}

.add-source-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 8px 12px;
  border-top: 1px solid hsl(var(--border));
  background: hsl(var(--muted) / 0.2);
}

.add-source-connect-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border: none;
  border-radius: 6px;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  font-size: var(--font-size-dense);
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.add-source-connect-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.add-source-connect-btn:not(:disabled):hover {
  opacity: 0.9;
}

/* ── Mode selector (Ask / Agent / Plan) ── */

.mode-trigger-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 6px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: hsl(var(--muted-foreground));
  font-size: var(--font-size-dense);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.mode-trigger-btn:hover {
  background: hsl(var(--muted) / 0.4);
  color: hsl(var(--foreground));
}

.mode-dropdown-menu {
  position: absolute;
  bottom: calc(100% + 6px);
  right: 0;
  z-index: 50;
  min-width: 140px;
  padding: 4px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--popover));
  box-shadow: 0 8px 24px hsl(0 0% 0% / 0.12);
}

.mode-menu-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  transition: all 0.12s;
}

.mode-menu-row:hover {
  background: hsl(var(--muted) / 0.5);
  color: hsl(var(--foreground));
}

.mode-menu-row--active {
  color: hsl(var(--foreground));
  background: hsl(var(--muted) / 0.3);
}

.menu-rise-enter-active {
  animation: menu-rise 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}
.menu-rise-leave-active {
  animation: menu-rise 0.14s cubic-bezier(0.16, 1, 0.3, 1) reverse;
}
@keyframes menu-rise {
  from { opacity: 0; transform: scale(0.93) translateY(6px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
</style>
