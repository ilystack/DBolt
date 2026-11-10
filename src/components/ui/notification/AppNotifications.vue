<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useNotifications } from '@/composables/useNotifications'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from 'lucide-vue-next'

const { t } = useI18n()
const { toasts, dismiss } = useNotifications()
</script>

<template>
  <div class="pointer-events-none fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 w-full max-w-lg px-4">
    <TransitionGroup name="toast">
      <div
        v-for="item in toasts"
        :key="item.id"
        class="pointer-events-auto flex items-start gap-2.5 rounded-lg border px-3.5 py-2 text-xs shadow-2xl backdrop-blur-md w-auto max-w-full"
        :class="{
          'bg-background/95 border-border text-foreground': item.type === 'info',
          'bg-background/95 border-emerald-500/40 text-foreground': item.type === 'success',
          'bg-background/95 border-destructive/40 text-foreground': item.type === 'error',
          'bg-background/95 border-amber-500/40 text-foreground': item.type === 'warning',
        }"
      >
        <!-- Icon -->
        <div class="mt-0.5 shrink-0">
          <CheckCircle2 v-if="item.type === 'success'" class="h-4 w-4 text-emerald-500" />
          <AlertCircle v-else-if="item.type === 'error'" class="h-4 w-4 text-destructive" />
          <AlertTriangle v-else-if="item.type === 'warning'" class="h-4 w-4 text-amber-500" />
          <Info v-else class="h-4 w-4 text-primary" />
        </div>

        <!-- Content -->
        <div class="flex-1 min-w-0 pr-1">
          <p class="leading-snug font-medium">
            {{ item.title }}
          </p>
          <p v-if="item.description" class="text-[11px] text-muted-foreground leading-relaxed mt-0.5 break-words">
            {{ item.description }}
          </p>
        </div>

        <!-- Dismiss -->
        <button
          type="button"
          class="opacity-60 transition-opacity hover:opacity-100 mt-0.5 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
          :aria-label="t('common.buttons.dismiss')"
          @click="dismiss(item.id)"
        >
          <X class="h-3.5 w-3.5" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(-16px) scale(0.95);
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}
</style>
