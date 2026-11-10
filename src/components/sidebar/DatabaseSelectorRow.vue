<script setup lang="ts">
import { BarChart3, Database, Download, Eye, FilePlus2, FileText, FolderOpen, FunctionSquare, MoreHorizontal, RefreshCw, Share, Table, Trash2 } from 'lucide-vue-next'
import type { DbCapabilities } from './dbCapabilities'
import type { ComboboxOption } from '@/components/ui/combobox'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/combobox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DatabaseType, useConnectionStore, useDatabaseStore } from '@/store'
import { getDbCapabilities } from './dbCapabilities'

type Props = {
  connectionId: string | null
  modelValue: string | null
  loading?: boolean
}

type ActionKind
  = | 'createScript'
    | 'newDatabase'
    | 'newSchema'
    | 'newTable'
    | 'newView'
    | 'newFunction'
    | 'newProcedure'
    | 'backupDatabase'
    | 'exportDatabase'
    | 'dropDatabase'
    | 'showErDiagram'

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | null): void
  (e: 'refresh'): void
  (e: 'action', kind: ActionKind): void
}>()

const { t } = useI18n()
const connectionStore = useConnectionStore()
const databaseStore = useDatabaseStore()

const activeConnection = computed(() =>
  props.connectionId ? connectionStore.getConnectionById(props.connectionId) : null,
)

const allDatabases = computed(() => {
  if (!props.connectionId)
    return []
  return databaseStore.metadata[props.connectionId]?.databases ?? []
})

const userDatabases = computed(() => allDatabases.value.filter(db => !db.is_system))
const systemDatabases = computed(() => allDatabases.value.filter(db => db.is_system))

const options = computed<ComboboxOption[]>(() => {
  const seen = new Set<string>()
  const allDbs = [
    { label: t('sidebar.database.placeholder'), value: '' },
    ...userDatabases.value
      .filter((db) => {
        if (seen.has(db.name))
          return false
        seen.add(db.name)
        return true
      })
      .map(db => ({ label: db.name, value: db.name })),
    ...systemDatabases.value
      .filter((db) => {
        if (seen.has(db.name))
          return false
        seen.add(db.name)
        return true
      })
      .map(db => ({ label: db.name, value: db.name, group: t('components.databaseBrowser.systemDatabases') })),
  ]
  return allDbs
})

const capabilities = computed<DbCapabilities>(() => {
  if (!activeConnection.value)
    return getDbCapabilities(DatabaseType.POSTGRESQL)
  return getDbCapabilities(activeConnection.value.type)
})

function handleSelect(value: string) {
  emit('update:modelValue', value === '' ? null : value)
}

function handleAction(kind: ActionKind) {
  emit('action', kind)
}

// Spin state with minimum duration — prevents icon from flickering
// when loading toggles faster than the animation can play out
const isSpinning = ref(false)
let spinTimer: ReturnType<typeof setTimeout> | null = null

watch(() => props.loading, (val) => {
  if (val) {
    if (spinTimer)
      clearTimeout(spinTimer)
    isSpinning.value = true
  }
  else {
    spinTimer = setTimeout(() => {
      isSpinning.value = false
      spinTimer = null
    }, 500)
  }
})

// Fetch databases when connectionId changes
watch(() => props.connectionId, async (connId) => {
  if (!connId)
    return
  const conn = connectionStore.getConnectionById(connId)
  if (!conn?.isConnected)
    return
  const meta = databaseStore.metadata[connId]
  if (!meta?.databases || meta.databases.length === 0)
    await databaseStore.fetchDatabases(connId)
}, { immediate: true })
</script>

