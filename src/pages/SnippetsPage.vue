<script setup lang="ts">
import type { SavedQueryMetadata } from '@/datasources'
import {
  Check,
  Copy,
  ExternalLink,
  FolderCode,
  Plus,
  Save,
  Search,
  Trash2,
} from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AppLayout from '@/components/layout/AppLayout.vue'
import SQLEditor from '@/components/SQLEditor.vue'
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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/composables/useNotifications'
import {
  deleteQueryFile,
  listSavedQueryFiles,
  loadQueryFile,
  readSavedQueriesMetadata,

  saveQueryFile,
  saveQueryMetadata,
} from '@/datasources'
import { useConnectionStore, useTabStore } from '@/store'

type SnippetCategory = 'All' | 'Performance' | 'Analysis' | 'Maintenance' | 'Utility' | 'General'

type SnippetItem = {
  id: string
  title: string
  category: SnippetCategory
  description?: string
  sql: string
  isStarter: boolean
  filePath?: string
  connectionId?: string | null
  modifiedAt?: number
}

const { t } = useI18n()
const router = useRouter()
const tabStore = useTabStore()
const connectionStore = useConnectionStore()

const STARTER_TEMPLATES: SnippetItem[] = [
  {
    id: 'starter-1',
    title: 'Find Table Sizes & Estimated Rows',
    category: 'Analysis',
    description: 'Overview of table storage footprint and record volume',
    isStarter: true,
    sql: `-- Table size overview across your database
SELECT 
    table_name,
    table_schema,
    table_rows,
    ROUND((data_length + index_length) / 1024 / 1024, 2) AS size_mb
FROM information_schema.tables
WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'sys', 'mysql')
ORDER BY (data_length + index_length) DESC;`,
  },
  {
    id: 'starter-2',
    title: 'Find Duplicate Records in Table',
    category: 'Utility',
    description: 'Detect duplicated values across specific columns',
    isStarter: true,
    sql: `-- Identify duplicates by target columns
SELECT 
    column_name_1, 
    column_name_2, 
    COUNT(*) AS duplicate_count
FROM your_table_name
GROUP BY column_name_1, column_name_2
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;`,
  },
  {
    id: 'starter-3',
    title: 'Active Queries & Performance Diagnostic',
    category: 'Performance',
    description: 'Inspect currently executing queries, runtime duration, and state',
    isStarter: true,
    sql: `-- PostgreSQL / MySQL active processes and slow queries
-- For PostgreSQL:
SELECT pid, now() - query_start AS duration, state, query 
FROM pg_stat_activity 
WHERE state != 'idle' 
ORDER BY duration DESC;

-- For MySQL:
-- SHOW FULL PROCESSLIST;`,
  },
  {
    id: 'starter-4',
    title: 'Safe Table Backup Snapshot',
    category: 'Maintenance',
    description: 'Clone table schema and existing records prior to running DDL/DML',
    isStarter: true,
    sql: `-- Create a quick snapshot before running destructive migrations
CREATE TABLE your_table_backup_20261108 AS
SELECT * FROM your_table;`,
  },
  {
    id: 'starter-5',
    title: 'Generate Time-Series Daily Aggregate',
    category: 'Analysis',
    description: 'Summarize metrics grouped by date with volume statistics',
    isStarter: true,
    sql: `-- Daily volume and revenue breakdown template
SELECT 
    DATE(created_at) AS report_date,
    COUNT(*) AS total_transactions,
    COUNT(DISTINCT user_id) AS unique_users,
    COALESCE(SUM(amount), 0) AS total_volume
FROM orders
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY report_date DESC;`,
  },
]

const searchQuery = ref('')
const activeFilter = ref<'all' | 'custom' | 'templates'>('all')
const customSnippets = ref<SnippetItem[]>([])
const activeSnippetId = ref<string>('starter-1')
const isSaving = ref(false)
const copied = ref(false)

// Active snippet edit state
const currentTitle = ref('')
const currentCategory = ref<SnippetCategory>('General')
const currentSql = ref('')
const currentConnectionId = ref<string>('any')

// Delete dialog state
const deleteDialogOpen = ref(false)

const allSnippets = computed(() => {
  return [...STARTER_TEMPLATES, ...customSnippets.value]
})

