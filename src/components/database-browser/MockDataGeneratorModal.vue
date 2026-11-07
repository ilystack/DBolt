<script setup lang="ts">
import type { ColumnInfo } from '@/types/connection'
import { invoke } from '@tauri-apps/api/core'
import {
  Check,
  Copy,
  Database,
  Eye,
  FileCode,
  Play,
  Sparkles,
} from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/composables/useNotifications'
import { useTabStore } from '@/store/tabStore'

const props = defineProps<{
  open: boolean
  connectionId: string
  database: string
  schema?: string
  tableName: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'seeded': [rowsCount: number]
}>()

const tabStore = useTabStore()

type GeneratorType =
  | 'auto_increment'
  | 'uuid'
  | 'full_name'
  | 'first_name'
  | 'last_name'
  | 'email'
  | 'phone'
  | 'timestamp'
  | 'date'
  | 'status'
  | 'price'
  | 'integer'
  | 'boolean'
  | 'city'
  | 'country'
  | 'sentence'
  | 'null'

interface ColumnConfig {
  name: string
  dataType: string
  nullable: boolean
  isPrimaryKey: boolean
  isAutoIncrement: boolean
  included: boolean
  generator: GeneratorType
}

const loading = ref(false)
const executing = ref(false)
const rowCount = ref<number>(25)
const activeTab = ref<'columns' | 'preview_sql' | 'preview_table'>('columns')
const columns = ref<ColumnConfig[]>([])
const copied = ref(false)

const generatorOptions: { value: GeneratorType, label: string }[] = [
  { value: 'uuid', label: 'UUID (v4)' },
  { value: 'full_name', label: 'Full Name' },
  { value: 'first_name', label: 'First Name' },
  { value: 'last_name', label: 'Last Name' },
  { value: 'email', label: 'Email Address' },
  { value: 'phone', label: 'Phone Number' },
  { value: 'status', label: 'Status / Enum' },
  { value: 'timestamp', label: 'Timestamp (Recent)' },
  { value: 'date', label: 'Date (YYYY-MM-DD)' },
  { value: 'price', label: 'Price / Currency' },
  { value: 'integer', label: 'Random Integer' },
  { value: 'boolean', label: 'Boolean (true/false)' },
  { value: 'city', label: 'City' },
  { value: 'country', label: 'Country' },
  { value: 'sentence', label: 'Description / Text' },
  { value: 'auto_increment', label: 'Sequence (1, 2, 3...)' },
  { value: 'null', label: 'NULL' },
]

function inferGenerator(col: ColumnInfo): GeneratorType {
  const name = col.name.toLowerCase()
  const type = col.data_type.toLowerCase()

  if (col.is_auto_increment)
    return 'auto_increment'
  if (name.includes('uuid') || name.includes('guid') || type.includes('uuid'))
    return 'uuid'
  if (name.includes('email') || name.includes('mail'))
    return 'email'
  if (name === 'first_name' || name === 'firstname')
    return 'first_name'
  if (name === 'last_name' || name === 'lastname')
    return 'last_name'
  if (name.includes('name') || name.includes('user') || name.includes('author'))
    return 'full_name'
  if (name.includes('phone') || name.includes('mobile') || name.includes('tel'))
    return 'phone'
  if (name.includes('status') || name.includes('state') || name.includes('role'))
    return 'status'
  if (name.includes('price') || name.includes('amount') || name.includes('total') || name.includes('cost') || name.includes('balance') || name.includes('salary'))
    return 'price'
  if (name.includes('created') || name.includes('updated') || name.includes('timestamp') || type.includes('timestamp') || type.includes('datetime'))
    return 'timestamp'
  if (name.includes('date') || type.includes('date'))
    return 'date'
  if (name.startsWith('is_') || name.startsWith('has_') || name === 'active' || name === 'enabled' || type.includes('bool'))
    return 'boolean'
  if (name.includes('city') || name.includes('town'))
    return 'city'
  if (name.includes('country') || name.includes('nation'))
    return 'country'
  if (name.includes('desc') || name.includes('bio') || name.includes('comment') || name.includes('note') || name.includes('content') || name.includes('body'))
    return 'sentence'
  if (type.includes('int') || type.includes('serial'))
    return 'integer'
  if (type.includes('decimal') || type.includes('numeric') || type.includes('float') || type.includes('double'))
    return 'price'

  return 'sentence'
}

