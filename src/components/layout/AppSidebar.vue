<script setup lang="ts">
import { ArrowUpDown, Bot, FileCode2, Settings } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'
import UserMenu from '@/components/layout/UserMenu.vue'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ProBadge } from '@/components/upgrade'

const route = useRoute()
const showProDots = computed(() => false)

const menuItems = [
  { id: 'connections', label: 'Connections', icon: 'dns', path: '/connections' },
  // free page — only the ER-diagram action inside it is Ultimate-gated
  { id: 'queries', label: 'Queries', icon: 'code', path: '/queries' },
  { id: 'data-studio', label: 'Data Studio', icon: 'smart_toy', path: '/data-studio', gated: false },
  { id: 'transfer', label: 'Data Transfer', icon: 'transfer', path: '/transfer' },
  { id: 'snippets', label: 'Snippets', icon: 'snippets', path: '/snippets' },
  { id: 'history', label: 'History', icon: 'history', path: '/history' },
]

const isActive = (path: string) => route.path === path
const { t } = useI18n()
</script>

<template>
  <aside class="border border-border/80 rounded-xl bg-card/95 flex flex-shrink-0 flex-col h-full w-14 select-none shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-200 z-50 overflow-hidden backdrop-blur-md dark:border-border/80 dark:bg-card/85 dark:shadow-[0_2px_8px_rgba(0,0,0,0.25)]">
    <!-- User identity (app icon mark) -->
    <div class="mx-2 border-b border-border/40 flex shrink-0 h-12 items-center justify-center">
      <UserMenu />
    </div>

    <!-- Navigation -->
    <nav class="px-2 py-3 flex flex-1 flex-col items-center overflow-y-auto space-y-2">
      <TooltipProvider>
        <RouterLink
          v-for="item in menuItems"
          :key="item.id"
          :to="item.path"
          custom
          #="{ navigate }"
        >
          <Tooltip>
            <TooltipTrigger as-child>
              <button
                class="mx-auto rounded-lg flex h-9 w-9 cursor-pointer transition-colors duration-150 items-center justify-center relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                :class="[
                  isActive(item.path)
                    ? 'bg-primary/10 text-primary-text border border-primary/20 shadow-xs font-medium'
                    : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                ]"
                :aria-label="item.label"
                @click="navigate"
              >
                <ProBadge
                  v-if="showProDots && item.gated"
                  size="dot"
                  class="right-0.5 top-0.5 absolute"
                />
                <!-- DNS icon -->
                <svg
                  v-if="item.icon === 'dns'"
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <ellipse cx="12" cy="5" rx="9" ry="3" />
                  <path d="M3 5v14a9 3 0 0 0 18 0V5" />
                  <path d="M3 12a9 3 0 0 0 18 0" />
                </svg>

                <!-- Transfer icon (ArrowUpDown from lucide) -->
                <ArrowUpDown
                  v-if="item.icon === 'transfer'"
                  class="h-5 w-5"
                />

                <!-- Smart Toy / AI icon (Bot from lucide) -->
                <Bot
                  v-if="item.icon === 'smart_toy'"
                  class="h-5 w-5"
                />

                <!-- Code icon -->
                <svg
                  v-if="item.icon === 'code'"
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>

                <!-- History icon -->
                <svg
                  v-if="item.icon === 'history'"
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>

                <!-- Snippets icon (FileCode2 from lucide) -->
                <FileCode2
                  v-if="item.icon === 'snippets'"
                  class="h-5 w-5"
                />

              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{{ item.label }}</p>
            </TooltipContent>
          </Tooltip>
        </RouterLink>
      </TooltipProvider>
    </nav>

    <!-- Bottom actions -->
    <div class="px-2 py-2.5 border-t border-border/40 flex shrink-0 flex-col w-full items-center">
      <TooltipProvider>
        <RouterLink to="/settings" custom #="{ navigate }">
          <Tooltip>
            <TooltipTrigger as-child>
              <button
                class="rounded-lg flex h-9 w-9 cursor-pointer transition-colors duration-150 items-center justify-center relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                :class="[
                  isActive('/settings')
                    ? 'bg-primary/10 text-primary-text border border-primary/20 shadow-xs font-medium'
                    : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                ]"
                :aria-label="t('common.settings')"
                @click="navigate"
              >
                <Settings class="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{{ t('common.settings') }}</p>
            </TooltipContent>
          </Tooltip>
        </RouterLink>
      </TooltipProvider>
    </div>
  </aside>
</template>
