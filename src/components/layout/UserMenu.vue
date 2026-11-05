<script setup lang="ts">
import { openUrl } from '@tauri-apps/plugin-opener'
import { ExternalLink, MessageSquareHeart, Sparkles } from 'lucide-vue-next'
import { ref } from 'vue'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

const open = ref(false)
const GITHUB_REPO = 'https://github.com/ilystack/DBolt'
</script>

<template>
  <DropdownMenu v-model:open="open">
    <DropdownMenuTrigger as-child>
      <button
        class="mx-auto rounded-md flex h-8 w-8 cursor-pointer transition-transform items-center justify-center relative hover:scale-105"
        title="DBolt — Free & Open Source"
      >
        <span
          class="text-primary-foreground font-bold p-1 rounded-md bg-primary flex h-8 w-8 shadow-sm items-center justify-center overflow-hidden"
        >
          <img
            src="/app-icon.png"
            alt="DBolt"
            class="h-full w-full object-contain"
          >
        </span>
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent side="right" align="start" class="p-2 w-64">
      <div class="p-2">
        <div class="flex items-center justify-between">
          <p class="text-sm text-foreground font-bold">
            DBolt
          </p>
          <span class="text-[10px] text-primary-text font-semibold px-2 py-0.5 border border-primary/30 rounded-full bg-primary/15">
            v1.0.1
          </span>
        </div>
        <p class="text-xs text-muted-foreground mt-1">
          Free & Open-Source Database Client
        </p>
        <div class="text-xs text-emerald-600 font-medium mt-2 px-2 py-1 border border-emerald-500/20 rounded bg-emerald-500/10 flex gap-1.5 items-center dark:text-emerald-400">
          <Sparkles class="shrink-0 h-3.5 w-3.5" />
          <span>All Features Unlocked</span>
        </div>
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
