<script setup lang="ts">
import type { ExplainPlanNode, ExplainResult } from '@/types/explainPlan'
import { Check, Copy, Flame, Lightbulb, Play, Sparkles, Zap } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from '@/composables/useNotifications'

const props = defineProps<{
  explainResult: ExplainResult | null
}>()

const emit = defineEmits<{
  applySql: [sql: string]
  askAi: [prompt: string]
}>()

const { t } = useI18n()
const copiedIndex = ref<string | null>(null)

type OptimizationIssue = {
  id: string
  severity: 'high' | 'medium' | 'info'
  title: string
  description: string
  targetTable?: string
  suggestedSql?: string
  recommendation: string
}

function extractColumnFromFilter(detail: string): string[] {
  const cols: string[] = []
  // Matches patterns like `(status = 'active')`, `(user_id = 123)`, `status = ...`
  const matches = detail.matchAll(/(?:\w+\.)?(\b[a-z_]\w*\b)\s*(?:[=<>]|LIKE|IN|IS)/gi)
  for (const m of matches) {
    const col = m[1].toLowerCase()
    if (!['and', 'or', 'not', 'true', 'false', 'null', 'filter'].includes(col) && !cols.includes(col)) {
      cols.push(col)
    }
  }
  return cols
}

const analysis = computed<{
  score: number
  status: 'optimal' | 'moderate' | 'slow'
  issues: OptimizationIssue[]
  suggestionsCount: number
}>(() => {
  if (!props.explainResult) {
    return { score: 100, status: 'optimal', issues: [], suggestionsCount: 0 }
  }

  const issues: OptimizationIssue[] = []
  let deduction = 0

  function inspectNode(node: ExplainPlanNode) {
    const typeLower = node.nodeType.toLowerCase()
    const isSeqScan = typeLower.includes('seq scan') || typeLower.includes('full table scan') || (typeLower.includes('scan') && !node.index)
    const isSort = typeLower.includes('sort') || typeLower.includes('filesort')
    const isNestedLoop = typeLower.includes('nested loop')

    // 1. Check for Sequential / Full Table Scans
    if (isSeqScan && node.relation) {
      const filterDetail = node.details.find(d => d.toLowerCase().includes('filter')) || ''
      const filteredCols = filterDetail ? extractColumnFromFilter(filterDetail) : []
      const colName = filteredCols.length > 0 ? filteredCols.join(', ') : 'column_name'
      const cleanColForIdx = filteredCols.length > 0 ? filteredCols.join('_') : 'lookup'

      const isHighCost = (node.totalCost ?? 0) > 100 || (node.rows ?? 0) > 500
      const severity = isHighCost ? 'high' : 'medium'
      deduction += isHighCost ? 25 : 15

      const suggestedSql = `CREATE INDEX idx_${node.relation}_${cleanColForIdx} ON ${node.relation} (${colName});`

      issues.push({
        id: `seq-${node.id}`,
        severity,
        title: `Full Table Scan on \`${node.relation}\``,
        targetTable: node.relation,
        description: filterDetail
          ? `Query performs a full sequential scan filtering by: ${filterDetail}`
          : `Reading entire table without utilizing an index. Cost: ${node.cost || node.totalCost || 'high'}.`,
        suggestedSql,
        recommendation: `Add a B-Tree index on \`${node.relation}(${colName})\` to convert this into a high-speed Index Scan.`,
      })
    }

    // 2. Check for Expensive Sort Operations
    if (isSort && (node.totalCost ?? 0) > 50) {
      deduction += 10
      issues.push({
        id: `sort-${node.id}`,
        severity: 'medium',
        title: `In-Memory or Disk Sort Operation`,
        description: `Query sorting requires temporary memory/disk buffer (${node.details.join(', ') || 'Sort Key'}).`,
        recommendation: `If sorting by specific columns frequently, create a composite index matching the \`ORDER BY\` clause.`,
      })
    }

    // 3. Check for Nested Loop with High Rows
    if (isNestedLoop && (node.rows ?? 0) > 1000) {
      deduction += 15
      issues.push({
        id: `nl-${node.id}`,
        severity: 'medium',
        title: `Large Nested Loop Join`,
        description: `Processing large volume (${node.rows} rows) via Nested Loop. Missing foreign key index may degrade join speed.`,
        recommendation: `Ensure join keys on the child relation have an active index.`,
      })
    }

    // 4. Stale Statistics Warning
    if (node.rows !== undefined && node.actualRows !== undefined) {
      const ratio = Math.max(node.rows, node.actualRows) / Math.max(1, Math.min(node.rows, node.actualRows))
      if (ratio > 10 && node.relation) {
        deduction += 10
        issues.push({
          id: `stats-${node.id}`,
          severity: 'info',
          title: `Stale Query Planner Statistics on \`${node.relation}\``,
          description: `Planner estimated ${node.rows} rows, but actual execution returned ${node.actualRows} rows (${Math.round(ratio)}x discrepancy).`,
          suggestedSql: `ANALYZE ${node.relation};`,
          recommendation: `Update optimizer statistics to help the query planner choose optimal join algorithms.`,
        })
      }
    }

    for (const child of node.children || []) {
      inspectNode(child)
    }
  }

  for (const root of props.explainResult.nodes) {
    inspectNode(root)
  }

  const score = Math.max(20, Math.min(100, 100 - deduction))
  const status = score >= 85 ? 'optimal' : score >= 60 ? 'moderate' : 'slow'

  return {
    score,
    status,
    issues,
    suggestionsCount: issues.filter(i => i.suggestedSql).length,
  }
})

