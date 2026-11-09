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

type GeneratorType
  = 'auto_increment'
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

type ColumnConfig = {
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
const isGeneratingAi = ref(false)
const aiPromptDirective = ref('')
const aiRows = ref<Record<string, string | number | boolean | null>[] | null>(null)
const activeModelLabel = ref<string>('')

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
    aiRows.value = null
    aiPromptDirective.value = ''
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
  function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]
  }

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

const finalRows = computed(() => {
  if (aiRows.value && aiRows.value.length > 0) {
    return aiRows.value.slice(0, rowCount.value)
  }
  return generatedRows.value
})

async function generateWithAi() {
  if (activeColumns.value.length === 0) {
    toast.error('Please select at least one column to generate')
    return
  }

  isGeneratingAi.value = true
  try {
    const { useAppStore } = await import('@/store/appStore')
    const appStore = useAppStore()
    const { provider, model } = await appStore.getFeatureModelConfig('dataStudio')
    activeModelLabel.value = model.label

    const colsMetadata = activeColumns.value.map(c => ({
      name: c.name,
      dataType: c.dataType,
      nullable: c.nullable,
    }))

    const count = Math.min(Math.max(1, rowCount.value), 100)
    const tableId = props.schema ? `${props.schema}.${props.tableName}` : props.tableName

    const promptUser = `Table: "${tableId}"
Target Rows: ${count}
Columns:
${colsMetadata.map(c => `- ${c.name} (${c.dataType}${c.nullable ? ', nullable' : ''})`).join('\n')}
${aiPromptDirective.value.trim() ? `User directive/domain context: ${aiPromptDirective.value.trim()}` : `Please infer the realistic domain and purpose from the table name ("${tableId}") and column names. Make the generated data completely realistic, coherent, and semantically meaningful.`}

Instruction:
Return ONLY a valid JSON array containing exactly ${count} objects matching the column names.
No markdown block, no explanation, no other text.`

    const responseRaw = await invoke<string>('run_agent_step', {
      requestId: `mock-${Date.now()}`,
      provider: provider.apiCompatibility || provider.kind || 'openai-compatible',
      model: model.label,
      messages: [
        {
          role: 'system',
          content: 'You are a database mock data generator. You generate realistic domain-specific synthetic data matching column names and semantic context. You output STRICTLY a JSON array of objects. Never output markdown code fences, comments, or explanations.',
        },
        {
          role: 'user',
          content: promptUser,
        },
      ],
      tools: [],
      httpProxy: provider.proxy || null,
      proxyMode: provider.proxyMode || 'system',
      apiKey: provider.apiKey || '',
      baseUrl: provider.baseUrl || null,
    })

    const parsedResponse = typeof responseRaw === 'string' ? JSON.parse(responseRaw) : responseRaw
    let text = (parsedResponse.content || '').trim()
    if (text.startsWith('```json'))
      text = text.slice(7)
    else if (text.startsWith('```'))
      text = text.slice(3)
    if (text.endsWith('```'))
      text = text.slice(0, -3)
    text = text.trim()

    const jsonRows = JSON.parse(text)
    if (!Array.isArray(jsonRows) || jsonRows.length === 0) {
      throw new Error('AI response did not return a valid JSON array')
    }

    aiRows.value = jsonRows.map((row: Record<string, unknown>, idx: number) => {
      const cleanRow: Record<string, string | number | boolean | null> = {}
      for (const col of activeColumns.value) {
        if (col.isAutoIncrement) {
          cleanRow[col.name] = idx + 1
        }
        else if (row[col.name] !== undefined) {
          cleanRow[col.name] = row[col.name] as never
        }
        else {
          cleanRow[col.name] = generateValue(col.generator, idx)
        }
      }
      return cleanRow
    })

    activeTab.value = 'preview_table'
    toast.success(`Successfully generated ${aiRows.value.length} realistic rows with AI!`)
  }
  catch (err) {
    console.error('Failed to generate mock data with AI:', err)
    const msg = err instanceof Error ? err.message : String(err)
    toast.error(`AI generation error: ${msg}`)
  }
  finally {
    isGeneratingAi.value = false
  }
}