const filteredSnippets = computed(() => {
  return allSnippets.value.filter((item) => {
    if (activeFilter.value === 'custom' && item.isStarter)
      return false
    if (activeFilter.value === 'templates' && !item.isStarter)
      return false

    if (!searchQuery.value.trim())
      return true

    const query = searchQuery.value.toLowerCase().trim()
    return (
      item.title.toLowerCase().includes(query)
      || item.category.toLowerCase().includes(query)
      || item.sql.toLowerCase().includes(query)
    )
  })
})

const activeSnippet = computed(() => {
  return allSnippets.value.find(s => s.id === activeSnippetId.value) || allSnippets.value[0]
})

function selectSnippet(snippet: SnippetItem) {
  activeSnippetId.value = snippet.id
  currentTitle.value = snippet.title
  currentCategory.value = snippet.category
  currentSql.value = snippet.sql
  currentConnectionId.value = snippet.connectionId || 'any'
}

async function fetchCustomSnippets() {
  try {
    const [files, metadata] = await Promise.all([
      listSavedQueryFiles(),
      readSavedQueriesMetadata(),
    ])

    const loadedSnippets: SnippetItem[] = []
    for (const file of files) {
      try {
        const loadRes = await loadQueryFile(file.file_path)
        if (loadRes.success && loadRes.content) {
          const meta: SavedQueryMetadata | undefined = metadata.queries[file.file_path]
          loadedSnippets.push({
            id: file.file_path,
            title: file.file_name.replace(/\.sql$/i, ''),
            category: 'General',
            sql: loadRes.content,
            isStarter: false,
            filePath: file.file_path,
            connectionId: meta?.connectionId || null,
            modifiedAt: meta?.modifiedAt || file.modified_at,
          })
        }
      }
      catch {
        // Skip unreadable files
      }
    }
    customSnippets.value = loadedSnippets
  }
  catch (error) {
    console.error('Failed to load saved snippets:', error)
  }
}

function handleNewSnippet() {
  const newId = `new-${Date.now()}`
  const newItem: SnippetItem = {
    id: newId,
    title: t('pages.snippets.untitled'),
    category: 'General',
    sql: `-- Write your SQL snippet here\nSELECT 1;\n`,
    isStarter: false,
  }
  customSnippets.value.unshift(newItem)
  selectSnippet(newItem)
}

async function handleSaveSnippet() {
  if (!currentTitle.value.trim()) {
    currentTitle.value = t('pages.snippets.untitled')
  }

  isSaving.value = true
  try {
    const isEditingExistingCustom = !activeSnippet.value?.isStarter && activeSnippet.value?.filePath

    const fileName = `${currentTitle.value.trim().replace(/[\\/:*?"<>|]/g, '_')}.sql`
    const targetPath = isEditingExistingCustom ? activeSnippet.value?.filePath : undefined

    const saveRes = await saveQueryFile(currentSql.value, targetPath, fileName)
    if (saveRes.success && saveRes.file_path) {
      const conn = currentConnectionId.value !== 'any'
        ? connectionStore.getConnectionById(currentConnectionId.value)
        : null

      const meta: SavedQueryMetadata = {
        connectionId: conn?.id || null,
        connectionName: conn?.name || null,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      }
      await saveQueryMetadata(saveRes.file_path, meta)
      await fetchCustomSnippets()

      activeSnippetId.value = saveRes.file_path
      toast.success(t('pages.snippets.savedSuccess'))
    }
  }
  catch (e) {
    toast.error(e instanceof Error ? e.message : String(e))
  }
  finally {
    isSaving.value = false
  }
}

async function handleCopy() {
  try {
    await navigator.clipboard.writeText(currentSql.value)
    copied.value = true
    toast.success(t('pages.snippets.copied'))
    setTimeout(() => {
      copied.value = false
    }, 2000)
  }
  catch {
    toast.error('Failed to copy to clipboard')
  }
}

function handleOpenInQuery() {
  const connId = currentConnectionId.value !== 'any'
    ? currentConnectionId.value
    : connectionStore.activeConnectionId || undefined

  const db = connId ? connectionStore.getCurrentDatabase(connId) || undefined : undefined
  const tab = tabStore.createTab(connId, db)
  tabStore.updateTabContent(tab.id, currentSql.value)
  tabStore.updateTabName(tab.id, currentTitle.value || 'Snippet')

  toast.success(t('pages.snippets.openInQuery'))
  router.push('/queries')
}

