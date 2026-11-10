<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type ModelCategory = 'general' | 'reasoning' | 'coding' | 'fast' | 'vision'

type ModelPickerItem = {
  id: string
  label: string
  providerConfigId: string
  category?: ModelCategory
}

type ModelPickerGroup = {
  id: string
  label: string
  models: Array<ModelPickerItem>
}

const props = withDefaults(
  defineProps<{
    title?: string
    groups: Array<ModelPickerGroup>
    modelValue?: string
    recentModelIds?: Array<string>
    emptyText?: string
    compact?: boolean
  }>(),
  {
    title: 'Select model',
    modelValue: undefined,
    recentModelIds: () => [],
    emptyText: 'No models found.',
    compact: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'open': []
}>()

const open = ref(false)

watch(open, (value) => {
  if (value)
    emit('open')
})

const triggerClasses = computed(() =>
  props.compact
    ? 'h-7 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 min-w-0 inline-flex items-center justify-center cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 model-picker-trigger'
    : 'h-8 rounded-md px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 min-w-0 inline-flex items-center justify-center cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 model-picker-trigger',
)

const panelClasses = computed(() =>
  props.compact
    ? 'w-[260px] p-0 bg-popover text-foreground border border-border shadow-md rounded-xl overflow-hidden'
    : 'w-[280px] p-0 bg-popover text-popover-foreground border border-border shadow-md rounded-xl overflow-hidden',
)

const flattenedModels = computed(() => props.groups.flatMap(group => group.models))

const recentModels = computed(() =>
  props.recentModelIds
    .map(id => flattenedModels.value.find(model => model.id === id))
    .filter((model): model is ModelPickerItem => Boolean(model)),
)

const selectedLabel = computed(() => {
  const active = flattenedModels.value.find(model => model.id === props.modelValue)
  if (active)
    return active.label
  const recent = recentModels.value[0]
  if (recent)
    return recent.label
  return flattenedModels.value[0]?.label ?? 'Select model'
})

function selectModel(value: string) {
  emit('update:modelValue', value)
  open.value = false
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <button :class="triggerClasses">
        <span class="text-left truncate">{{ selectedLabel }}</span>
        <span
          class="i-carbon-chevron-down text-muted-foreground ml-1 shrink-0 h-3 w-3 transition-transform duration-200"
          :class="{ 'rotate-180': open }"
        />
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" side="top" :side-offset="6" :collision-padding="8" :class="panelClasses">
      <div class="model-picker-panel">
        <div class="model-picker-header">
          <span class="model-picker-title">{{ title }}</span>
        </div>

        <div class="model-picker-list">
          <div v-for="group in props.groups" :key="group.id" class="model-picker-section">
            <button
              v-for="model in group.models"
              :key="model.id"
              class="model-picker-row"
              :class="{ selected: model.id === modelValue }"
              @click="selectModel(model.id)"
            >
              <div class="model-picker-main">
                <span class="model-picker-dot" :class="{ active: model.id === modelValue }" />
                <span class="model-picker-name">{{ model.label }}</span>
                <span v-if="model.category" class="model-picker-meta">{{ model.category }}</span>
              </div>
              <span
                v-if="model.id === modelValue"
                class="model-picker-checkmark i-carbon-checkmark shrink-0 h-4 w-4"
              />
            </button>
          </div>

          <div v-if="props.groups.length === 0" class="model-picker-empty">
            {{ emptyText }}
          </div>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>

<style scoped>
.model-picker-panel {
  display: flex;
  max-height: 420px;
  flex-direction: column;
}

.model-picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px 6px;
  border-bottom: 1px solid hsl(var(--border));
}

.model-picker-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: hsl(var(--muted-foreground));
}

.model-picker-list {
  overflow-y: auto;
  padding: 0 8px 12px;
}

.model-picker-section + .model-picker-section {
  margin-top: 10px;
}

.model-picker-heading {
  padding: 0 6px 6px;
  font-size: var(--font-size-dense);
  font-weight: 700;
  color: hsl(var(--primary-text));
}

.model-picker-row {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-radius: 8px;
  padding: 6px 8px;
  text-align: left;
  color: hsl(var(--foreground));
}

.model-picker-row:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: -1px;
}

.model-picker-row:hover {
  background: hsl(var(--muted) / 0.4);
}

.model-picker-row.selected .model-picker-name {
  color: hsl(var(--primary-text));
}

.model-picker-row.selected .model-picker-checkmark {
  color: hsl(var(--primary-text));
}

.model-picker-main {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.model-picker-dot {
  height: 8px;
  width: 8px;
  border-radius: 9999px;
  background: transparent;
}

.model-picker-dot.active {
  background: hsl(var(--primary));
}

.model-picker-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--font-size-body);
}

.model-picker-provider,
.model-picker-meta {
  font-size: var(--font-size-caption);
  color: hsl(var(--muted-foreground));
}

.model-picker-empty {
  padding: 14px 8px;
  font-size: var(--font-size-dense);
  color: hsl(var(--muted-foreground));
}

.model-picker-trigger {
  border: none;
  background: transparent;
}
</style>
