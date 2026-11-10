<script setup lang="ts">
import type { ColumnInfo } from '@/types/connection'
import { invoke } from '@tauri-apps/api/core'
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  Eye,
  FileCode,
  Layers,
  Play,
  RefreshCw,
  Sparkles,
  Wand2,
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

type AiStep = 'idle' | 'analyzing' | 'prompting' | 'parsing' | 'done' | 'error'

const loading = ref(false)
const executing = ref(false)
const rowCount = ref<number>(25)
const activeTab = ref<'columns' | 'preview_table' | 'preview_sql'>('columns')
const generatorMode = ref<'ai' | 'rule'>('ai')
const columns = ref<ColumnConfig[]>([])
const copied = ref(false)
const openDropdownCol = ref<string | null>(null)
const openModelDropdown = ref(false)

// AI State
const isGeneratingAi = ref(false)
const aiStep = ref<AiStep>('idle')
const aiError = ref<string | null>(null)
const rawAiContent = ref<string>('')
const showRawAiResponse = ref(false)
const aiRows = ref<Record<string, string | number | boolean | null>[] | null>(null)
const activeModelLabel = ref<string>('')

// Model Picker State
const modelGroups = ref<Array<{ id: string, label: string, models: Array<{ id: string, label: string, providerConfigId: string }> }>>([])
const selectedModelId = ref<string | undefined>(undefined)

const selectedModelLabel = computed(() => {
  const allModels = modelGroups.value.flatMap(g => g.models)
  const active = allModels.find(m => m.id === selectedModelId.value)
  return active?.label || activeModelLabel.value || 'Select Model'
})

async function syncModels() {
  try {
    const { useAppStore } = await import('@/store/appStore')
    const appStore = useAppStore()
    const providers = appStore.llmSettings.providers || []
    modelGroups.value = providers
      .filter(provider => provider.enabled && (provider.models ?? []).length > 0)
      .map(provider => ({
        id: provider.id,
        label: provider.name,
        models: (provider.models ?? []).map(modelId => ({
          id: `${provider.id}::${modelId}`,
          label: modelId,
          providerConfigId: provider.id,
        })),
      }))

    const current = appStore.llmSettings.models.dataStudio?.selectedModelId
      || appStore.llmSettings.models.sidebarAssistant?.selectedModelId
    selectedModelId.value = current || undefined
  }
  catch (err) {
    console.error('Failed to sync models:', err)
  }
}

async function onModelChange(modelId: string) {
  selectedModelId.value = modelId
  try {
    const { useAppStore } = await import('@/store/appStore')
    const appStore = useAppStore()
    await appStore.setFeatureModelRoute('dataStudio', {
      selectedModelId: modelId,
      useRecommendedModel: false,
    })
    toast.success(`Selected model updated`)
  }
  catch (err) {
    console.error('Failed to set model route:', err)
  }
}

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
  if (name.includes('name') || name.includes('user') || name.includes('author') || name.includes('customer') || name.includes('peminjam') || name.includes('pengarang') || name.includes('member'))
    return 'full_name'
  if (name.includes('phone') || name.includes('mobile') || name.includes('tel') || name.includes('hp'))
    return 'phone'
  if (name.includes('status') || name.includes('state') || name.includes('role'))
    return 'status'
  if (name.includes('price') || name.includes('amount') || name.includes('total') || name.includes('cost') || name.includes('balance') || name.includes('salary') || name.includes('harga') || name.includes('tarif'))
    return 'price'
  if (name.includes('created') || name.includes('updated') || name.includes('timestamp') || type.includes('timestamp') || type.includes('datetime'))
    return 'timestamp'
  if (name.includes('date') || type.includes('date') || name.includes('tanggal') || name.includes('tgl'))
    return 'date'
  if (name.startsWith('is_') || name.startsWith('has_') || name === 'active' || name === 'enabled' || type.includes('bool'))
    return 'boolean'
  if (name.includes('city') || name.includes('town') || name.includes('kota'))
    return 'city'
  if (name.includes('country') || name.includes('nation') || name.includes('negara'))
    return 'country'
  if (name.includes('desc') || name.includes('bio') || name.includes('comment') || name.includes('note') || name.includes('content') || name.includes('body') || name.includes('keterangan') || name.includes('judul'))
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
    aiError.value = null
    aiStep.value = 'idle'
    rawAiContent.value = ''
    showRawAiResponse.value = false
    generatorMode.value = 'ai'
    activeTab.value = 'columns'
    loadTableColumns()
    syncModels()
  }
})