async function loadTableColumns() {
  if (!props.open || !props.tableName)
    return
  loading.value = true
  try {
    const rawCols = await invoke<ColumnInfo[]>('list_columns', {
      connectionId: props.connectionId,
      database: props.database,
      schema: props.schema || null,
      tableName: props.tableName,
    })

    columns.value = rawCols.map(c => ({
      name: c.name,
      dataType: c.data_type,
      nullable: c.nullable,
      isPrimaryKey: c.is_primary_key,
      isAutoIncrement: c.is_auto_increment,
      // By default skip auto-increment primary keys so database serial generates them
      included: !c.is_auto_increment,
      generator: inferGenerator(c),
    }))
  }
  catch (err) {
    console.error('Failed to load table columns:', err)
    toast.error(`Failed to load columns for table ${props.tableName}`)
  }
  finally {
    loading.value = false
  }
}

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    loadTableColumns()
  }
})

// Mock data pools
const FIRST_NAMES = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Sam', 'Chris', 'Elena', 'Lucas', 'Maya', 'Liam', 'Sophia', 'Ethan', 'Oliver', 'Ava', 'Noah', 'Emma', 'Aiden', 'Isabella', 'Mason', 'Mia']
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Chen', 'Vance', 'Sterling', 'Novak', 'Tanaka', 'Patel', 'Kim', 'Kowalski']
const DOMAINS = ['example.com', 'testcorp.io', 'hyperdb.org', 'devstack.net', 'cloudpulse.app']
const STATUSES = ['active', 'pending', 'completed', 'inactive', 'archived']
const CITIES = ['San Francisco', 'New York', 'Tokyo', 'London', 'Berlin', 'Singapore', 'Toronto', 'Amsterdam', 'Sydney', 'Stockholm']
const COUNTRIES = ['United States', 'Germany', 'Japan', 'United Kingdom', 'Canada', 'Singapore', 'Netherlands', 'Australia']
const DESCRIPTIONS = [
  'High priority customer record updated during routine maintenance.',
  'Standard account created via onboarding workflow.',
  'Automated test record generated for performance benchmarking.',
  'Enterprise subscription tier with quarterly billing cycle.',
  'External partner integration webhook endpoint.',
  'Archived transaction pending compliance review.',
]

function generateValue(generator: GeneratorType, index: number): string | number | boolean | null {
  const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

  switch (generator) {
    case 'auto_increment':
      return index + 1
    case 'uuid':
      return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
    case 'first_name':
      return pick(FIRST_NAMES)
    case 'last_name':
      return pick(LAST_NAMES)
    case 'full_name':
      return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`
    case 'email': {
      const f = pick(FIRST_NAMES).toLowerCase()
      const l = pick(LAST_NAMES).toLowerCase()
      const randNum = Math.floor(Math.random() * 899) + 100
      return `${f}.${l}${randNum}@${pick(DOMAINS)}`
    }
    case 'phone':
      return `+1-${Math.floor(Math.random() * 800 + 200)}-555-${String(Math.floor(Math.random() * 9000 + 1000))}`
    case 'status':
      return pick(STATUSES)
    case 'timestamp': {
      const pastMs = Math.floor(Math.random() * 90 * 24 * 60 * 60 * 1000)
      return new Date(Date.now() - pastMs).toISOString().slice(0, 19).replace('T', ' ')
    }
    case 'date': {
      const pastDays = Math.floor(Math.random() * 120)
      const d = new Date(Date.now() - pastDays * 24 * 60 * 60 * 1000)
      return d.toISOString().slice(0, 10)
    }
    case 'price':
      return Number((Math.random() * 250 + 4.99).toFixed(2))
    case 'integer':
      return Math.floor(Math.random() * 500) + 1
    case 'boolean':
      return Math.random() > 0.3
    case 'city':
      return pick(CITIES)
    case 'country':
      return pick(COUNTRIES)
    case 'sentence':
      return pick(DESCRIPTIONS)
    case 'null':
      return null
  }
}

function formatSqlLiteral(val: string | number | boolean | null): string {
  if (val === null)
    return 'NULL'
  if (typeof val === 'number')
    return String(val)
  if (typeof val === 'boolean')
    return val ? 'TRUE' : 'FALSE'
  return `'${String(val).replace(/'/g, '\'\'')}'`
}