async function copySql(sql: string) {
  try {
    await navigator.clipboard.writeText(sql)
    copiedIndex.value = sql
    toast.success(t('common.copied') || 'Index DDL copied to clipboard')
    setTimeout(() => {
      if (copiedIndex.value === sql)
        copiedIndex.value = null
    }, 2000)
  }
  catch {
    toast.error('Failed to copy to clipboard')
  }
}

function handleAskAi(issue: OptimizationIssue) {
  const prompt = `Help optimize this query based on the database execution plan.
Target Table: ${issue.targetTable || 'Unknown'}
Bottleneck: ${issue.title}
Detail: ${issue.description}
Raw Execution Plan snippet:
${props.explainResult?.raw?.slice(0, 1000) || ''}

Please recommend the best index and provide an optimized rewritten SQL query.`

  emit('askAi', prompt)
}
</script>

<template>
  <div class="p-4 h-full overflow-y-auto space-y-4">
    <!-- Health Score Header Banner -->
    <div
      class="p-4 border rounded-xl flex flex-col gap-4 justify-between sm:flex-row sm:items-center"
      :class="{
        'border-emerald-500/30 bg-emerald-500/5': analysis.status === 'optimal',
        'border-amber-500/30 bg-amber-500/5': analysis.status === 'moderate',
        'border-rose-500/30 bg-rose-500/5': analysis.status === 'slow',
      }"
    >
      <div class="flex gap-3 items-center">
        <div
          class="rounded-lg flex shrink-0 h-10 w-10 items-center justify-center"
          :class="{
            'bg-emerald-500/15 text-emerald-500': analysis.status === 'optimal',
            'bg-amber-500/15 text-amber-500': analysis.status === 'moderate',
            'bg-rose-500/15 text-rose-500': analysis.status === 'slow',
          }"
        >
          <Zap v-if="analysis.status === 'optimal'" class="h-5 w-5" />
          <Lightbulb v-else-if="analysis.status === 'moderate'" class="h-5 w-5" />
          <Flame v-else class="h-5 w-5" />
        </div>
        <div>
          <div class="flex gap-2 items-center">
            <h3 class="text-sm text-foreground font-semibold">
              Query Performance Score: {{ analysis.score }}/100
            </h3>
            <span
              class="text-[11px] tracking-wider font-medium px-2 py-0.5 rounded-full uppercase"
              :class="{
                'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400': analysis.status === 'optimal',
                'bg-amber-500/20 text-amber-600 dark:text-amber-400': analysis.status === 'moderate',
                'bg-rose-500/20 text-rose-600 dark:text-rose-400': analysis.status === 'slow',
              }"
            >
              {{ analysis.status === 'optimal' ? 'Fast' : analysis.status === 'moderate' ? 'Needs Index' : 'Bottleneck Detected' }}
            </span>
          </div>
          <p class="text-xs text-muted-foreground mt-0.5">
            {{ analysis.issues.length === 0
              ? 'Great execution plan! No major table scans or sorting bottlenecks detected.'
              : `${analysis.issues.length} performance optimization opportunities identified from execution plan.`
            }}
          </p>
        </div>
      </div>

      <button
        v-if="analysis.issues.length > 0"
        class="text-xs text-primary-foreground font-medium px-3 py-1.5 rounded-md bg-primary inline-flex shrink-0 gap-1.5 transition-opacity items-center hover:opacity-90"
        @click="handleAskAi(analysis.issues[0])"
      >
        <Sparkles class="h-3.5 w-3.5" />
        <span>Ask AI to Rewrite Query</span>
      </button>
    </div>

    <!-- Optimization Opportunities List -->
    <div v-if="analysis.issues.length > 0" class="space-y-3">
      <h4 class="text-xs text-muted-foreground tracking-wider font-semibold uppercase">
        Identified Bottlenecks & Recommendations
      </h4>

      <div
        v-for="issue in analysis.issues"
        :key="issue.id"
        class="p-3.5 border rounded-lg bg-card/50 transition-colors space-y-2.5 hover:border-foreground/20"
      >
        <div class="flex gap-3 items-start justify-between">
          <div class="space-y-1">
            <div class="flex gap-2 items-center">
              <span
                class="rounded-full shrink-0 h-2 w-2"
                :class="issue.severity === 'high' ? 'bg-rose-500' : issue.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-500'"
              />
              <span class="text-sm text-foreground font-medium">{{ issue.title }}</span>
            </div>
            <p class="text-xs text-muted-foreground pl-4">
              {{ issue.description }}
            </p>
          </div>
          <button
            class="text-xs text-muted-foreground p-1 rounded inline-flex shrink-0 gap-1 items-center hover:text-foreground hover:bg-muted/50"
            title="Consult AI on this issue"
            @click="handleAskAi(issue)"
          >
            <Sparkles class="h-3.5 w-3.5" />
            <span class="hidden sm:inline">Ask AI</span>
          </button>
        </div>

        <div class="text-xs p-2.5 pl-3 border border-border/60 rounded-md bg-muted/40 space-y-1.5">
          <p class="text-foreground/90 font-medium flex gap-1.5 items-center">
            <Lightbulb class="text-amber-500 shrink-0 h-3.5 w-3.5" />
            <span>{{ issue.recommendation }}</span>
          </p>

          <div v-if="issue.suggestedSql" class="pt-1.5">
            <div class="text-[11px] text-muted-foreground mb-1 flex items-center justify-between">
              <span>Suggested Index DDL:</span>
              <div class="flex gap-2">
                <button
                  class="inline-flex gap-1 items-center hover:text-foreground"
                  @click="copySql(issue.suggestedSql)"
                >
                  <Check v-if="copiedIndex === issue.suggestedSql" class="text-emerald-500 h-3 w-3" />
                  <Copy v-else class="h-3 w-3" />
                  <span>{{ copiedIndex === issue.suggestedSql ? 'Copied' : 'Copy' }}</span>
                </button>
                <button
                  class="text-primary inline-flex gap-1 items-center hover:text-foreground"
                  @click="emit('applySql', issue.suggestedSql)"
                >
                  <Play class="h-3 w-3" />
                  <span>Execute</span>
                </button>
              </div>
            </div>
            <pre class="text-[11px] text-foreground font-mono p-2 border border-border/70 rounded bg-background/90 select-all overflow-x-auto">{{ issue.suggestedSql }}</pre>
          </div>
        </div>
      </div>
    </div>

    <!-- Optimal State / General Advice -->
    <div v-else class="p-8 text-center border rounded-xl bg-muted/20 space-y-3">
      <div class="text-emerald-500 mx-auto rounded-full bg-emerald-500/10 flex h-12 w-12 items-center justify-center">
        <Zap class="h-6 w-6" />
      </div>
      <div class="mx-auto max-w-md space-y-1">
        <h4 class="text-sm text-foreground font-medium">
          Query Execution is Fast & Optimized
        </h4>
        <p class="text-xs text-muted-foreground">
          No unindexed sequential scans or costly Cartesian joins found in this plan. Indexes are being leveraged effectively.
        </p>
      </div>
    </div>
  </div>
</template>