function resetToRuleBased() {
  aiRows.value = null
  toast.info('Switched back to rule-based mock data')
}

const generatedSql = computed(() => {
  const cols = activeColumns.value
  if (cols.length === 0 || finalRows.value.length === 0)
    return '-- Select at least one column to generate INSERT statements.'

  const escapedCols = cols.map(c => `\`${c.name}\``).join(', ')
  const targetTable = props.schema ? `\`${props.schema}\`.\`${props.tableName}\`` : `\`${props.tableName}\``

  const valueRows = finalRows.value.map((row) => {
    const rowVals = cols.map(c => formatSqlLiteral(row[c.name]))
    return `  (${rowVals.join(', ')})`
  })

  return `-- DBolt Smart Mock Data Generator (${finalRows.value.length} rows${aiRows.value ? ' - AI Generated' : ''})\nINSERT INTO ${targetTable} (${escapedCols})\nVALUES\n${valueRows.join(',\n')};`
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
    toast.success(`Successfully inserted ${finalRows.value.length} rows into ${props.tableName}!`)
    emit('seeded', finalRows.value.length)
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
    <DialogContent class="p-0 border rounded-xl bg-background flex flex-col gap-0 max-h-[88vh] max-w-4xl shadow-2xl overflow-hidden">
      <!-- Modal Header -->
      <div class="px-5 py-3 border-b bg-muted/20 flex shrink-0 items-center justify-between">
        <DialogTitle class="text-sm text-foreground font-semibold flex gap-2 items-center">
          <span>Mock Data Generator</span>
          <span class="text-xs text-muted-foreground font-mono font-normal px-2 py-0.5 border rounded bg-muted/60">
            {{ database ? (schema ? `${database}.${schema}.${tableName}` : `${database}.${tableName}`) : (schema ? `${schema}.${tableName}` : tableName) }}
          </span>
        </DialogTitle>

        <!-- Row Count Presets -->
        <div class="mr-6 flex gap-1.5 items-center">
          <span class="text-xs text-muted-foreground mr-1">Rows:</span>
          <button
            v-for="preset in [10, 25, 50, 100, 250]"
            :key="preset"
            type="button"
            class="text-xs font-medium px-2 py-1 rounded transition-colors"
            :class="rowCount === preset ? 'bg-primary text-primary-foreground' : 'bg-muted/70 text-muted-foreground hover:text-foreground'"
            @click="rowCount = preset"
          >
            {{ preset }}
          </button>
        </div>
      </div>

      <!-- AI Directive & Generator Bar -->
      <div class="px-5 py-2.5 border-b bg-card/60 flex flex-wrap gap-2.5 items-center justify-between">
        <div class="flex flex-1 gap-2 min-w-[280px] items-center">
          <span class="text-xs text-foreground font-medium flex shrink-0 gap-1.5 items-center">
            <span class="i-carbon-machine-learning-model text-primary h-3.5 w-3.5" />
            AI Context:
          </span>
          <input
            v-model="aiPromptDirective"
            type="text"
            placeholder="Optional context: e.g. Buku perpustakaan Indonesia, novel best seller..."
            class="text-xs text-foreground px-2.5 py-1 border border-border/70 rounded bg-background flex-1 min-w-0 placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            :disabled="isGeneratingAi"
            @keydown.enter="generateWithAi"
          >
        </div>

        <div class="flex shrink-0 gap-2 items-center">
          <Button
            size="sm"
            class="text-xs font-medium px-3 gap-1.5 h-7"
            :disabled="isGeneratingAi || loading || activeColumns.length === 0"
            @click="generateWithAi"
          >
            <Spinner v-if="isGeneratingAi" size="sm" class="h-3.5 w-3.5" />
            <span v-else class="i-carbon-sparkle h-3.5 w-3.5" />
            <span>{{ isGeneratingAi ? 'Generating AI Mock...' : (aiRows ? 'Regenerate with AI' : 'Generate with AI') }}</span>
          </Button>

          <Button
            v-if="aiRows"
            variant="ghost"
            size="sm"
            class="text-xs text-muted-foreground px-2 h-7 hover:text-foreground"
            title="Reset to rule-based mock data"
            @click="resetToRuleBased"
          >
            Reset
          </Button>
        </div>
      </div>

      <!-- Navigation tabs -->
      <div class="text-xs font-medium px-5 pb-0 pt-2 border-b bg-card/30 flex shrink-0 gap-4">
        <button
          type="button"
          class="pb-2.5 border-b-2 flex gap-1.5 transition-colors items-center"
          :class="activeTab === 'columns' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="activeTab = 'columns'"
        >
          <Database class="h-3.5 w-3.5" />
          <span>Column Mappings ({{ activeColumns.length }}/{{ columns.length }})</span>
        </button>
        <button
          type="button"
          class="pb-2.5 border-b-2 flex gap-1.5 transition-colors items-center"
          :class="activeTab === 'preview_table' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="activeTab = 'preview_table'"
        >
          <Eye class="h-3.5 w-3.5" />
          <span>Live Data Preview</span>
          <span
            v-if="aiRows"
            class="text-[10px] text-primary font-medium font-sans px-1.5 py-0.2 rounded bg-primary/15"
          >
            AI
          </span>
        </button>
        <button
          type="button"
          class="pb-2.5 border-b-2 flex gap-1.5 transition-colors items-center"
          :class="activeTab === 'preview_sql' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="activeTab = 'preview_sql'"
        >
          <FileCode class="h-3.5 w-3.5" />
          <span>Generated SQL Script</span>
        </button>
      </div>

      <!-- Body Content -->
      <div class="p-5 flex-1 max-h-[500px] min-h-[320px] overflow-y-auto">
        <!-- Loading State -->
        <div v-if="loading" class="text-muted-foreground flex flex-col gap-2 h-64 items-center justify-center">
          <Spinner size="md" />
          <p class="text-xs">
            Inspecting columns and inferring generator types...
          </p>
        </div>

        <!-- 1. Column Config Tab -->
        <div v-else-if="activeTab === 'columns'" class="space-y-3">
          <div class="text-xs text-muted-foreground px-1 flex items-center justify-between">
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

          <div class="border rounded-lg bg-card/40 overflow-hidden">
            <table class="text-xs text-left w-full">
              <thead class="text-muted-foreground font-medium border-b bg-muted/40">
                <tr>
                  <th class="px-3 py-2 text-center w-10">
                    Inc
                  </th>
                  <th class="px-3 py-2">
                    Column Name
                  </th>
                  <th class="px-3 py-2 w-32">
                    Type
                  </th>
                  <th class="px-3 py-2">
                    Mock Data Generator
                  </th>
                </tr>
              </thead>
              <tbody class="divide-border/60 divide-y">
                <tr
                  v-for="col in columns"
                  :key="col.name"
                  class="transition-colors hover:bg-muted/20"
                  :class="{ 'opacity-50 bg-muted/10': !col.included }"
                >
                  <td class="px-3 py-2 text-center">
                    <input
                      v-model="col.included"
                      type="checkbox"
                      class="text-primary border-border rounded cursor-pointer focus:ring-0"
                    >
                  </td>
                  <td class="px-3 py-2">
                    <div class="text-foreground font-medium font-mono flex gap-1.5 items-center">
                      <span>{{ col.name }}</span>
                      <span
                        v-if="col.isPrimaryKey"
                        class="text-[10px] text-amber-600 font-sans font-semibold px-1.5 py-0.2 rounded bg-amber-500/15 dark:text-amber-400"
                      >
                        PK
                      </span>
                      <span
                        v-if="col.isAutoIncrement"
                        class="text-[10px] text-blue-600 font-sans px-1.5 py-0.2 rounded bg-blue-500/15 dark:text-blue-400"
                      >
                        AUTO
                      </span>
                    </div>
                  </td>
                  <td class="text-muted-foreground font-mono px-3 py-2">
                    {{ col.dataType }}
                  </td>
                  <td class="px-3 py-2">
                    <select
                      v-model="col.generator"
                      :disabled="!col.included"
                      class="text-xs text-foreground px-2 border border-border/80 rounded bg-background h-7 max-w-[220px] w-full cursor-pointer focus:outline-none disabled:cursor-not-allowed focus:ring-1 focus:ring-primary"
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
          <div class="text-xs text-muted-foreground flex items-center justify-between">
            <p>
              Preview of first {{ Math.min(finalRows.length, 5) }} synthetic records that will be generated:
            </p>
            <span
              v-if="aiRows"
              class="text-[11px] text-primary font-medium px-2 py-0.5 border border-primary/20 rounded bg-primary/10 flex gap-1 items-center"
            >
              <span class="i-carbon-machine-learning-model h-3 w-3" />
              AI Powered ({{ aiRows.length }} rows)
            </span>
            <span
              v-else
              class="text-[11px] text-muted-foreground font-medium px-2 py-0.5 rounded bg-muted/60"
            >
              Rule-based mock
            </span>
          </div>

          <div class="border rounded-lg bg-card/40 overflow-x-auto">
            <table class="text-xs text-left w-full">
              <thead class="text-muted-foreground font-medium border-b bg-muted/40">
                <tr>
                  <th class="px-3 py-2 text-center w-8">
                    #
                  </th>
                  <th
                    v-for="col in activeColumns"
                    :key="col.name"
                    class="font-medium font-mono px-3 py-2"
                  >
                    {{ col.name }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-border/60 divide-y">
                <tr
                  v-for="(row, idx) in finalRows.slice(0, 5)"
                  :key="idx"
                  class="text-[11px] font-mono hover:bg-muted/20"
                >
                  <td class="text-muted-foreground px-3 py-2 text-center">
                    {{ idx + 1 }}
                  </td>
                  <td
                    v-for="col in activeColumns"
                    :key="col.name"
                    class="px-3 py-2 max-w-[200px] truncate"
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
          <div class="text-xs text-muted-foreground flex items-center justify-between">
            <span>Formatted SQL Batch Query ({{ finalRows.length }} rows):</span>
            <button
              type="button"
              class="text-xs inline-flex gap-1 items-center hover:text-foreground"
              @click="copySql"
            >
              <Check v-if="copied" class="text-emerald-500 h-3 w-3" />
              <Copy v-else class="h-3 w-3" />
              <span>{{ copied ? 'Copied' : 'Copy SQL' }}</span>
            </button>
          </div>
          <pre class="text-xs text-foreground leading-relaxed font-mono p-3.5 border rounded-lg bg-background max-h-[380px] select-all overflow-x-auto">{{ generatedSql }}</pre>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="px-5 py-3 border-t bg-muted/20 flex shrink-0 items-center justify-between">
        <span class="text-xs text-muted-foreground flex gap-1.5 items-center">
          Ready to seed <strong class="text-foreground">{{ finalRows.length }}</strong> records into <code class="text-xs font-mono">{{ tableName }}</code>
          <span
            v-if="aiRows"
            class="text-[10px] text-primary font-medium px-1.5 py-0.2 border border-primary/20 rounded bg-primary/10"
          >
            AI
          </span>
        </span>

        <div class="flex gap-2 items-center">
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
            class="text-primary-foreground bg-primary gap-1.5 hover:opacity-90"
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
