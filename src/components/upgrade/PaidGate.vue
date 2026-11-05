<script lang="ts" setup>
import type { PaidFeature } from '../../common'

withDefaults(
  defineProps<{ feature?: PaidFeature, compact?: boolean, autoPrompt?: boolean }>(),
  { compact: false, autoPrompt: false },
)
</script>

<template>
  <slot />
</template>
