<script setup lang="ts">
import type { ColumnInfo } from '@/types/connection'
import { invoke } from '@tauri-apps/api/core'
import {
  AlertCircle,
  Check,
  CheckCircle2,
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
const activeTab = ref<'columns' | 'preview_sql' | 'preview_table'>('columns')
const generatorMode = ref<'ai' | 'rule'>('ai')
const columns = ref<ColumnConfig[]>([])
const copied = ref(false)

// AI State
const isGeneratingAi = ref(false)
const aiStep = ref<AiStep>('idle')
const aiError = ref<string | null>(null)
const rawAiContent = ref<string>('')
const showRawAiResponse = ref(false)
const aiPromptDirective = ref('')
const aiRows = ref<Record<string, string | number | boolean | null>[] | null>(null)
const activeModelLabel = ref<string>('')
const openDropdownCol = ref<string | null>(null)

const scenarioPresets = [
  { label: 'Buku & Pustaka', prompt: 'Katalog buku perpustakaan Indonesia dengan judul realistis, pengarang lokal/internasional, penerbit, tahun terbit 2010-2024, genre fiksi dan sains.' },
  { label: 'E-Commerce / Toko', prompt: 'Data transaksi belanja online, produk retail populer, harga wajar, status pesanan terkirim/selesai, metode pembayaran.' },
  { label: 'Akademik & Mahasiswa', prompt: 'Data civitas akademika, nama mahasiswa Indonesia, NIM/NPM, program studi, IPK 3.00-3.95, semester aktif.' },
  { label: 'Karyawan & HR', prompt: 'Data pegawai kantor, jabatan spesifik, divisi Engineering/Finance/Marketing, tanggal bergabung, status karyawan tetap.' },
  { label: 'Finansial & Invoice', prompt: 'Data transaksi keuangan, nomor invoice unik, nominal transaksi, mata uang IDR/USD, status lunas.' },
]

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
  if (name.includes('name') || name.includes('user') || name.includes('author') || name.includes('customer'))
    return 'full_name'
  if (name.includes('phone') || name.includes('mobile') || name.includes('tel'))
    return 'phone'
  if (name.includes('status') || name.includes('state') || name.includes('role'))
    return 'status'
  if (name.includes('price') || name.includes('amount') || name.includes('total') || name.includes('cost') || name.includes('balance') || name.includes('salary') || name.includes('harga'))
    return 'price'
  if (name.includes('created') || name.includes('updated') || name.includes('timestamp') || type.includes('timestamp') || type.includes('datetime'))
    return 'timestamp'
  if (name.includes('date') || type.includes('date') || name.includes('tanggal'))
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
    aiPromptDirective.value = ''
    generatorMode.value = 'ai'
    activeTab.value = 'columns'
    loadTableColumns()
  }
})

