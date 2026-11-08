<!--
  Visual Role: Compact file upload area for import wizard.
  Uses subtle primary outlines and monospaced format badges on hover/drag.
-->
<script setup lang="ts">
import { getCurrentInstance, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const props = defineProps<{
  acceptedFormats?: string[]
}>()

const emit = defineEmits<{
  fileSelected: [file: File]
  browse: []
}>()

const { t } = useI18n()
const instance = getCurrentInstance()

const isDragging = ref(false)

const formats = props.acceptedFormats || ['csv', 'jsonl', 'sql', 'xlsx']

const fileInputRef = ref<HTMLInputElement | null>(null)

function triggerFileInput() {
  fileInputRef.value?.click()
}

function handleBrowseClick() {
  emit('browse')
  if (!instance?.vnode.props?.onBrowse) {
    triggerFileInput()
  }
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function handleDragLeave() {
  isDragging.value = false
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
  const files = e.dataTransfer?.files
  if (files?.length) {
    emit('fileSelected', files[0])
  }
}

function handleFileInput(e: Event) {
  const target = e.target as HTMLInputElement
  const files = target.files
  if (files?.length) {
    emit('fileSelected', files[0])
  }
}
</script>

<template>
  <Card
    class="rounded-md border-dashed transition-all duration-200"
    :class="isDragging ? 'border-primary/60 bg-primary/[0.04]' : 'border-border/60 bg-muted/10'"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <CardContent class="p-5 text-center flex flex-col min-h-[120px] items-center justify-center">
      <h3 class="text-sm text-foreground tracking-tight font-medium">
        {{ t('transfer.import.dropzone.title') }}
      </h3>
      <p class="text-caption text-muted-foreground mt-0.5">
        {{ t('transfer.import.dropzone.instruction') }}
      </p>
      <div class="mt-2.5 flex flex-wrap gap-1.5 justify-center">
        <span
          v-for="f in formats"
          :key="f"
          class="text-caption text-muted-foreground tracking-wider font-mono px-1.5 py-0.5 rounded-sm bg-muted/60 uppercase"
        >
          {{ f }}
        </span>
      </div>
      <div class="mt-3 flex justify-center">
        <Button
          type="button"
          variant="outline"
          size="sm"
          class="text-xs px-3 gap-1.5 h-7"
          @click="handleBrowseClick"
        >
          <span class="i-carbon-folder-open h-3.5 w-3.5" />
          {{ t('transfer.import.browseFiles') }}
        </Button>
      </div>
      <input
        ref="fileInputRef"
        type="file"
        class="hidden"
        tabindex="-1"
        :accept="formats.map(f => `.${f}`).join(',')"
        @change="handleFileInput"
      >
    </CardContent>
  </Card>
</template>
