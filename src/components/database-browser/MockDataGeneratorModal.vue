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
  Play,
  RefreshCw,
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

type ColumnConfig = {
  name: string
  dataType: string
  nullable: boolean
  isPrimaryKey: boolean
  isAutoIncrement: boolean
  included: boolean
}

type AiStep = 'idle' | 'analyzing' | 'prompting' | 'parsing' | 'done' | 'error'

const loading = ref(false)
const executing = ref(false)
const rowCount = ref<number>(25)
const activeTab = ref<'columns' | 'preview_table' | 'preview_sql'>('columns')
const columns = ref<ColumnConfig[]>([])
const copied = ref(false)
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

const fullTableName = computed(() => {
  if (props.schema && props.database && props.schema !== props.database) {
    return `${props.database}.${props.schema}.${props.tableName}`
  }
  const prefix = props.schema || props.database
  return prefix ? `${prefix}.${props.tableName}` : props.tableName
})

const targetTableIdentifier = computed(() => {
  if (props.schema && props.database && props.schema !== props.database) {
    return `\`${props.schema}\`.\`${props.tableName}\``
  }
  const prefix = props.schema || props.database
  return prefix ? `\`${prefix}\`.\`${props.tableName}\`` : `\`${props.tableName}\``
})

const generateButtonText = computed(() => {
  if (!isGeneratingAi.value)
    return 'Generate Now'
  switch (aiStep.value) {
    case 'analyzing':
      return 'Analyzing Schema...'
    case 'prompting':
      return 'Synthesizing Data...'
    case 'parsing':
      return 'Formatting Records...'
    default:
      return 'Synthesizing...'
  }
})

