<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

const features = [
  'AI Agent & Chat Assistant (BYOK & Local Ollama)',
  'Visual ER Diagram Generator',
  'Cross-Engine Data Transfer & Bulk Migration',
  'SSH Tunneling Support',
  'Model Context Protocol (MCP) Server Bridge',
  'Unlimited Databases & Connections',
]
</script>

<template>
  <Card>
    <CardContent class="px-5 py-4 space-y-4">
      <div class="flex flex-wrap gap-3 items-center justify-between">
        <div class="flex gap-2 items-center">
          <Badge variant="default" class="text-primary-foreground font-semibold bg-primary">
            DBolt Community Edition
          </Badge>
          <span class="text-xs text-muted-foreground">
            Free &amp; Open Source — All features permanently unlocked
          </span>
        </div>
      </div>

      <div class="pt-2 border-t border-border/40 gap-2 grid grid-cols-1 md:grid-cols-2">
        <div
          v-for="feature in features"
          :key="feature"
          class="text-xs text-muted-foreground flex gap-2 items-center"
        >
          <div class="text-emerald-500 p-0.5 rounded-full bg-emerald-500/10 shrink-0">
            <Check class="h-3.5 w-3.5" />
          </div>
          <span>{{ feature }}</span>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
