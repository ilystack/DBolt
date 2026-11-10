<script setup lang="ts">
import { Copy, Plus, Tag, X } from 'lucide-vue-next'
import type { QueryTab } from '@/store/tabStore'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/composables/useNotifications'
import { useConnectionStore } from '@/store'
import { useTabStore } from '@/store/tabStore'
import DbTypeIcon from './DbTypeIcon.vue'

type Props = {
  tabs: QueryTab[]
  activeTabId: string | null
  activeConnectionId?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'select', tabId: string): void
  (e: 'close', tabId: string): void
  (e: 'closeForce', tabId: string): void
  (e: 'new'): void
}>()

const { t } = useI18n()

const connectionStore = useConnectionStore()

const activeConnectionDbType = computed(() =>
  props.activeConnectionId ? connectionStore.getConnectionById(props.activeConnectionId)?.type : undefined,
)

function getTabDbType(tab: QueryTab) {
  if (tab.orphanFromConnectionId) {
    return connectionStore.getConnectionById(tab.orphanFromConnectionId)?.type
  }
  return activeConnectionDbType.value
}

const isOrphanTab = (tab: QueryTab) => tab.orphanFromConnectionId !== undefined

const showCloseDialog = ref(false)
const tabToClose = ref<QueryTab | null>(null)

const getTabTitle = (tab: QueryTab) => tab.name

function handleTabClick(tabId: string) {
  emit('select', tabId)
}

function handleCloseClick(event: MouseEvent, tab: QueryTab) {
  event.stopPropagation()

  if (tab.hasUnsavedChanges) {
    tabToClose.value = tab
    showCloseDialog.value = true
  }
  else {
    emit('close', tab.id)
  }
}

function confirmClose() {
  if (tabToClose.value) {
    emit('closeForce', tabToClose.value.id)
    tabToClose.value = null
  }
  showCloseDialog.value = false
}

function cancelClose() {
  tabToClose.value = null
  showCloseDialog.value = false
}

function triggerClose(tabId: string) {
  const tab = props.tabs.find(t => t.id === tabId)
  if (!tab)
    return
  if (tab.hasUnsavedChanges) {
    tabToClose.value = tab
    showCloseDialog.value = true
  }
  else {
    emit('close', tab.id)
  }
}

defineExpose({ triggerClose })

function handleNewTab() {
  emit('new')
}

const tabStore = useTabStore()

// ── Context Menu ─────────────────────────────────────────────────────────────
const contextMenu = ref<{
  show: boolean
  x: number
  y: number
  tab: QueryTab | null
}>({
  show: false,
  x: 0,
  y: 0,
  tab: null,
})

function closeContextMenu() {
  contextMenu.value.show = false
  contextMenu.value.tab = null
}

function openContextMenu(event: MouseEvent, tab: QueryTab) {
  event.preventDefault()
  event.stopPropagation()
  contextMenu.value = {
    show: true,
    x: Math.min(event.clientX, window.innerWidth - 220),
    y: Math.min(event.clientY, window.innerHeight - 300),
    tab,
  }
}

function handleWindowClick() {
  if (contextMenu.value.show) {
    closeContextMenu()
  }
}

onMounted(() => {
  window.addEventListener('click', handleWindowClick)
})

onBeforeUnmount(() => {
  window.removeEventListener('click', handleWindowClick)
})

const isLastTab = (tab: QueryTab | null) => {
  if (!tab || props.tabs.length === 0)
    return true
  return props.tabs[props.tabs.length - 1]?.id === tab.id
}

