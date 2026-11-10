<script setup lang="ts">
import { ChevronDown, Code2, FileCode2, Split, Trash2 } from 'lucide-vue-next'
import type { CopyFormat } from '@/types/grid'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

defineProps<{
  selectedCount: number
  selectedRows: Record<string, unknown>[]
  columns: string[]
  tableName?: string
}>()

const emit = defineEmits<{
  (e: 'deleteSelected'): void
  (e: 'exportSelected', format: CopyFormat): void
}>()

const { t } = useI18n()
const exportMenuOpen = ref(false)
</script>

<template>
  <Transition name="slide-up">
    <div
      v-if="selectedCount > 0"
      class="px-4 py-2 border-t border-primary/20 bg-primary/10 flex gap-3 items-center bottom-0 sticky z-30 backdrop-blur-sm"
    >
      <span class="text-sm font-medium tabular-nums">
        {{ t('components.dataGrid.selection.selected', { count: selectedCount }) }}
      </span>
      <div class="ml-auto flex gap-2">
        <DropdownMenu v-model:open="exportMenuOpen">
          <DropdownMenuTrigger as-child>
            <Button variant="outline" size="sm">
              {{ t('components.dataGrid.selection.exportSelected') }}
              <ChevronDown class="ml-1 h-3 w-3 transition-transform duration-200"
                :class="{ 'rotate-180': exportMenuOpen }"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem @click="emit('exportSelected', 'csv')">
              <Split class="mr-2 h-3.5 w-3.5" />{{ t('components.dataGrid.export.formatLabels.csv') }}
            </DropdownMenuItem>
            <DropdownMenuItem @click="emit('exportSelected', 'json')">
              <Code2 class="mr-2 h-3.5 w-3.5" />{{ t('components.dataGrid.export.formatLabels.json') }}
            </DropdownMenuItem>
            <DropdownMenuItem @click="emit('exportSelected', 'insert')">
              <FileCode2 class="mr-2 h-3.5 w-3.5" />{{ t('components.dataGrid.export.formatLabels.insert') }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="destructive"
          size="sm"
          @click="emit('deleteSelected')"
        >
          <Trash2 class="mr-1 h-3.5 w-3.5" />
          {{ t('components.dataGrid.selection.deleteSelected') }}
        </Button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.slide-up-enter-active {
  transition: all 0.2s ease-out;
}
.slide-up-leave-active {
  transition: all 0.15s ease-in;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
