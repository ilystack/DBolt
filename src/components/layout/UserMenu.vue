<script setup lang="ts">
import { openUrl } from '@tauri-apps/plugin-opener'
import { ExternalLink, MessageSquareHeart, Sparkles } from 'lucide-vue-next'
import { ref } from 'vue'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { version } from '../../../package.json'

const open = ref(false)
const GITHUB_REPO = 'https://github.com/ilystack/DBolt'
</script>

<template>
  <DropdownMenu v-model:open="open">
    <DropdownMenuTrigger as-child>
      <button
        class="mx-auto rounded-lg flex h-9 w-9 cursor-pointer transition-colors items-center justify-center relative focus:outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
        title="DBolt"
      >
        <span
          class="flex h-8 w-8 items-center justify-center overflow-hidden"
        >
          <img
            src="/app-icon.png"
            alt="DBolt"
            class="h-full w-full object-contain"
          >
        </span>
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent side="right" align="start" class="p-1.5 w-56">
      <div class="px-2 py-1.5 flex items-center justify-between">
        <span class="text-sm text-foreground font-semibold">
          DBolt
        </span>
        <span class="text-xs text-muted-foreground font-mono">
          v{{ version }}
        </span>
      </div>
      <DropdownMenuSeparator />
      <DropdownMenuItem class="cursor-pointer" @click="openUrl(GITHUB_REPO)">
        <ExternalLink class="mr-2 h-4 w-4" />
        GitHub Repository
      </DropdownMenuItem>
      <DropdownMenuItem class="cursor-pointer" @click="openUrl(`${GITHUB_REPO}/releases`)">
        <Sparkles class="mr-2 h-4 w-4" />
        Releases & Changelog
      </DropdownMenuItem>
      <DropdownMenuItem class="cursor-pointer" @click="openUrl(`${GITHUB_REPO}/issues`)">
        <MessageSquareHeart class="mr-2 h-4 w-4" />
        Report an Issue
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