async function handleContextAction(action: 'close' | 'closeOthers' | 'closeRight' | 'closeSaved' | 'closeAll' | 'duplicate' | 'copyName') {
  const target = contextMenu.value.tab
  closeContextMenu()
  if (!target)
    return

  switch (action) {
    case 'close':
      handleCloseClick(new MouseEvent('click'), target)
      break
    case 'closeOthers': {
      const others = props.tabs.filter(t => t.id !== target.id)
      const dirty = others.some(t => t.hasUnsavedChanges)
      if (dirty) {
        tabStore.tabs = props.tabs.filter(t => t.id === target.id || t.hasUnsavedChanges)
        if (!tabStore.tabs.find(t => t.id === tabStore.activeTabId)) {
          tabStore.activeTabId = target.id
        }
      }
      else {
        tabStore.closeOthers(target.id)
      }
      break
    }
    case 'closeRight': {
      const idx = props.tabs.findIndex(t => t.id === target.id)
      if (idx !== -1) {
        const rightTabs = props.tabs.slice(idx + 1)
        const dirty = rightTabs.some(t => t.hasUnsavedChanges)
        if (dirty) {
          tabStore.tabs = props.tabs.filter((t, i) => i <= idx || t.hasUnsavedChanges)
          if (!tabStore.tabs.find(t => t.id === tabStore.activeTabId)) {
            tabStore.activeTabId = target.id
          }
        }
        else {
          tabStore.closeToTheRight(target.id)
        }
      }
      break
    }
    case 'closeSaved':
      tabStore.closeSavedTabs()
      break
    case 'closeAll': {
      const dirty = props.tabs.some(t => t.hasUnsavedChanges)
      if (dirty) {
        tabStore.closeSavedTabs()
      }
      else {
        tabStore.closeAllTabs()
      }
      break
    }
    case 'duplicate':
      tabStore.duplicateTab(target.id)
      break
    case 'copyName':
      try {
        await navigator.clipboard.writeText(target.name)
        toast.success(`Copied: ${target.name}`)
      }
      catch {
        // clipboard unavailable
      }
      break
  }
}

const isActiveTab = (tabId: string) => props.activeTabId === tabId
</script>