const activeColumns = computed(() => columns.value.filter(c => c.included))

const generatedRows = computed(() => {
  const count = Math.min(Math.max(1, rowCount.value), 1000)
  const cols = activeColumns.value
  const rows: Record<string, string | number | boolean | null>[] = []

  for (let i = 0; i < count; i++) {
    const row: Record<string, string | number | boolean | null> = {}
    for (const c of cols) {
      row[c.name] = generateValue(c.generator, i)
    }
    rows.push(row)
  }
  return rows
})

const generatedSql = computed(() => {
  const cols = activeColumns.value
  if (cols.length === 0 || generatedRows.value.length === 0)
    return '-- Select at least one column to generate INSERT statements.'

  const escapedCols = cols.map(c => `\`${c.name}\``).join(', ')
  const targetTable = props.schema ? `\`${props.schema}\`.\`${props.tableName}\`` : `\`${props.tableName}\``

  const valueRows = generatedRows.value.map((row) => {
    const rowVals = cols.map(c => formatSqlLiteral(row[c.name]))
    return `  (${rowVals.join(', ')})`
  })

  return `-- DBolt Smart Mock Data Generator (${generatedRows.value.length} rows)\nINSERT INTO ${targetTable} (${escapedCols})\nVALUES\n${valueRows.join(',\n')};`
})

async function copySql() {
  try {
    await navigator.clipboard.writeText(generatedSql.value)
    copied.value = true
    toast.success('Generated SQL copied to clipboard')
    setTimeout(() => (copied.value = false), 2000)
  }
  catch {
    toast.error('Failed to copy SQL')
  }
}

function openInEditor() {
  const tab = tabStore.createTab(props.connectionId, props.database, props.schema)
  tab.name = `Seed ${props.tableName}`
  tab.content = generatedSql.value
  toast.success(`Generated mock data script opened in new query tab`)
  emit('update:open', false)
}