// Rule-based mock data generator pools
const FIRST_NAMES = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Sam', 'Chris', 'Elena', 'Lucas', 'Maya', 'Liam', 'Budi', 'Siti', 'Rian', 'Dewi', 'Andi', 'Putri']
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Santoso', 'Pratama', 'Kusuma', 'Wijaya', 'Siregar', 'Hidayat', 'Saputra']
const DOMAINS = ['example.com', 'testcorp.io', 'hyperdb.org', 'devstack.net', 'cloudpulse.app', 'dbolt.io']
const STATUSES = ['active', 'pending', 'completed', 'inactive', 'dipinjam', 'dikembalikan']
const CITIES = ['Jakarta', 'Bandung', 'Surabaya', 'Yogyakarta', 'San Francisco', 'Tokyo', 'London', 'Singapore']
const COUNTRIES = ['Indonesia', 'United States', 'Japan', 'Germany', 'Singapore', 'Australia']
const DESCRIPTIONS = [
  'Buku referensi sains populer dan teknologi modern.',
  'Dokumentasi teknis untuk arsitektur basis data relasional.',
  'Catatan audit berkala untuk evaluasi performa.',
  'Data peminjaman inventaris dengan verifikasi identitas.',
  'Transaksi sukses diproses via sistem.',
]

function generateRuleValue(generator: GeneratorType, index: number): string | number | boolean | null {
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
      return `+62-81${Math.floor(Math.random() * 89 + 10)}-${String(Math.floor(Math.random() * 9000 + 1000))}`
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
      return Number((Math.random() * 250000 + 15000).toFixed(0))
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

const generatedRuleRows = computed(() => {
  const count = Math.min(Math.max(1, rowCount.value), 1000)
  const cols = activeColumns.value
  const rows: Record<string, string | number | boolean | null>[] = []

  for (let i = 0; i < count; i++) {
    const row: Record<string, string | number | boolean | null> = {}
    for (const c of cols) {
      row[c.name] = generateRuleValue(c.generator, i)
    }
    rows.push(row)
  }
  return rows
})

const finalRows = computed(() => {
  if (generatorMode.value === 'ai' && aiRows.value && aiRows.value.length > 0) {
    return aiRows.value.slice(0, rowCount.value)
  }
  return generatedRuleRows.value
})

/**
 * Resilient JSON extractor capable of stripping reasoning tags (<think>),
 * extracting markdown fences, finding matching bracket boundaries,
 * and handling wrapper objects ({ data: [...] }).
 */
function extractJsonArray(rawText: string): Record<string, unknown>[] {
  let cleaned = rawText.trim()

  // 1. Strip reasoning / thinking tags (<think>...</think>)
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()

  // 2. Direct JSON parse
  try {
    const direct = JSON.parse(cleaned)
    if (Array.isArray(direct))
      return direct
    if (direct && typeof direct === 'object') {
      for (const key of ['data', 'rows', 'records', 'items', 'result', 'table']) {
        if (Array.isArray(direct[key]))
          return direct[key]
      }
    }
  }
  catch {
    // Continue extraction attempts
  }

  // 3. Extract inside markdown code block
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      const codeBlockJson = JSON.parse(codeBlockMatch[1].trim())
      if (Array.isArray(codeBlockJson))
        return codeBlockJson
      if (codeBlockJson && typeof codeBlockJson === 'object') {
        for (const key of ['data', 'rows', 'records', 'items', 'result', 'table']) {
          if (Array.isArray(codeBlockJson[key]))
            return codeBlockJson[key]
        }
      }
    }
    catch {
      // Continue searching
    }
  }

  // 4. Bracket-level array boundary search
  const startIdx = cleaned.indexOf('[')
  const endIdx = cleaned.lastIndexOf(']')
  if (startIdx !== -1 && endIdx > startIdx) {
    let candidate = cleaned.slice(startIdx, endIdx + 1).trim()
    candidate = candidate.replace(/,\s*([}\]])/g, '$1')
    try {
      const parsed = JSON.parse(candidate)
      if (Array.isArray(parsed))
        return parsed
    }
    catch {
      // Continue searching
    }
  }

  // 5. Object wrapper search: { ... }
  const objStart = cleaned.indexOf('{')
  const objEnd = cleaned.lastIndexOf('}')
  if (objStart !== -1 && objEnd > objStart) {
    let objCandidate = cleaned.slice(objStart, objEnd + 1).trim()
    objCandidate = objCandidate.replace(/,\s*([}\]])/g, '$1')
    try {
      const parsedObj = JSON.parse(objCandidate)
      if (parsedObj && typeof parsedObj === 'object') {
        for (const key of Object.keys(parsedObj)) {
          if (Array.isArray(parsedObj[key]))
            return parsedObj[key]
        }
      }
    }
    catch {
      // Failed
    }
  }

  throw new Error('AI output did not contain a valid JSON array of records. Please check the raw response.')
}