<template>
  <div class="query-tabs border-b border-border bg-chrome flex items-center overflow-x-auto">
    <!-- Tabs -->
    <div class="flex shrink-0 h-full items-stretch">
      <div
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-item group text-body px-3 border-r border-border flex gap-1 cursor-pointer select-none transition-colors items-center"
        :class="{
          'bg-background text-foreground font-medium': isActiveTab(tab.id),
          'bg-muted/30 text-muted-foreground hover:bg-background/50 hover:text-foreground': !isActiveTab(tab.id),
          'opacity-60': isOrphanTab(tab),
        }"
        @click="handleTabClick(tab.id)"
        @contextmenu.prevent.stop="openContextMenu($event, tab)"
      >
        <!-- Orphan warning icon -->
        <svg
          v-if="isOrphanTab(tab)"
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-orange-500 flex-shrink-0"
          :title="t('components.queryTabs.orphan')"
        >
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 3 21h18a2 2 0 0 0 1.73-3Z" />
          <line x1="12" x2="12" y1="9" y2="13" />
          <line x1="12" x2="12.01" y1="17" y2="17" />
        </svg>

        <!-- DB type icon -->
        <DbTypeIcon
          v-if="getTabDbType(tab)"
          :type="getTabDbType(tab)!"
          :size="14"
          class="flex-shrink-0"
        />

        <!-- Tab icon: ER diagram icon, table grid icon for table-view tabs, file icon for query tabs -->
        <svg
          v-if="tab.erDiagram"
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-muted-foreground flex-shrink-0"
        >
          <circle cx="12" cy="12" r="3" />
          <circle cx="19" cy="5" r="2" />
          <circle cx="5" cy="19" r="2" />
          <line x1="12" y1="12" x2="13.65" y2="5.87" />
          <line x1="12" y1="12" x2="6.35" y2="17.13" />
          <line x1="12" y1="12" x2="17" y2="14" />
        </svg>
        <svg
          v-else-if="tab.tableView"
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-muted-foreground flex-shrink-0"
        >
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M3 9h18" />
          <path d="M3 15h18" />
          <path d="M9 3v18" />
        </svg>
        <svg
          v-else
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-muted-foreground flex-shrink-0"
        >
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>

        <!-- Tab title -->
        <span class="max-w-32 truncate" :title="getTabTitle(tab)">
          {{ getTabTitle(tab) }}
        </span>

        <!-- Unsaved indicator -->
        <span
          v-if="tab.hasUnsavedChanges"
          class="rounded-full bg-orange-500 flex-shrink-0 h-2 w-2"
          :title="t('components.queryTabs.unsaved')"
        />

        <!-- Executing indicator -->
        <svg
          v-if="tab.isExecuting"
          class="text-primary-text flex-shrink-0 h-3 w-3 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>

        <!-- Close button -->
        <button
          class="rounded opacity-0 flex flex-shrink-0 h-4 w-4 transition-colors items-center justify-center hover:bg-muted-foreground/20 focus-visible:opacity-100 group-hover:opacity-100"
          :class="{ 'opacity-100': isActiveTab(tab.id) }"
          :aria-label="t('common.buttons.close')"
          @click="handleCloseClick($event, tab)"
        >
          <X class="shrink-0 h-3 w-3" />
        </button>
      </div>
    </div>

    <!-- New tab button -->
    <div class="px-2 flex shrink-0 items-center">
      <Button
        variant="ghost"
        size="sm"
        class="text-xs text-muted-foreground font-medium px-2.5 border border-border/60 rounded gap-1.5 h-6.5 shadow-none transition-colors hover:text-foreground hover:border-border hover:bg-muted/60"
        :title="t('components.queryTabs.new')"
        @click="handleNewTab"
      >
        <Plus class="shrink-0 h-3.5 w-3.5" />
        <span class="whitespace-nowrap">{{ t('components.queryTabs.new') }}</span>
      </Button>
    </div>

    <!-- Unsaved changes dialog -->
    <AlertDialog v-model:open="showCloseDialog">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('components.queryTabs.closeDialog.title') }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ t('components.queryTabs.closeDialog.message', { name: tabToClose?.name || '' }) }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="cancelClose">
            {{ t('common.buttons.cancel') }}
          </AlertDialogCancel>
          <AlertDialogAction
            @click="confirmClose"
          >
            {{ t('components.queryTabs.closeDialog.discard') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <!-- Tab Context Menu -->
    <Teleport to="body">
      <div
        v-if="contextMenu.show"
        class="fixed z-50"
        :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
        @click.stop
        @contextmenu.prevent
      >
        <DropdownMenu :open="true">
          <DropdownMenuTrigger class="sr-only" />
          <DropdownMenuContent
            align="start"
            class="text-xs py-1 border border-border bg-popover min-w-48 shadow-xl"
            @keydown.escape="closeContextMenu"
          >
            <!-- Close -->
            <DropdownMenuItem class="text-xs px-2.5 py-1.5 flex gap-4 cursor-pointer items-center justify-between" @click="handleContextAction('close')">
              <span>{{ t('components.queryTabs.contextMenu.close') }}</span>
              <span class="text-[10px] text-muted-foreground font-mono">Ctrl+W</span>
            </DropdownMenuItem>

            <!-- Close Others -->
            <DropdownMenuItem
              :disabled="tabs.length <= 1"
              class="text-xs px-2.5 py-1.5 flex gap-4 cursor-pointer items-center justify-between"
              @click="handleContextAction('closeOthers')"
            >
              <span>{{ t('components.queryTabs.contextMenu.closeOthers') }}</span>
            </DropdownMenuItem>

            <!-- Close to the Right -->
            <DropdownMenuItem
              :disabled="isLastTab(contextMenu.tab)"
              class="text-xs px-2.5 py-1.5 flex gap-4 cursor-pointer items-center justify-between"
              @click="handleContextAction('closeRight')"
            >
              <span>{{ t('components.queryTabs.contextMenu.closeRight') }}</span>
            </DropdownMenuItem>

            <!-- Close Saved -->
            <DropdownMenuItem
              class="text-xs px-2.5 py-1.5 flex gap-4 cursor-pointer items-center justify-between"
              @click="handleContextAction('closeSaved')"
            >
              <span>{{ t('components.queryTabs.contextMenu.closeSaved') }}</span>
            </DropdownMenuItem>

            <!-- Close All -->
            <DropdownMenuItem class="text-xs px-2.5 py-1.5 flex gap-4 cursor-pointer items-center justify-between" @click="handleContextAction('closeAll')">
              <span>{{ t('components.queryTabs.contextMenu.closeAll') }}</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator class="my-1 border-border/50" />

            <!-- Duplicate Tab -->
            <DropdownMenuItem class="text-xs px-2.5 py-1.5 flex gap-4 cursor-pointer items-center justify-between" @click="handleContextAction('duplicate')">
              <div class="flex gap-2 items-center">
                <Copy class="text-muted-foreground h-3.5 w-3.5" />
                <span>{{ t('components.queryTabs.contextMenu.duplicate') }}</span>
              </div>
            </DropdownMenuItem>

            <!-- Copy Name -->
            <DropdownMenuItem class="text-xs px-2.5 py-1.5 flex gap-4 cursor-pointer items-center justify-between" @click="handleContextAction('copyName')">
              <div class="flex gap-2 items-center">
                <Tag class="text-muted-foreground h-3.5 w-3.5" />
                <span>{{ t('components.queryTabs.contextMenu.copyName') }}</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.query-tabs {
  height: 35px;
}

.tab-item {
  min-width: 0;
  max-width: 200px;
}
</style>