async function handleDeleteSnippet() {
  if (activeSnippet.value?.isStarter)
    return

  const filePath = activeSnippet.value?.filePath
  if (filePath) {
    try {
      await deleteQueryFile(filePath)
      await fetchCustomSnippets()
      if (STARTER_TEMPLATES[0]) {
        selectSnippet(STARTER_TEMPLATES[0])
      }
      toast.success('Snippet deleted')
    }
    catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }
  else {
    // Draft that wasn't saved yet
    customSnippets.value = customSnippets.value.filter(s => s.id !== activeSnippet.value?.id)
    if (STARTER_TEMPLATES[0]) {
      selectSnippet(STARTER_TEMPLATES[0])
    }
  }
  deleteDialogOpen.value = false
}

onMounted(async () => {
  await fetchCustomSnippets()
  if (STARTER_TEMPLATES[0]) {
    selectSnippet(STARTER_TEMPLATES[0])
  }
})
</script>

<template>
  <AppLayout>
    <div class="bg-background flex flex-col h-full overflow-hidden">
      <!-- Page Header -->
      <header class="px-6 py-3 border-b border-border/40 flex shrink-0 items-center justify-between">
        <div class="flex gap-3 items-center">
          <h1 class="text-xl font-semibold">
            {{ t('pages.snippets.title') }}
          </h1>
          <span class="text-muted-foreground">|</span>
          <span class="text-sm text-muted-foreground">{{ t('pages.snippets.subtitle') }}</span>
        </div>
        <div class="flex gap-2 items-center">
          <Button size="sm" class="text-xs font-medium gap-1.5 h-8" @click="handleNewSnippet">
            <Plus class="h-3.5 w-3.5" />
            {{ t('pages.snippets.newSnippet') }}
          </Button>
        </div>
      </header>

      <!-- Main Workspace: 2-Column Split -->
      <div class="flex flex-1 min-h-0 overflow-hidden">
        <!-- Left Column: Snippet Catalog & Search -->
        <aside class="border-r border-border/40 bg-card/40 flex shrink-0 flex-col min-h-0 w-80">
          <!-- Search & Filter Controls -->
          <div class="p-3 border-b border-border/40 shrink-0 space-y-2.5">
            <div class="relative">
              <Search class="text-muted-foreground h-3.5 w-3.5 left-2.5 top-2.5 absolute" />
              <Input
                v-model="searchQuery"
                :placeholder="t('pages.snippets.searchPlaceholder')"
                class="text-xs pl-8 bg-background/60 h-8"
              />
            </div>
            <!-- Segmented filter buttons -->
            <div class="text-[11px] font-medium p-0.5 text-center border border-border/40 rounded-lg bg-muted/50 gap-1 grid grid-cols-3">
              <button
                type="button"
                class="py-1 rounded-md transition-colors"
                :class="activeFilter === 'all' ? 'bg-background text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'"
                @click="activeFilter = 'all'"
              >
                {{ t('pages.snippets.all') }}
              </button>
              <button
                type="button"
                class="py-1 rounded-md transition-colors"
                :class="activeFilter === 'custom' ? 'bg-background text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'"
                @click="activeFilter = 'custom'"
              >
                {{ t('pages.snippets.custom') }}
              </button>
              <button
                type="button"
                class="py-1 rounded-md transition-colors"
                :class="activeFilter === 'templates' ? 'bg-background text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'"
                @click="activeFilter = 'templates'"
              >
                {{ t('pages.snippets.templates') }}
              </button>
            </div>
          </div>

          <!-- Snippet List -->
          <div class="p-2 flex-1 overflow-y-auto space-y-1.5">
            <div
              v-for="item in filteredSnippets"
              :key="item.id"
              class="group p-2.5 text-left border rounded-lg cursor-pointer transition-colors relative"
              :class="[
                activeSnippetId === item.id
                  ? 'border-primary/50 bg-primary/10 text-foreground ring-1 ring-primary/30 shadow-xs'
                  : 'border-border/50 bg-card/60 text-muted-foreground hover:border-border hover:bg-accent/60 hover:text-foreground',
              ]"
              @click="selectSnippet(item)"
            >
              <div class="mb-1 flex gap-1 items-center justify-between">
                <span class="text-xs text-foreground font-medium flex-1 truncate">
                  {{ item.title }}
                </span>
                <span
                  class="text-[10px] font-medium px-1.5 py-0.2 rounded shrink-0"
                  :class="[
                    item.isStarter
                      ? 'bg-primary/15 text-primary border border-primary/20'
                      : 'bg-muted text-muted-foreground border border-border/40',
                  ]"
                >
                  {{ item.isStarter ? 'Starter' : item.category }}
                </span>
              </div>
              <p class="text-[11px] text-xs text-muted-foreground/80 font-mono px-1.5 py-1 rounded bg-background/40 line-clamp-2">
                {{ item.sql.replace(/\n/g, ' ').slice(0, 80) }}...
              </p>
            </div>

            <!-- Empty state -->
            <div
              v-if="filteredSnippets.length === 0"
              class="text-muted-foreground px-4 py-12 text-center space-y-2"
            >
              <FolderCode class="mx-auto opacity-30 h-8 w-8" />
              <p class="text-xs font-medium">
                {{ t('pages.snippets.noSnippets') }}
              </p>
              <p class="text-[11px] opacity-75">
                {{ t('pages.snippets.emptyHint') }}
              </p>
            </div>
          </div>
        </aside>

        <!-- Right Column: Snippet Editor & Execution Details -->
        <main class="bg-background flex flex-1 flex-col min-h-0 min-w-0">
          <!-- Editor Toolbar -->
          <div class="p-3 border-b border-border/40 bg-card/20 flex shrink-0 flex-wrap gap-3 items-center justify-between">
            <div class="flex flex-1 gap-2 min-w-[200px] items-center">
              <Input
                v-model="currentTitle"
                :placeholder="t('pages.snippets.snippetTitle')"
                class="text-sm font-medium border-border/60 bg-background h-8 max-w-sm"
              />
              <Select v-model="currentConnectionId">
                <SelectTrigger class="text-xs h-8 w-[170px]">
                  <SelectValue placeholder="Target Connection" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">
                    {{ t('pages.snippets.all') }} Connections
                  </SelectItem>
                  <SelectItem
                    v-for="conn in connectionStore.connections"
                    :key="conn.id"
                    :value="conn.id || 'any'"
                  >
                    {{ conn.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <!-- Action Buttons -->
            <div class="flex shrink-0 gap-2 items-center">
              <Button
                variant="outline"
                size="sm"
                class="text-xs font-normal gap-1.5 h-8"
                @click="handleCopy"
              >
                <Check v-if="copied" class="text-primary h-3.5 w-3.5" />
                <Copy v-else class="h-3.5 w-3.5" />
                {{ t('pages.snippets.copySql') }}
              </Button>

              <Button
                variant="outline"
                size="sm"
                class="text-xs text-destructive font-normal gap-1.5 h-8 hover:text-destructive"
                :disabled="activeSnippet?.isStarter"
                @click="deleteDialogOpen = true"
              >
                <Trash2 class="h-3.5 w-3.5" />
                {{ t('common.buttons.delete') }}
              </Button>

              <Button
                variant="secondary"
                size="sm"
                class="text-xs font-medium gap-1.5 h-8"
                :disabled="isSaving"
                @click="handleSaveSnippet"
              >
                <Save class="h-3.5 w-3.5" />
                {{ t('pages.snippets.saveSnippet') }}
              </Button>

              <Button
                size="sm"
                class="text-xs font-medium gap-1.5 h-8"
                @click="handleOpenInQuery"
              >
                <ExternalLink class="h-3.5 w-3.5" />
                {{ t('pages.snippets.openInQuery') }}
              </Button>
            </div>
          </div>

          <!-- Monaco SQL Editor Workspace -->
          <div class="flex-1 min-h-0 relative">
            <SQLEditor
              v-model="currentSql"
              height="100%"
              class="h-full w-full"
            />
          </div>
        </main>
      </div>

      <!-- Delete Confirmation Dialog -->
      <AlertDialog v-model:open="deleteDialogOpen">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{{ t('pages.snippets.deleteConfirmTitle') }}</AlertDialogTitle>
            <AlertDialogDescription>
              {{ t('pages.snippets.deleteConfirmDesc', { name: activeSnippet?.title }) }}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{{ t('common.buttons.cancel') }}</AlertDialogCancel>
            <AlertDialogAction
              class="text-destructive-foreground bg-destructive hover:bg-destructive/90"
              @click="handleDeleteSnippet"
            >
              {{ t('common.buttons.delete') }}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  </AppLayout>
</template>