async function insertDirectly() {
  if (activeColumns.value.length === 0) {
    toast.error('Please select at least one column to insert')
    return
  }

  executing.value = true
  try {
    await invoke('execute_query', {
      connectionId: props.connectionId,
      database: props.database,
      schema: props.schema || null,
      sql: generatedSql.value,
    })
    toast.success(`Successfully inserted ${generatedRows.value.length} rows into ${props.tableName}!`)
    emit('seeded', generatedRows.value.length)
    emit('update:open', false)
  }
  catch (err) {
    console.error('Insert mock data error:', err)
    toast.error(`Failed to insert data: ${err instanceof Error ? err.message : String(err)}`)
  }
  finally {
    executing.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="p-0 flex flex-col gap-0 max-h-[88vh] max-w-4xl overflow-hidden bg-background border rounded-xl shadow-2xl">
      <!-- Modal Header -->
      <div class="px-5 py-3.5 border-b flex items-center justify-between shrink-0 bg-muted/20">
        <div class="flex items-center gap-2.5">
          <div class="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Sparkles class="h-4 w-4" />
          </div>
          <div>
            <DialogTitle class="text-sm font-semibold text-foreground flex items-center gap-2">
              <span>Mock Data Generator</span>
              <span class="text-xs font-mono font-normal px-2 py-0.5 rounded bg-muted text-muted-foreground border">
                {{ schema ? `${schema}.${tableName}` : tableName }}
              </span>
            </DialogTitle>
            <p class="text-[12px] text-muted-foreground">
              Generate realistic synthetic test data tailored to table columns and constraints.
            </p>
          </div>
        </div>

        <!-- Row Count Presets -->
        <div class="flex items-center gap-1.5 mr-6">
          <span class="text-xs text-muted-foreground mr-1">Rows:</span>
          <button
            v-for="preset in [10, 25, 50, 100, 250]"
            :key="preset"
            type="button"
            class="px-2 py-1 text-xs rounded font-medium transition-colors"
            :class="rowCount === preset ? 'bg-primary text-primary-foreground' : 'bg-muted/70 text-muted-foreground hover:text-foreground'"
            @click="rowCount = preset"
          >
            {{ preset }}
          </button>
        </div>
      </div>

      <!-- Navigation tabs -->
      <div class="px-5 pt-2 pb-0 border-b flex gap-4 text-xs font-medium shrink-0 bg-card/30">
        <button
          type="button"
          class="pb-2.5 flex items-center gap-1.5 border-b-2 transition-colors"
          :class="activeTab === 'columns' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="activeTab = 'columns'"
        >
          <Database class="h-3.5 w-3.5" />
          <span>Column Mappings ({{ activeColumns.length }}/{{ columns.length }})</span>
        </button>
        <button
          type="button"
          class="pb-2.5 flex items-center gap-1.5 border-b-2 transition-colors"
          :class="activeTab === 'preview_table' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="activeTab = 'preview_table'"
        >
          <Eye class="h-3.5 w-3.5" />
          <span>Live Data Preview</span>
        </button>
        <button
          type="button"
          class="pb-2.5 flex items-center gap-1.5 border-b-2 transition-colors"
          :class="activeTab === 'preview_sql' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="activeTab = 'preview_sql'"
        >
          <FileCode class="h-3.5 w-3.5" />
          <span>Generated SQL Script</span>
        </button>
      </div>

      <!-- Body Content -->
      <div class="flex-1 overflow-y-auto p-5 min-h-[320px] max-h-[500px]">
        <!-- Loading State -->
        <div v-if="loading" class="h-64 flex flex-col items-center justify-center text-muted-foreground gap-2">
          <Spinner size="md" />
          <p class="text-xs">Inspecting columns and inferring generator types...</p>
        </div>

        <!-- 1. Column Config Tab -->
        <div v-else-if="activeTab === 'columns'" class="space-y-3">
          <div class="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>Configure which columns to include and choose the synthetic pattern.</span>
            <div class="flex gap-2">
              <button
                type="button"
                class="hover:text-foreground"
                @click="columns.forEach(c => c.included = true)"
              >
                Select All
              </button>
              <span>&middot;</span>
              <button
                type="button"
                class="hover:text-foreground"
                @click="columns.forEach(c => c.included = false)"
              >
                Deselect All
              </button>
            </div>
          </div>

          <div class="border rounded-lg overflow-hidden bg-card/40">
            <table class="w-full text-xs text-left">
              <thead class="bg-muted/40 border-b font-medium text-muted-foreground">
                <tr>
                  <th class="py-2 px-3 w-10 text-center">Inc</th>
                  <th class="py-2 px-3">Column Name</th>
                  <th class="py-2 px-3 w-32">Type</th>
                  <th class="py-2 px-3">Mock Data Generator</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border/60">
                <tr
                  v-for="col in columns"
                  :key="col.name"
                  class="hover:bg-muted/20 transition-colors"
                  :class="{ 'opacity-50 bg-muted/10': !col.included }"
                >
                  <td class="py-2 px-3 text-center">
                    <input
                      v-model="col.included"
                      type="checkbox"
                      class="rounded border-border text-primary focus:ring-0 cursor-pointer"
                    >
                  </td>
                  <td class="py-2 px-3">
                    <div class="font-medium font-mono text-foreground flex items-center gap-1.5">
                      <span>{{ col.name }}</span>
                      <span
                        v-if="col.isPrimaryKey"
                        class="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-sans font-semibold"
                      >
                        PK
                      </span>
                      <span
                        v-if="col.isAutoIncrement"
                        class="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400 font-sans"
                      >
                        AUTO
                      </span>
                    </div>
                  </td>
                  <td class="py-2 px-3 text-muted-foreground font-mono">
                    {{ col.dataType }}
                  </td>
                  <td class="py-2 px-3">
                    <select
                      v-model="col.generator"
                      :disabled="!col.included"
                      class="h-7 w-full max-w-[220px] rounded border border-border/80 bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer disabled:cursor-not-allowed"
                    >
                      <option
                        v-for="opt in generatorOptions"
                        :key="opt.value"
                        :value="opt.value"
                      >
                        {{ opt.label }}
                      </option>
                    </select>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 2. Live Data Preview Tab -->
        <div v-else-if="activeTab === 'preview_table'" class="space-y-3">
          <p class="text-xs text-muted-foreground">
            Preview of first 5 synthetic records that will be generated:
          </p>

          <div class="border rounded-lg overflow-x-auto bg-card/40">
            <table class="w-full text-xs text-left">
              <thead class="bg-muted/40 border-b font-medium text-muted-foreground">
                <tr>
                  <th class="py-2 px-3 w-8">#</th>
                  <th
                    v-for="col in activeColumns"
                    :key="col.name"
                    class="py-2 px-3 font-mono font-medium"
                  >
                    {{ col.name }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border/60">
                <tr
                  v-for="(row, idx) in generatedRows.slice(0, 5)"
                  :key="idx"
                  class="hover:bg-muted/20 font-mono text-[11px]"
                >
                  <td class="py-2 px-3 text-muted-foreground">{{ idx + 1 }}</td>
                  <td
                    v-for="col in activeColumns"
                    :key="col.name"
                    class="py-2 px-3 truncate max-w-[200px]"
                    :class="row[col.name] === null ? 'text-muted-foreground/60 italic' : 'text-foreground'"
                  >
                    {{ row[col.name] === null ? 'NULL' : String(row[col.name]) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 3. Preview SQL Tab -->
        <div v-else class="space-y-2">
          <div class="flex items-center justify-between text-xs text-muted-foreground">
            <span>Formatted SQL Batch Query ({{ generatedRows.length }} rows):</span>
            <button
              type="button"
              class="inline-flex items-center gap-1 hover:text-foreground text-xs"
              @click="copySql"
            >
              <Check v-if="copied" class="h-3 w-3 text-emerald-500" />
              <Copy v-else class="h-3 w-3" />
              <span>{{ copied ? 'Copied' : 'Copy SQL' }}</span>
            </button>
          </div>
          <pre class="bg-background text-foreground font-mono text-xs p-3.5 rounded-lg border overflow-x-auto max-h-[380px] select-all leading-relaxed">{{ generatedSql }}</pre>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="px-5 py-3 border-t bg-muted/20 flex items-center justify-between shrink-0">
        <span class="text-xs text-muted-foreground">
          Ready to seed <strong class="text-foreground">{{ rowCount }}</strong> records into <code class="text-xs font-mono">{{ tableName }}</code>
        </span>

        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            @click="emit('update:open', false)"
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="gap-1.5"
            @click="openInEditor"
          >
            <FileCode class="h-3.5 w-3.5" />
            <span>Open in SQL Tab</span>
          </Button>
          <Button
            size="sm"
            class="gap-1.5 bg-primary text-primary-foreground hover:opacity-90"
            :disabled="executing || loading || activeColumns.length === 0"
            @click="insertDirectly"
          >
            <Spinner v-if="executing" size="sm" class="h-3.5 w-3.5" />
            <Play v-else class="h-3.5 w-3.5" />
            <span>Insert Directly</span>
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