const regenerateButtonText = computed(() => {
  if (!isGeneratingAi.value)
    return 'Regenerate'
  switch (aiStep.value) {
    case 'analyzing':
      return 'Analyzing Schema...'
    case 'prompting':
      return 'Synthesizing Data...'
    case 'parsing':
      return 'Formatting Records...'
    default:
      return 'Regenerating...'
  }
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

    columns.value = rawCols
      .filter(c => !c.is_auto_increment)
      .map(c => ({
        name: c.name,
        dataType: c.data_type,
        nullable: c.nullable,
        isPrimaryKey: c.is_primary_key,
        isAutoIncrement: c.is_auto_increment,
        included: false,
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
    activeTab.value = 'columns'
    loadTableColumns()
    syncModels()
  }
})

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
const isAllSelected = computed(() => columns.value.length > 0 && columns.value.every(c => c.included))

const finalRows = computed(() => {
  if (aiRows.value && aiRows.value.length > 0) {
    return aiRows.value.slice(0, rowCount.value)
  }
  return []
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
    const tableId = fullTableName.value

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
          cleanRow[col.name] = null
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
  const targetTable = targetTableIdentifier.value

  const valueRows = finalRows.value.map((row) => {
    const rowVals = cols.map(c => formatSqlLiteral(row[c.name]))
    return `  (${rowVals.join(', ')})`
  })

  return `-- DBolt Smart Mock Data Generator (${finalRows.value.length} rows - AI Synthesized)\nINSERT INTO ${targetTable} (${escapedCols})\nVALUES\n${valueRows.join(',\n')};`
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
            {{ fullTableName }}
          </span>
        </DialogTitle>

        <!-- Right Header: Row Count Presets -->
        <div class="mr-6 flex gap-1.5 items-center">
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

      <!-- Navigation Tabs Bar (Hanya muncul ketika sudah ada data AI untuk preview) -->
      <div v-if="aiRows" class="text-xs font-medium px-5 pt-3 pb-0 border-b bg-card/20 flex shrink-0 gap-6">
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
            class="text-[10px] text-primary font-medium font-sans px-1.5 py-0.2 rounded bg-primary/15"
          >
            AI ({{ aiRows.length }})
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
          <span
            class="text-[10px] text-primary font-medium font-sans px-1.5 py-0.2 rounded bg-primary/15"
          >
            AI
          </span>
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
              Columns included in AI prompt context.
            </span>
            <div class="flex gap-2 items-center">
              <button
                type="button"
                class="transition-colors"
                :class="!isAllSelected ? 'text-primary font-semibold hover:underline' : 'text-muted-foreground hover:text-foreground font-normal'"
                @click="columns.forEach(c => c.included = true)"
              >
                Select All
              </button>
              <span class="text-muted-foreground/60">&middot;</span>
              <button
                type="button"
                class="transition-colors"
                :class="isAllSelected ? 'text-primary font-semibold hover:underline' : 'text-muted-foreground hover:text-foreground font-normal'"
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
                    </div>
                  </td>
                  <td class="text-muted-foreground font-mono px-3 py-2">
                    {{ col.dataType }}
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
          <div v-else-if="aiError" class="p-3 border border-destructive/30 rounded-lg bg-destructive/10 text-xs space-y-2">
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
                v-if="aiRows"
                class="text-[11px] text-primary font-medium px-2 py-0.5 border border-primary/20 rounded bg-primary/10 flex gap-1 items-center"
              >
                AI Synthesized ({{ aiRows.length }} rows)
              </span>
            </div>

            <!-- Preview Data Grid -->
            <div class="border rounded-lg bg-card/40 overflow-x-auto">
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

      <!-- BOTTOM ACTION BAR / FOOTER -->
      <div class="px-5 py-3 border-t bg-muted/20 flex shrink-0 items-center justify-between gap-4">
        <!-- FOOTER KIRI: Model Picker -->
        <div class="flex items-center gap-2">
          <span class="text-xs text-muted-foreground font-medium">
            <span>Model:</span>
          </span>

          <!-- Custom Themed Model Dropdown (Opens upwards) -->
          <div class="relative">
            <button
              type="button"
              class="h-8 rounded-md px-2.5 text-xs border border-border/80 bg-background text-foreground hover:bg-muted/40 inline-flex items-center gap-1.5 focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
              @click="openModelDropdown = !openModelDropdown"
            >
              <span class="truncate max-w-[150px] font-mono font-medium">{{ selectedModelLabel }}</span>
              <ChevronDown
                class="h-3.5 w-3.5 text-muted-foreground ml-0.5 shrink-0 transition-transform duration-200"
                :class="{ 'rotate-180': openModelDropdown }"
              />
            </button>

            <!-- Dropdown popup positioning upwards -->
            <div
              v-if="openModelDropdown"
              class="absolute bottom-full left-0 mb-1.5 max-h-60 w-64 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-2xl z-50"
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

        <!-- FOOTER KANAN: Action Buttons -->
        <!-- Skenario 1: Sebelum Generate Data -->
        <div v-if="!aiRows" class="flex items-center gap-2">
          <Button
            size="sm"
            class="text-xs font-medium px-4 gap-1.5 h-8 bg-primary text-primary-foreground hover:opacity-90 shadow-sm"
            :disabled="isGeneratingAi || loading || activeColumns.length === 0"
            @click="generateWithAi"
          >
            <Spinner v-if="isGeneratingAi" size="sm" class="h-3.5 w-3.5" />
            <Play v-else class="h-3.5 w-3.5" />
            <span>{{ generateButtonText }}</span>
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

        <!-- Skenario 2: Setelah Data AI Berhasil di-generate -->
        <div v-else class="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            class="h-8 text-xs gap-1.5"
            :disabled="isGeneratingAi"
            @click="generateWithAi"
          >
            <Spinner v-if="isGeneratingAi" size="sm" class="h-3 w-3" />
            <RefreshCw v-else class="h-3 w-3" />
            <span>{{ regenerateButtonText }}</span>
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
      </div>
    </DialogContent>
  </Dialog>
</template>