<template>
  <div v-if="props.connectionId" class="px-2 py-1.5 border-b flex gap-1 items-center">
    <SearchableSelect
      :model-value="props.modelValue || ''"
      :options="options"
      :search-threshold="1"
      :placeholder="t('sidebar.database.placeholder')"
      :search-placeholder="t('sidebar.search')"
      :loading="props.loading"
      class="text-body flex-1 h-8"
      @update:model-value="handleSelect"
    >
      <template #selected-prepend>
        <Database class="text-yellow-500 mr-1.5 shrink-0 h-3.5 w-3.5" />
      </template>
      <template #option="{ option }">
        <div class="flex gap-1.5 w-full items-center">
          <Database class="text-yellow-500 shrink-0 h-3.5 w-3.5" />
          <span class="text-left flex-1 truncate">{{ option.label }}</span>
        </div>
      </template>
    </SearchableSelect>

    <Button
      variant="ghost"
      size="icon"
      class="shrink-0 h-7 w-7"
      :disabled="props.loading"
      :title="t('sidebar.database.refreshTooltip')"
      :aria-label="t('sidebar.database.refreshTooltip')"
      @click="emit('refresh')"
    >
      <RefreshCw class="h-3.5 w-3.5" :class="{ 'animate-spin': isSpinning }" />
    </Button>

    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button variant="ghost" size="icon" class="shrink-0 h-7 w-7" :title="t('sidebar.actionMenu.label')" :aria-label="t('sidebar.actionMenu.label')">
          <MoreHorizontal class="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div class="text-xs font-semibold px-2 py-1.5">
          {{ t('sidebar.actionMenu.label') }}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem :disabled="!props.modelValue" @click="handleAction('createScript')">
          <FilePlus2 class="mr-2" aria-hidden="true" /> {{ t('sidebar.actionMenu.createScript') }}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem v-if="capabilities.newDatabase" @click="handleAction('newDatabase')">
          <Database class="mr-2" /> {{ t('sidebar.actionMenu.newDatabase') }}
        </DropdownMenuItem>
        <DropdownMenuItem v-if="capabilities.newSchema" @click="handleAction('newSchema')">
          <FolderOpen class="mr-2" /> {{ t('sidebar.actionMenu.newSchema') }}
        </DropdownMenuItem>
        <DropdownMenuItem @click="handleAction('newTable')">
          <Table class="mr-2" /> {{ t('sidebar.actionMenu.newTable') }}
        </DropdownMenuItem>
        <DropdownMenuItem v-if="capabilities.views" @click="handleAction('newView')">
          <Eye class="mr-2" /> {{ t('sidebar.actionMenu.newView') }}
        </DropdownMenuItem>
        <DropdownMenuItem v-if="capabilities.functions" @click="handleAction('newFunction')">
          <FunctionSquare class="mr-2" /> {{ t('sidebar.actionMenu.newFunction') }}
        </DropdownMenuItem>
        <DropdownMenuItem v-if="capabilities.procedures" @click="handleAction('newProcedure')">
          <FileText class="mr-2" /> {{ t('sidebar.actionMenu.newProcedure') }}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem :disabled="!props.modelValue" @click="handleAction('showErDiagram')">
          <BarChart3 class="mr-2" /> {{ t('sidebar.actionMenu.showErDiagram') }}
        </DropdownMenuItem>
        <DropdownMenuSeparator v-if="capabilities.backup || capabilities.export" />
        <DropdownMenuItem v-if="capabilities.backup" @click="handleAction('backupDatabase')">
          <Download class="mr-2" /> {{ t('sidebar.actionMenu.backupDatabase') }}
        </DropdownMenuItem>
        <DropdownMenuItem v-if="capabilities.export" @click="handleAction('exportDatabase')">
          <Share class="mr-2" /> {{ t('sidebar.actionMenu.exportDatabase') }}
        </DropdownMenuItem>
        <DropdownMenuSeparator v-if="capabilities.dropDatabase" />
        <DropdownMenuItem
          v-if="capabilities.dropDatabase"
          class="text-destructive-text focus:text-destructive-text"
          @click="handleAction('dropDatabase')"
        >
          <Trash2 class="mr-2" /> {{ t('sidebar.actionMenu.dropDatabase') }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