// Rule-based mock data generator pools
const FIRST_NAMES = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Sam', 'Chris', 'Elena', 'Lucas', 'Maya', 'Liam', 'Sophia', 'Ethan', 'Oliver', 'Ava', 'Noah', 'Emma', 'Budi', 'Siti', 'Rian', 'Dewi']
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Santoso', 'Pratama', 'Kusuma', 'Wijaya', 'Siregar', 'Hidayat']
const DOMAINS = ['example.com', 'testcorp.io', 'hyperdb.org', 'devstack.net', 'cloudpulse.app', 'dbolt.io']
const STATUSES = ['active', 'pending', 'completed', 'inactive', 'archived']
const CITIES = ['Jakarta', 'Bandung', 'Surabaya', 'San Francisco', 'Tokyo', 'London', 'Berlin', 'Singapore', 'Sydney']
const COUNTRIES = ['Indonesia', 'United States', 'Japan', 'Germany', 'Singapore', 'Australia', 'United Kingdom']
const DESCRIPTIONS = [
  'Buku referensi sains populer dan teknologi modern.',
  'Dokumentasi teknis untuk arsitektur basis data relasional.',
  'Catatan audit inventaris berkala untuk evaluasi performa.',
  'Rekor pelanggan prioritas tinggi dengan verifikasi identitas.',
  'Transaksi e-commerce sukses diproses via payment gateway.',
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
      return `+62-81${Math.floor(Math.random() * 89 + 10)}-${String(Math.floor(Math.random() * 9000 + 1000))}-${String(Math.floor(Math.random() * 9000 + 1000))}`
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
      // Fallback to sidebar assistant if data studio route is not explicitly set
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
Number of Target Rows: ${count}

Columns:
${colsMetadata.map(c => `- ${c.name} (${c.dataType}${c.nullable ? ', nullable' : ''})`).join('\n')}

Context & Directive:
${aiPromptDirective.value.trim() ? aiPromptDirective.value.trim() : `Infer realistic business domain and semantics from table name "${tableId}" and column names. Generate coherent, high-quality real-world data.`}

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

function applyPreset(presetPrompt: string) {
  aiPromptDirective.value = presetPrompt
}

function resetToRuleBased() {
  generatorMode.value = 'rule'
  aiRows.value = null
  aiError.value = null
  aiStep.value = 'idle'
  toast.info('Switched to Rule-Based mock data mode')
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
    <DialogContent class="p-0 border rounded-xl bg-background flex flex-col gap-0 max-h-[90vh] max-w-4xl shadow-2xl overflow-hidden">
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

      <!-- Dedicated AI Control Banner (When in AI Mode) -->
      <div v-if="generatorMode === 'ai'" class="p-4 border-b bg-card/40 space-y-3">
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <label class="text-xs text-foreground font-medium flex gap-1.5 items-center">
              <Sparkles class="text-primary h-3.5 w-3.5" />
              <span>Domain Directive & Context (Optional)</span>
            </label>
            <span v-if="activeModelLabel" class="text-[11px] text-muted-foreground flex gap-1 items-center">
              <span>Active Model:</span>
              <strong class="text-foreground font-mono">{{ activeModelLabel }}</strong>
            </span>
          </div>

          <div class="flex gap-2 items-center">
            <input
              v-model="aiPromptDirective"
              type="text"
              placeholder="e.g. Katalog buku sastra & teknologi Indonesia, nama pengarang lokal, penerbit Gramedia/Erlangga..."
              class="text-xs text-foreground px-3 py-1.5 border border-border/80 rounded-lg bg-background flex-1 placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              :disabled="isGeneratingAi"
              @keydown.enter="generateWithAi"
            >
            <Button
              size="sm"
              class="text-xs font-medium px-3.5 gap-1.5 h-8 shrink-0"
              :disabled="isGeneratingAi || loading || activeColumns.length === 0"
              @click="generateWithAi"
            >
              <Spinner v-if="isGeneratingAi" size="sm" class="h-3.5 w-3.5" />
              <Sparkles v-else class="h-3.5 w-3.5" />
              <span>{{ isGeneratingAi ? 'Synthesizing...' : (aiRows ? 'Regenerate with AI' : 'Generate with AI') }}</span>
            </Button>
          </div>

          <!-- Quick Scenario Presets -->
          <div class="flex flex-wrap gap-1.5 items-center">
            <span class="text-[11px] text-muted-foreground mr-1">Quick Scenarios:</span>
            <button
              v-for="p in scenarioPresets"
              :key="p.label"
              type="button"
              class="text-[11px] text-muted-foreground px-2 py-0.5 border border-border/50 rounded-md bg-muted/40 transition-colors hover:bg-muted hover:text-foreground"
              :disabled="isGeneratingAi"
              @click="applyPreset(p.prompt)"
            >
              {{ p.label }}
            </button>
          </div>
        </div>

        <!-- AI Progress Stepper -->
        <div v-if="isGeneratingAi" class="px-3 py-2 border border-primary/20 rounded-lg bg-primary/5 flex items-center justify-between">
          <div class="text-xs text-primary font-medium flex gap-2 items-center">
            <Spinner size="sm" class="h-3.5 w-3.5" />
            <span v-if="aiStep === 'analyzing'">Inspecting table schema and column types...</span>
            <span v-else-if="aiStep === 'prompting'">Prompting AI model to synthesize {{ rowCount }} realistic records...</span>
            <span v-else-if="aiStep === 'parsing'">Validating, parsing, and shaping synthetic records...</span>
            <span v-else>Processing...</span>
          </div>
          <span class="text-[11px] text-primary/80 font-mono">Step: {{ aiStep }}</span>
        </div>

        <!-- AI Error Alert Box -->
        <div v-if="aiError && !isGeneratingAi" class="p-3 border border-destructive/30 rounded-lg bg-destructive/10 text-xs space-y-2">
          <div class="text-destructive font-medium flex items-center justify-between">
            <div class="flex gap-2 items-center">
              <AlertCircle class="h-4 w-4 shrink-0" />
              <span>AI Generation Error: {{ aiError }}</span>
            </div>
            <div class="flex gap-2 items-center">
              <Button
                variant="outline"
                size="sm"
                class="text-xs h-6 px-2"
                @click="generateWithAi"
              >
                <RefreshCw class="mr-1 h-3 w-3" />
                Retry
              </Button>
              <Button
                variant="ghost"
                size="sm"
                class="text-xs h-6 px-2"
                @click="resetToRuleBased"
              >
                Use Rule-Based
              </Button>
            </div>
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

        <!-- AI Success Summary Badge -->
        <div v-if="aiRows && !isGeneratingAi && !aiError" class="px-3 py-1.5 border border-emerald-500/20 rounded-lg bg-emerald-500/10 text-xs text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
          <div class="flex gap-2 items-center">
            <CheckCircle2 class="h-3.5 w-3.5" />
            <span>Successfully synthesized {{ aiRows.length }} realistic rows tailored to schema semantics.</span>
          </div>
          <button
            type="button"
            class="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
            @click="resetToRuleBased"
          >
            Switch to Rule-Based
          </button>
        </div>
      </div>

      <!-- Navigation tabs -->
      <div class="text-xs font-medium px-5 pb-0 pt-2 border-b bg-card/20 flex shrink-0 gap-4">
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
            v-if="generatorMode === 'ai' && aiRows"
            class="text-[10px] text-primary font-medium font-sans px-1.5 py-0.2 rounded bg-primary/15"
          >
            AI Active
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
      <div class="p-5 flex-1 max-h-[460px] min-h-[300px] overflow-y-auto">
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
            <span>
              {{ generatorMode === 'ai' ? 'Columns included in AI prompt context.' : 'Choose rule-based synthetic generator for each column.' }}
            </span>
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
                    <!-- In AI mode, show semantic inferred badge -->
                    <div v-if="generatorMode === 'ai'" class="flex items-center">
                      <span class="text-[11px] text-muted-foreground font-mono px-2 py-0.5 border border-border/60 rounded bg-muted/30">
                        Synthesized by AI ({{ col.generator }})
                      </span>
                    </div>

                    <!-- In Rule mode, show custom themed dropdown -->
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

                      <!-- Dropdown List Popup -->
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

        <!-- 2. Live Data Preview Tab -->
        <div v-else-if="activeTab === 'preview_table'" class="space-y-3">
          <div class="text-xs text-muted-foreground flex items-center justify-between">
            <p>
              Preview of first {{ Math.min(finalRows.length, 5) }} synthetic records that will be generated:
            </p>
            <span
              v-if="generatorMode === 'ai' && aiRows"
              class="text-[11px] text-primary font-medium px-2 py-0.5 border border-primary/20 rounded bg-primary/10 flex gap-1 items-center"
            >
              <Sparkles class="h-3 w-3" />
              AI Synthesized ({{ aiRows.length }} rows)
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
          <pre class="text-xs text-foreground leading-relaxed font-mono p-3.5 border rounded-lg bg-background max-h-[360px] select-all overflow-x-auto">{{ generatedSql }}</pre>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="px-5 py-3 border-t bg-muted/20 flex shrink-0 items-center justify-between">
        <span class="text-xs text-muted-foreground flex gap-1.5 items-center">
          Ready to seed <strong class="text-foreground">{{ finalRows.length }}</strong> records into <code class="text-xs font-mono">{{ tableName }}</code>
          <span
            v-if="generatorMode === 'ai' && aiRows"
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
