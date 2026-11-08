<script setup lang="ts">
import { ref } from 'vue'
import AiAssistantSidebar from './AiAssistantSidebar.vue'
import AppHeader from './AppHeader.vue'
import AppSidebar from './AppSidebar.vue'
import TaskSidebar from './TaskSidebar.vue'

const props = defineProps<{
  hideAiButton?: boolean
  plain?: boolean
}>()

type SidePanel = 'none' | 'ai' | 'tasks'

const sidePanel = ref<SidePanel>('none')

function toggleAi() {
  sidePanel.value = sidePanel.value === 'ai' ? 'none' : 'ai'
}

function toggleTaskManager() {
  sidePanel.value = sidePanel.value === 'tasks' ? 'none' : 'tasks'
}
</script>

<template>
  <div class="bg-background flex flex-col h-screen overflow-hidden">
    <AppHeader
      :hide-ai-button="props.hideAiButton ?? false"
      @toggle-ai="toggleAi"
      @toggle-task-manager="toggleTaskManager"
    />
    <div class="px-2 pb-2 pt-0 bg-background flex flex-1 gap-2 min-h-0 overflow-hidden">
      <AppSidebar />
      <main
        v-if="props.plain"
        class="flex flex-1 flex-col gap-2 min-w-0 relative overflow-hidden"
      >
        <slot />
      </main>
      <main
        v-else
        class="border border-border/70 rounded-xl bg-card/40 flex flex-1 min-w-0 shadow-sm relative overflow-hidden"
      >
        <div class="flex-1 h-full w-full overflow-auto">
          <slot />
        </div>
      </main>

      <AiAssistantSidebar
        v-if="sidePanel === 'ai'"
        @close="sidePanel = 'none'"
      />
      <TaskSidebar
        v-if="sidePanel === 'tasks'"
        @close="sidePanel = 'none'"
      />
    </div>
  </div>
</template>