async function generateWithAi() {
  if (activeColumns.value.length === 0) {
    toast.error('Please select at least one column to generate')
    return
  }

  isGeneratingAi.value = true
  aiError.value = null
  aiStep.value = 'analyzing'
  rawAiContent.value = ''
  showRawAiResponse.value = false

  try {
    const { useAppStore } = await import('@/store/appStore')
    const appStore = useAppStore()

    let modelConfig
    try {
      modelConfig = await appStore.getFeatureModelConfig('dataStudio')
    }
    catch {
      modelConfig = await appStore.getFeatureModelConfig('sidebarAssistant')
    }

    const { provider, model } = modelConfig
    activeModelLabel.value = model.label || provider.name

    const colsMetadata = activeColumns.value.map(c => ({
      name: c.name,
      dataType: c.dataType,
      nullable: c.nullable,
    }))

    const count = Math.min(Math.max(1, rowCount.value), 100)
    const tableId = props.schema ? `${props.schema}.${props.tableName}` : props.tableName

    aiStep.value = 'prompting'

    const sampleFormat = colsMetadata.map(c => `"${c.name}": ...`).join(', ')
    const promptUser = `Database Table: "${tableId}"
Target Rows to Generate: ${count}

Columns to populate:
${colsMetadata.map(c => `- ${c.name} (${c.dataType}${c.nullable ? ', nullable' : ''})`).join('\n')}

Instructions:
Infer the realistic business domain, semantic purpose, and coherent relationships entirely from the table name "${tableId}" and its column names. Generate realistic, high-quality real-world data matching these columns.

OUTPUT FORMAT SPECIFICATION:
Return ONLY a valid JSON array of ${count} objects matching the column names.
Example structure:
[
  { ${sampleFormat} }
]
Strictly NO markdown explanations, NO greeting, NO prose before or after the JSON.`

    const responseRaw = await invoke<string>('run_agent_step', {
      requestId: `mock-${Date.now()}`,
      provider: provider.apiCompatibility || provider.kind || 'openai-compatible',
      model: model.label,
      messages: [
        {
          role: 'system',
          content: 'You are a professional database synthetic data engine. Output strictly a JSON array of records matching the schema. No markdown greetings or commentary.',
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

    aiStep.value = 'parsing'

    const parsedResponse = typeof responseRaw === 'string' ? JSON.parse(responseRaw) : responseRaw
    const rawContent = (parsedResponse.content || '').trim()
    rawAiContent.value = rawContent

    if (!rawContent) {
      throw new Error('AI returned an empty response. Verify model API connectivity.')
    }

    const jsonRows = extractJsonArray(rawContent)

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
          cleanRow[col.name] = generateRuleValue(col.generator, idx)
        }
      }
      return cleanRow
    })

    aiStep.value = 'done'
    activeTab.value = 'preview_table'
    toast.success(`Successfully generated ${aiRows.value.length} realistic records with AI!`)
  }
  catch (err) {
    console.error('Failed to generate mock data with AI:', err)
    aiStep.value = 'error'
    const msg = err instanceof Error ? err.message : String(err)
    aiError.value = msg
    toast.error(`AI generation error: ${msg}`)
  }
  finally {
    isGeneratingAi.value = false
  }
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

  const modeLabel = generatorMode.value === 'ai' && aiRows.value ? 'AI Synthesized' : 'Rule-Based Pattern'
  return `-- DBolt Smart Mock Data Generator (${finalRows.value.length} rows - ${modeLabel})\nINSERT INTO ${targetTable} (${escapedCols})\nVALUES\n${valueRows.join(',\n')};`
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
    <DialogContent class="p-0 border rounded-xl bg-background flex flex-col gap-0 max-h-[92vh] max-w-4xl shadow-2xl overflow-hidden">
      <!-- Modal Header -->
      <div class="px-5 py-3 border-b bg-muted/20 flex shrink-0 items-center justify-between">
        <DialogTitle class="text-sm text-foreground font-semibold flex gap-2 items-center">
          <Wand2 class="text-primary h-4 w-4" />
          <span>Mock Data Generator</span>
          <span class="text-xs text-muted-foreground font-mono font-normal px-2 py-0.5 border rounded bg-muted/60">
            {{ database ? (schema ? `${database}.${schema}.${tableName}` : `${database}.${tableName}`) : (schema ? `${schema}.${tableName}` : tableName) }}
          </span>
        </DialogTitle>

        <!-- Right Header: Mode Switcher & Row Count -->
        <div class="mr-6 flex gap-3 items-center">
          <!-- Mode Switcher -->
          <div class="p-0.5 border rounded-lg bg-muted/50 flex items-center">
            <button
              type="button"
              class="text-xs font-medium px-2.5 py-1 rounded-md transition-all flex gap-1.5 items-center"
              :class="generatorMode === 'ai' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
              @click="generatorMode = 'ai'"
            >
              <Sparkles class="text-primary h-3 w-3" />
              <span>AI Synthesizer</span>
            </button>
            <button
              type="button"
              class="text-xs font-medium px-2.5 py-1 rounded-md transition-all flex gap-1.5 items-center"
              :class="generatorMode === 'rule' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
              @click="generatorMode = 'rule'"
            >
              <Layers class="h-3 w-3" />
              <span>Rule-Based</span>
            </button>
          </div>

          <!-- Row Count Presets -->
          <div class="flex gap-1.5 items-center">
            <span class="text-xs text-muted-foreground mr-0.5">Rows:</span>
            <button
              v-for="preset in [10, 25, 50, 100]"
              :key="preset"
              type="button"
              class="text-xs font-medium px-2 py-0.5 rounded transition-colors"
              :class="rowCount === preset ? 'bg-primary text-primary-foreground' : 'bg-muted/70 text-muted-foreground hover:text-foreground'"
              @click="rowCount = preset"
            >
              {{ preset }}
            </button>
          </div>
        </div>
      </div>

      <!-- Navigation Tabs Bar (Sejajar di atas) -->
      <div class="text-xs font-medium px-5 pt-3 pb-0 border-b bg-card/20 flex shrink-0 gap-6">
        <button
          type="button"
          class="pb-2.5 border-b-2 flex gap-1.5 transition-colors items-center"
          :class="activeTab === 'columns' ? 'border-primary text-primary font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="activeTab = 'columns'"
        >
          <Database class="h-3.5 w-3.5" />
          <span>Column Mappings ({{ activeColumns.length }}/{{ columns.length }})</span>
        </button>

        <button
          type="button"
          class="pb-2.5 border-b-2 flex gap-1.5 transition-colors items-center"
          :class="activeTab === 'preview_table' ? 'border-primary text-primary font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="activeTab = 'preview_table'"
        >
          <Eye class="h-3.5 w-3.5" />
          <span>Live Data Preview</span>
          <span
            v-if="generatorMode === 'ai' && aiRows"
            class="text-[10px] text-primary font-medium font-sans px-1.5 py-0.2 rounded bg-primary/15"
          >
            AI Active ({{ aiRows.length }})
          </span>
        </button>

        <button
          type="button"
          class="pb-2.5 border-b-2 flex gap-1.5 transition-colors items-center"
          :class="activeTab === 'preview_sql' ? 'border-primary text-primary font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="activeTab = 'preview_sql'"
        >
          <FileCode class="h-3.5 w-3.5" />
          <span>Generated SQL Script</span>
        </button>
      </div>

      <!-- Body Content Area -->
      <div class="p-5 flex-1 max-h-[480px] min-h-[320px] overflow-y-auto">
        <!-- Loading State -->
        <div v-if="loading" class="text-muted-foreground flex flex-col gap-2 h-64 items-center justify-center">
          <Spinner size="md" />
          <p class="text-xs">
            Inspecting columns and schema constraints...
          </p>
        </div>

        <!-- 1. TAB: Column Mappings -->
        <div v-else-if="activeTab === 'columns'" class="space-y-3">
          <div class="text-xs text-muted-foreground px-1 flex items-center justify-between">
            <span>
              {{ generatorMode === 'ai' ? 'Columns included in AI prompt context.' : 'Choose rule-based synthetic generator for each column.' }}
            </span>
            <div class="flex gap-2">
              <button
                type="button"
                class="hover:text-foreground text-primary/80 transition-colors"
                @click="columns.forEach(c => c.included = true)"
              >
                Select All
              </button>
              <span>&middot;</span>
              <button
                type="button"
                class="hover:text-foreground text-muted-foreground transition-colors"
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
                    {{ generatorMode === 'ai' ? 'AI Inference Role' : 'Rule-Based Pattern' }}
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
                  <td class="px-3 py-1.5">
                    <!-- In AI mode: show semantic inferred badge -->
                    <div v-if="generatorMode === 'ai'" class="flex items-center">
                      <span class="text-[11px] text-muted-foreground font-mono px-2 py-0.5 border border-border/60 rounded bg-muted/30">
                        Synthesized by AI ({{ col.generator }})
                      </span>
                    </div>

                    <!-- In Rule mode: show custom popup selector -->
                    <div v-else class="relative max-w-[220px]">
                      <button
                        type="button"
                        :disabled="!col.included"
                        class="h-7 w-full flex items-center justify-between text-xs px-2.5 rounded-md border border-border/80 bg-background text-foreground transition-colors hover:border-border disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-primary"
                        @click="openDropdownCol = openDropdownCol === col.name ? null : col.name"
                      >
                        <span class="truncate font-mono">{{ generatorOptions.find(o => o.value === col.generator)?.label || col.generator }}</span>
                        <ChevronDown class="h-3 w-3 text-muted-foreground shrink-0 ml-1" />
                      </button>

                      <div
                        v-if="openDropdownCol === col.name"
                        class="fixed z-[100] mt-1 max-h-56 w-56 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-xl"
                      >
                        <button
                          v-for="opt in generatorOptions"
                          :key="opt.value"
                          type="button"
                          class="w-full text-left px-2.5 py-1.5 text-xs rounded-md hover:bg-accent hover:text-accent-foreground flex items-center justify-between transition-colors"
                          :class="{ 'bg-accent/80 font-medium text-accent-foreground': col.generator === opt.value }"
                          @click="col.generator = opt.value; openDropdownCol = null"
                        >
                          <span>{{ opt.label }}</span>
                          <Check v-if="col.generator === opt.value" class="h-3.5 w-3.5 text-primary" />
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 2. TAB: Live Data Preview -->
        <div v-else-if="activeTab === 'preview_table'" class="space-y-3">
          <!-- AI Progress Indicator -->
          <div v-if="isGeneratingAi" class="p-6 border border-primary/20 rounded-lg bg-primary/5 flex flex-col gap-2 items-center justify-center min-h-[160px]">
            <Spinner size="md" class="text-primary" />
            <div class="text-xs text-primary font-medium flex gap-2 items-center mt-2">
              <span v-if="aiStep === 'analyzing'">Inspecting table schema & column constraints...</span>
              <span v-else-if="aiStep === 'prompting'">Prompting AI model to synthesize {{ rowCount }} records...</span>
              <span v-else-if="aiStep === 'parsing'">Validating, parsing & shaping JSON records...</span>
              <span v-else>Processing mock data...</span>
            </div>
            <span class="text-[11px] text-muted-foreground font-mono">Current phase: {{ aiStep }}</span>
          </div>

          <!-- AI Error Box -->
          <div v-else-if="aiError && generatorMode === 'ai'" class="p-3 border border-destructive/30 rounded-lg bg-destructive/10 text-xs space-y-2">
            <div class="text-destructive font-medium flex items-center justify-between">
              <div class="flex gap-2 items-center">
                <AlertCircle class="h-4 w-4 shrink-0" />
                <span>AI Generation Error: {{ aiError }}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                class="text-xs h-6 px-2"
                @click="generateWithAi"
              >
                <RefreshCw class="mr-1 h-3 w-3" />
                Retry
              </Button>
            </div>

            <!-- Raw AI Output Inspector -->
            <div v-if="rawAiContent" class="pt-1">
              <button
                type="button"
                class="text-[11px] text-muted-foreground flex gap-1 items-center hover:text-foreground"
                @click="showRawAiResponse = !showRawAiResponse"
              >
                <span>{{ showRawAiResponse ? 'Hide Raw AI Output' : 'View Raw AI Output' }}</span>
                <ChevronUp v-if="showRawAiResponse" class="h-3 w-3" />
                <ChevronDown v-else class="h-3 w-3" />
              </button>
              <pre
                v-if="showRawAiResponse"
                class="text-[10px] text-muted-foreground font-mono mt-1.5 p-2 rounded bg-background border max-h-32 overflow-auto whitespace-pre-wrap select-all"
              >{{ rawAiContent }}</pre>
            </div>
          </div>

          <!-- Table Content -->
          <div v-else class="space-y-3">
            <div class="text-xs text-muted-foreground flex items-center justify-between">
              <p>
                Preview of first {{ Math.min(finalRows.length, 5) }} synthetic records:
              </p>
              <span
                v-if="generatorMode === 'ai' && aiRows"
                class="text-[11px] text-primary font-medium px-2 py-0.5 border border-primary/20 rounded bg-primary/10 flex gap-1 items-center"
              >
                <Sparkles class="h-3 w-3" />
                AI Synthesized ({{ aiRows.length }} rows)
              </span>
              <span
                v-else-if="generatorMode === 'ai'"
                class="text-[11px] text-muted-foreground font-medium px-2 py-0.5 rounded bg-muted/60"
              >
                Click 'Generate Now' below to synthesize with AI
              </span>
              <span
                v-else
                class="text-[11px] text-muted-foreground font-medium px-2 py-0.5 rounded bg-muted/60"
              >
                Rule-Based Mock
              </span>
            </div>

            <!-- AI Not Yet Generated Placeholder -->
            <div
              v-if="generatorMode === 'ai' && !aiRows"
              class="p-8 border border-dashed rounded-lg bg-card/20 flex flex-col gap-2 items-center justify-center text-center"
            >
              <Sparkles class="h-6 w-6 text-primary/70" />
              <p class="text-xs text-foreground font-medium">Ready to synthesize realistic data</p>
              <p class="text-xs text-muted-foreground max-w-sm">
                Select your preferred model below, then click <strong>Generate Now</strong> to populate records using AI semantics.
              </p>
            </div>

            <!-- Preview Data Grid -->
            <div v-else class="border rounded-lg bg-card/40 overflow-x-auto">
              <table class="text-xs text-left w-full">
                <thead class="text-muted-foreground font-medium border-b bg-muted/40 sticky top-0 z-10">
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
        </div>

        <!-- 3. TAB: Generated SQL Script -->
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
          <pre class="text-xs text-foreground leading-relaxed font-mono p-3.5 border rounded-lg bg-background max-h-[380px] select-all overflow-auto">{{ generatedSql }}</pre>
        </div>
      </div>

      <!-- BOTTOM ACTION BAR / FOOTER (Dinamis Sesuai Mode) -->
      <div class="px-5 py-3 border-t bg-muted/20 flex shrink-0 items-center justify-between gap-4">
        <!-- ── FOOTER KIRI: Model Picker (Khusus AI Synthesizer) ── -->
        <div v-if="generatorMode === 'ai'" class="flex items-center gap-2">
          <span class="text-xs text-muted-foreground flex items-center gap-1 font-medium">
            <Sparkles class="h-3.5 w-3.5 text-primary" />
            <span>Model:</span>
          </span>

          <!-- Custom Themed Model Dropdown -->
          <div class="relative">
            <button
              type="button"
              class="h-8 rounded-md px-2.5 text-xs border border-border/80 bg-background text-foreground hover:bg-muted/40 inline-flex items-center gap-1.5 focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
              @click="openModelDropdown = !openModelDropdown"
            >
              <span class="truncate max-w-[150px] font-mono font-medium">{{ selectedModelLabel }}</span>
              <ChevronDown class="h-3 w-3 text-muted-foreground ml-0.5 shrink-0" />
            </button>

            <div
              v-if="openModelDropdown"
              class="fixed z-[100] mt-1 max-h-60 w-64 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-2xl"
            >
              <div v-for="group in modelGroups" :key="group.id" class="p-1">
                <div class="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {{ group.label }}
                </div>
                <button
                  v-for="m in group.models"
                  :key="m.id"
                  type="button"
                  class="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent hover:text-accent-foreground flex items-center justify-between transition-colors"
                  :class="{ 'bg-accent/80 font-medium text-accent-foreground': selectedModelId === m.id }"
                  @click="onModelChange(m.id); openModelDropdown = false"
                >
                  <span class="truncate">{{ m.label }}</span>
                  <Check v-if="selectedModelId === m.id" class="h-3.5 w-3.5 text-primary shrink-0" />
                </button>
              </div>
              <div v-if="modelGroups.length === 0" class="p-2 text-xs text-muted-foreground text-center">
                No AI models configured
              </div>
            </div>
          </div>
        </div>

        <!-- ── FOOTER KIRI: Info Status (Khusus Rule-Based) ── -->
        <div v-else class="text-xs text-muted-foreground flex gap-1.5 items-center">
          <span>Ready to seed <strong class="text-foreground">{{ finalRows.length }}</strong> rows into <code class="text-xs font-mono">{{ tableName }}</code></span>
        </div>

        <!-- ── FOOTER KANAN: Action Buttons (Dinamis) ── -->
        <!-- Skenario 1: Mode AI Synthesizer (Sebelum Generate Data) -->
        <div v-if="generatorMode === 'ai' && !aiRows" class="flex items-center gap-2">
          <Button
            size="sm"
            class="text-xs font-medium px-4 gap-1.5 h-8 bg-primary text-primary-foreground hover:opacity-90 shadow-sm"
            :disabled="isGeneratingAi || loading || activeColumns.length === 0"
            @click="generateWithAi"
          >
            <Spinner v-if="isGeneratingAi" size="sm" class="h-3.5 w-3.5" />
            <Sparkles v-else class="h-3.5 w-3.5" />
            <span>{{ isGeneratingAi ? 'Synthesizing...' : 'Generate Now' }}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            class="h-8 text-xs"
            @click="emit('update:open', false)"
          >
            Cancel
          </Button>
        </div>

        <!-- Skenario 2: Mode AI Synthesizer (Setelah Data AI Berhasil di-generate) -->
        <div v-else-if="generatorMode === 'ai' && aiRows" class="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            class="h-8 text-xs gap-1.5"
            :disabled="isGeneratingAi"
            @click="generateWithAi"
          >
            <RefreshCw class="h-3 w-3" />
            <span>Regenerate with AI</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            class="h-8 text-xs gap-1.5"
            @click="openInEditor"
          >
            <FileCode class="h-3.5 w-3.5" />
            <span>Open in SQL Tab</span>
          </Button>

          <Button
            size="sm"
            class="h-8 text-xs bg-primary text-primary-foreground gap-1.5 hover:opacity-90 shadow-sm"
            :disabled="executing || loading || activeColumns.length === 0"
            @click="insertDirectly"
          >
            <Spinner v-if="executing" size="sm" class="h-3.5 w-3.5" />
            <Play v-else class="h-3.5 w-3.5" />
            <span>Insert Directly</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            class="h-8 text-xs"
            @click="emit('update:open', false)"
          >
            Cancel
          </Button>
        </div>

        <!-- Skenario 3: Mode Rule-Based Pattern -->
        <div v-else class="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            class="h-8 text-xs gap-1.5"
            @click="openInEditor"
          >
            <FileCode class="h-3.5 w-3.5" />
            <span>Open in SQL Tab</span>
          </Button>

          <Button
            size="sm"
            class="h-8 text-xs bg-primary text-primary-foreground gap-1.5 hover:opacity-90 shadow-sm"
            :disabled="executing || loading || activeColumns.length === 0"
            @click="insertDirectly"
          >
            <Spinner v-if="executing" size="sm" class="h-3.5 w-3.5" />
            <Play v-else class="h-3.5 w-3.5" />
            <span>Insert Directly</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            class="h-8 text-xs"
            @click="emit('update:open', false)"
          >
            Cancel
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
