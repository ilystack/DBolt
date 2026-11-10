<script setup lang="ts">
import { Globe, Laptop, Languages } from 'lucide-vue-next'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CheckCircleTwotone from '@/components/icons/CheckCircleTwotone.vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import { SettingsAbout } from '@/components/settings/about'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
// Separator is rendered inline as a styled div
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/composables/useNotifications'
import { LanguageType, ThemeType, useAppStore } from '@/store/appStore'
import AiSettings from '@/views/setting/ai-settings.vue'
import JreDriverSection from '@/views/setting/jre-driver-section.vue'
import McpBridge from '@/views/setting/mcp-bridge.vue'

const appStore = useAppStore()
const { t, locale: _locale } = useI18n()

// Draft states for General settings (Appearance, Editor, Query)
const draftTheme = ref<ThemeType>(appStore.themeType)
const draftLanguage = ref<LanguageType>(appStore.languageType)

const fontSizeInput = ref(String(appStore.editorConfig.fontSize))
const fontSizeError = ref('')

const tabSizeInput = ref(String(appStore.editorConfig.tabSize))
const tabSizeError = ref('')

const indentWidthInput = ref(String(appStore.editorConfig.indentWidth ?? 2))
const indentWidthError = ref('')

const lineWidthInput = ref(String(appStore.editorConfig.lineWidth ?? 120))
const lineWidthError = ref('')

const draftWordWrap = ref(Boolean(appStore.editorConfig.wordWrap))
const draftShowLineNumbers = ref(Boolean(appStore.editorConfig.showLineNumbers))
const draftShowMinimap = ref(Boolean(appStore.editorConfig.showMinimap))

const defaultLimitInput = ref(String(appStore.queryConfig.defaultLimit))
const defaultLimitError = ref('')

const queryTimeoutInput = ref(String(Math.round(appStore.queryConfig.queryTimeout / 1000)))
const queryTimeoutError = ref('')

const draftAutoSave = ref(Boolean(appStore.queryConfig.autoSave))

const isDirty = computed(() => {
  return (
    draftTheme.value !== appStore.themeType
    || draftLanguage.value !== appStore.languageType
    || fontSizeInput.value !== String(appStore.editorConfig.fontSize)
    || tabSizeInput.value !== String(appStore.editorConfig.tabSize)
    || indentWidthInput.value !== String(appStore.editorConfig.indentWidth ?? 2)
    || lineWidthInput.value !== String(appStore.editorConfig.lineWidth ?? 120)
    || draftWordWrap.value !== Boolean(appStore.editorConfig.wordWrap)
    || draftShowLineNumbers.value !== Boolean(appStore.editorConfig.showLineNumbers)
    || draftShowMinimap.value !== Boolean(appStore.editorConfig.showMinimap)
    || defaultLimitInput.value !== String(appStore.queryConfig.defaultLimit)
    || queryTimeoutInput.value !== String(Math.round(appStore.queryConfig.queryTimeout / 1000))
    || draftAutoSave.value !== Boolean(appStore.queryConfig.autoSave)
  )
})

const hasValidationError = computed(() => {
  return Boolean(
    fontSizeError.value
    || tabSizeError.value
    || indentWidthError.value
    || lineWidthError.value
    || defaultLimitError.value
    || queryTimeoutError.value,
  )
})

// Sync draft with store if store changes externally and user hasn't made dirty edits
watch(
  () => [
    appStore.themeType,
    appStore.languageType,
    appStore.editorConfig,
    appStore.queryConfig,
  ],
  () => {
    if (!isDirty.value) {
      draftTheme.value = appStore.themeType
      draftLanguage.value = appStore.languageType
      fontSizeInput.value = String(appStore.editorConfig.fontSize)
      tabSizeInput.value = String(appStore.editorConfig.tabSize)
      indentWidthInput.value = String(appStore.editorConfig.indentWidth ?? 2)
      lineWidthInput.value = String(appStore.editorConfig.lineWidth ?? 120)
      draftWordWrap.value = Boolean(appStore.editorConfig.wordWrap)
      draftShowLineNumbers.value = Boolean(appStore.editorConfig.showLineNumbers)
      draftShowMinimap.value = Boolean(appStore.editorConfig.showMinimap)
      defaultLimitInput.value = String(appStore.queryConfig.defaultLimit)
      queryTimeoutInput.value = String(Math.round(appStore.queryConfig.queryTimeout / 1000))
      draftAutoSave.value = Boolean(appStore.queryConfig.autoSave)
    }
  },
  { deep: true },
)

// --- Theme ---
const themeOptions = [
  { value: ThemeType.AUTO, label: () => t('pages.settings.general.themes.system') },
  { value: ThemeType.DARK, label: () => t('pages.settings.general.themes.dark') },
  { value: ThemeType.LIGHT, label: () => t('pages.settings.general.themes.light') },
]

const handleThemeChange = (theme: ThemeType) => {
  draftTheme.value = theme
}

// --- Language ---
const languageOptions = [
  {
    value: LanguageType.AUTO,
    iconComponent: Laptop,
    label: () => t('pages.settings.general.languages.auto'),
    desc: 'System / Sistem',
  },
  {
    value: LanguageType.EN_US,
    iconComponent: Globe,
    label: () => t('pages.settings.general.languages.enUS'),
    desc: 'English (US)',
  },
  {
    value: LanguageType.ID_ID,
    iconComponent: Languages,
    label: () => t('pages.settings.general.languages.idID'),
    desc: 'Bahasa Indonesia (ID)',
  },
]

const handleLanguageChange = (lang: LanguageType) => {
  draftLanguage.value = lang
}

function handleFontSizeChange(val: string | number) {
  fontSizeInput.value = String(val)
  const num = Number(val)
  if (!Number.isInteger(num) || num < 8 || num > 32) {
    fontSizeError.value = t('pages.settings.editor.fontSizeError')
  }
  else {
    fontSizeError.value = ''
  }
}

function handleTabSizeChange(val: string | number) {
  tabSizeInput.value = String(val)
  const num = Number(val)
  if (!Number.isInteger(num) || num < 1 || num > 8) {
    tabSizeError.value = t('pages.settings.editor.tabSizeError')
  }
  else {
    tabSizeError.value = ''
  }
}

function handleIndentWidthChange(val: string | number) {
  indentWidthInput.value = String(val)
  const num = Number(val)
  if (!Number.isInteger(num) || num < 1 || num > 8) {
    indentWidthError.value = t('pages.settings.editor.indentWidthError')
  }
  else {
    indentWidthError.value = ''
  }
}

function handleLineWidthChange(val: string | number) {
  lineWidthInput.value = String(val)
  const num = Number(val)
  if (!Number.isInteger(num) || num < 40 || num > 200) {
    lineWidthError.value = t('pages.settings.editor.lineWidthError')
  }
  else {
    lineWidthError.value = ''
  }
}

const toggleWordWrap = () => {
  draftWordWrap.value = !draftWordWrap.value
}
const toggleLineNumbers = () => {
  draftShowLineNumbers.value = !draftShowLineNumbers.value
}
const toggleMinimap = () => {
  draftShowMinimap.value = !draftShowMinimap.value
}

function handleDefaultLimitChange(val: string | number) {
  defaultLimitInput.value = String(val)
  const num = Number(val)
  if (!Number.isInteger(num) || num < 10 || num > 10000) {
    defaultLimitError.value = t('pages.settings.query.defaultLimitError')
  }
  else {
    defaultLimitError.value = ''
  }
}

function handleQueryTimeoutChange(val: string | number) {
  queryTimeoutInput.value = String(val)
  const num = Number(val)
  if (!Number.isInteger(num) || num < 1 || num > 300) {
    queryTimeoutError.value = t('pages.settings.query.queryTimeoutError')
  }
  else {
    queryTimeoutError.value = ''
  }
}

const toggleAutoSave = () => {
  draftAutoSave.value = !draftAutoSave.value
}

// --- Apply changes ---
const recentlySaved = ref(false)
let savedTimer: ReturnType<typeof setTimeout> | null = null

onUnmounted(() => {
  if (savedTimer) {
    clearTimeout(savedTimer)
  }
})

function handleApply() {
  if (hasValidationError.value || !isDirty.value) {
    return
  }

  const parsedFontSize = Number(fontSizeInput.value)
  const parsedTabSize = Number(tabSizeInput.value)
  const parsedIndentWidth = Number(indentWidthInput.value)
  const parsedLineWidth = Number(lineWidthInput.value)
  const parsedDefaultLimit = Number(defaultLimitInput.value)
  const parsedQueryTimeout = Number(queryTimeoutInput.value) * 1000

  if (draftTheme.value !== appStore.themeType) {
    appStore.setThemeType(draftTheme.value)
  }
  if (draftLanguage.value !== appStore.languageType) {
    appStore.setLanguageType(draftLanguage.value)
  }

  appStore.setEditorConfig({
    fontSize: parsedFontSize,
    tabSize: parsedTabSize,
    indentWidth: parsedIndentWidth,
    lineWidth: parsedLineWidth,
    wordWrap: draftWordWrap.value,
    showLineNumbers: draftShowLineNumbers.value,
    showMinimap: draftShowMinimap.value,
  })

  appStore.setDefaultLimit(parsedDefaultLimit)
  appStore.setQueryTimeout(parsedQueryTimeout)
  appStore.setAutoSave(draftAutoSave.value)

  recentlySaved.value = true
  if (savedTimer) {
    clearTimeout(savedTimer)
  }
  savedTimer = setTimeout(() => {
    recentlySaved.value = false
  }, 3000)

  toast.success(t('pages.settings.feedback.saved'))
}
</script>

<template>
  <AppLayout>
    <div class="flex flex-col h-full">
      <!-- Header -->
      <header class="px-6 py-3 border-b border-border/40 bg-background top-0 sticky z-10">
        <div class="mx-auto flex gap-3 max-w-4xl items-center">
          <h1 class="text-xl font-semibold">
            {{ t('pages.settings.title') }}
          </h1>
          <span class="text-muted-foreground">|</span>
          <span class="text-sm text-muted-foreground">{{ t('pages.settings.subtitle') }}</span>
          <div class="ml-auto flex items-center">
            <Button
              v-if="isDirty"
              size="sm"
              :disabled="hasValidationError"
              @click="handleApply"
            >
              {{ t('pages.settings.general.apply') }}
            </Button>
            <span
              v-else-if="recentlySaved"
              class="text-xs text-muted-foreground flex gap-1.5 items-center"
              role="status"
            >
              <CheckCircleTwotone class="text-success h-4 w-4" aria-hidden="true" />
              {{ t('pages.settings.feedback.saved') }}
            </span>
          </div>
        </div>
      </header>

      <!-- Tabbed settings content -->
      <Tabs
        default-value="general"
        class="px-6 py-4 flex-1 overflow-y-auto"
      >
        <div class="mx-auto max-w-4xl">
          <TabsList class="mb-6 flex-wrap h-auto max-w-full justify-start">
            <TabsTrigger value="general">
              {{ t('pages.settings.general.title') }}
            </TabsTrigger>
            <TabsTrigger value="ai" class="gap-1.5">
              {{ t('pages.settings.ai.tabLabel') }}
            </TabsTrigger>
            <TabsTrigger value="mcp" class="gap-1.5">
              {{ t('pages.settings.mcp.title') }}
            </TabsTrigger>
            <TabsTrigger value="jre">
              {{ t('pages.settings.jre.title') }}
            </TabsTrigger>
            <TabsTrigger value="about">
              {{ t('pages.settings.about.title') }}
            </TabsTrigger>
          </TabsList>

          <!-- General Tab: Appearance + Editor + Query Execution -->
          <TabsContent value="general" class="mt-0 space-y-6">
            <Card>
              <CardContent class="p-6 space-y-6">
                <!-- Theme selector -->
                <div class="space-y-3">
                  <Label>{{ t('pages.settings.general.theme') }}</Label>
                  <div class="gap-4 grid grid-cols-3">
                    <button
                      v-for="opt in themeOptions"
                      :key="opt.value"
                      class="p-2 border rounded-lg cursor-pointer transition-colors relative focus:outline-none focus-visible:ring-1 focus-visible:ring-ring text-left"
                      :class="draftTheme === opt.value
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:border-muted-foreground/60 bg-card'"
                      @click="handleThemeChange(opt.value)"
                    >
                      <div class="mb-2 rounded flex h-24 overflow-hidden relative">
                        <div
                          v-for="mode in opt.value === ThemeType.AUTO ? [ThemeType.DARK, ThemeType.LIGHT] : [opt.value]"
                          :key="mode"
                          class="theme-preview bg-background flex flex-1 h-full overflow-hidden"
                          :class="mode === ThemeType.LIGHT ? 'light' : 'dark'"
                          aria-hidden="true"
                        >
                          <div class="p-1 bg-chrome flex flex-col gap-1 w-6">
                            <div v-for="item in 3" :key="item" class="rounded-sm bg-muted-foreground/40 h-3 w-3" />
                          </div>
                          <div class="p-2 flex-1 space-y-1.5">
                            <div class="rounded bg-muted-foreground/30 h-2" />
                            <div class="rounded bg-muted-foreground/30 h-2 w-3/4" />
                            <div class="rounded bg-muted-foreground/30 h-2 w-1/2" />
                            <div class="rounded bg-muted h-2 w-5/6" />
                          </div>
                        </div>

                        <!-- Active state: icon ant-design:check-circle-twotone besar di tengah preview tanpa background luar -->
                        <div
                          v-if="draftTheme === opt.value"
                          class="inset-0 absolute flex items-center justify-center pointer-events-none"
                        >
                          <CheckCircleTwotone class="h-12 w-12 text-primary drop-shadow" />
                        </div>
                      </div>

                      <p class="text-xs font-medium text-center" :class="draftTheme === opt.value ? 'text-primary font-semibold' : 'text-foreground'">
                        {{ opt.label() }}
                      </p>
                    </button>
                  </div>
                </div>

                <!-- Divider -->
                <div class="border-t border-border/60" />

                <!-- Language selector -->
                <div class="space-y-3">
                  <div>
                    <Label class="text-sm font-medium">{{ t('pages.settings.general.language') }}</Label>
                    <p class="text-xs text-muted-foreground mt-0.5">
                      {{ t('pages.settings.general.languageHelp') }}
                    </p>
                  </div>

                  <div class="gap-4 grid grid-cols-3">
                    <button
                      v-for="opt in languageOptions"
                      :key="opt.value"
                      type="button"
                      class="p-4 border rounded-lg cursor-pointer transition-colors relative flex flex-col items-center justify-center text-center min-h-[120px] focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      :class="draftLanguage === opt.value
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:border-muted-foreground/60 bg-card'"
                      @click="handleLanguageChange(opt.value)"
                    >
                      <!-- Center icon: besar dan tanpa background luar saat aktif -->
                      <div class="mb-2 flex items-center justify-center">
                        <CheckCircleTwotone
                          v-if="draftLanguage === opt.value"
                          class="h-10 w-10 text-primary"
                        />
                        <component
                          :is="opt.iconComponent"
                          v-else
                          class="h-7 w-7 text-muted-foreground"
                        />
                      </div>

                      <p class="text-sm font-medium" :class="draftLanguage === opt.value ? 'text-primary font-semibold' : 'text-foreground'">
                        {{ opt.label() }}
                      </p>
                      <p class="text-xs text-muted-foreground mt-0.5">
                        {{ opt.desc }}
                      </p>
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{{ t('pages.settings.editor.title') }}</CardTitle>
                <CardDescription>{{ t('pages.settings.editor.description') }}</CardDescription>
              </CardHeader>
              <CardContent class="space-y-5">
                <!-- Font Size -->
                <div class="gap-4 grid grid-cols-2 items-start">
                  <div class="space-y-1">
                    <Label>{{ t('pages.settings.editor.fontSize') }}</Label>
                    <p class="text-xs text-muted-foreground">
                      {{ t('pages.settings.editor.fontSizeHelp') }}
                    </p>
                  </div>
                  <div class="space-y-1">
                    <Input
                      type="number"
                      :model-value="fontSizeInput"
                      min="8"
                      max="32"
                      class="w-28"
                      @update:model-value="handleFontSizeChange($event)"
                    />
                    <p v-if="fontSizeError" class="text-xs text-destructive-text">
                      {{ fontSizeError }}
                    </p>
                  </div>
                </div>

                <!-- Tab Size -->
                <div class="gap-4 grid grid-cols-2 items-start">
                  <div class="space-y-1">
                    <Label>{{ t('pages.settings.editor.tabSize') }}</Label>
                    <p class="text-xs text-muted-foreground">
                      {{ t('pages.settings.editor.tabSizeHelp') }}
                    </p>
                  </div>
                  <div class="space-y-1">
                    <Input
                      type="number"
                      :model-value="tabSizeInput"
                      min="1"
                      max="8"
                      class="w-28"
                      @update:model-value="handleTabSizeChange($event)"
                    />
                    <p v-if="tabSizeError" class="text-xs text-destructive-text">
                      {{ tabSizeError }}
                    </p>
                  </div>
                </div>

                <!-- Indent Width -->
                <div class="gap-4 grid grid-cols-2 items-start">
                  <div class="space-y-1">
                    <Label>{{ t('pages.settings.editor.indentWidth') }}</Label>
                    <p class="text-xs text-muted-foreground">
                      {{ t('pages.settings.editor.indentWidthHelp') }}
                    </p>
                  </div>
                  <div class="space-y-1">
                    <Input
                      type="number"
                      :model-value="indentWidthInput"
                      min="1"
                      max="8"
                      class="w-28"
                      @update:model-value="handleIndentWidthChange($event)"
                    />
                    <p v-if="indentWidthError" class="text-xs text-destructive-text">
                      {{ indentWidthError }}
                    </p>
                  </div>
                </div>

                <!-- Line Width -->
                <div class="gap-4 grid grid-cols-2 items-start">
                  <div class="space-y-1">
                    <Label>{{ t('pages.settings.editor.lineWidth') }}</Label>
                    <p class="text-xs text-muted-foreground">
                      {{ t('pages.settings.editor.lineWidthHelp') }}
                    </p>
                  </div>
                  <div class="space-y-1">
                    <Input
                      type="number"
                      :model-value="lineWidthInput"
                      min="40"
                      max="200"
                      class="w-28"
                      @update:model-value="handleLineWidthChange($event)"
                    />
                    <p v-if="lineWidthError" class="text-xs text-destructive-text">
                      {{ lineWidthError }}
                    </p>
                  </div>
                </div>

                <!-- Word Wrap -->
                <div class="flex items-center justify-between">
                  <div class="space-y-1">
                    <Label>{{ t('pages.settings.editor.wordWrap') }}</Label>
                    <p class="text-xs text-muted-foreground">
                      {{ t('pages.settings.editor.wordWrapHelp') }}
                    </p>
                  </div>
                  <button
                    class="border-2 border-transparent rounded-full inline-flex flex-shrink-0 h-6 w-11 cursor-pointer transition-colors relative focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    :class="draftWordWrap ? 'bg-primary' : 'bg-muted'"
                    role="switch"
                    :aria-checked="draftWordWrap"
                    @click="toggleWordWrap"
                  >
                    <span
                      class="rounded-full bg-background h-5 w-5 inline-block pointer-events-none shadow transition-transform"
                      :class="draftWordWrap ? 'translate-x-5' : 'translate-x-0'"
                    />
                  </button>
                </div>

                <!-- Show Line Numbers -->
                <div class="flex items-center justify-between">
                  <div class="space-y-1">
                    <Label>{{ t('pages.settings.editor.showLineNumbers') }}</Label>
                    <p class="text-xs text-muted-foreground">
                      {{ t('pages.settings.editor.showLineNumbersHelp') }}
                    </p>
                  </div>
                  <button
                    class="border-2 border-transparent rounded-full inline-flex flex-shrink-0 h-6 w-11 cursor-pointer transition-colors relative focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    :class="draftShowLineNumbers ? 'bg-primary' : 'bg-muted'"
                    role="switch"
                    :aria-checked="draftShowLineNumbers"
                    @click="toggleLineNumbers"
                  >
                    <span
                      class="rounded-full bg-background h-5 w-5 inline-block pointer-events-none shadow transition-transform"
                      :class="draftShowLineNumbers ? 'translate-x-5' : 'translate-x-0'"
                    />
                  </button>
                </div>

                <!-- Show Minimap -->
                <div class="flex items-center justify-between">
                  <div class="space-y-1">
                    <Label>{{ t('pages.settings.editor.showMinimap') }}</Label>
                    <p class="text-xs text-muted-foreground">
                      {{ t('pages.settings.editor.showMinimapHelp') }}
                    </p>
                  </div>
                  <button
                    class="border-2 border-transparent rounded-full inline-flex flex-shrink-0 h-6 w-11 cursor-pointer transition-colors relative focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    :class="draftShowMinimap ? 'bg-primary' : 'bg-muted'"
                    role="switch"
                    :aria-checked="draftShowMinimap"
                    @click="toggleMinimap"
                  >
                    <span
                      class="rounded-full bg-background h-5 w-5 inline-block pointer-events-none shadow transition-transform"
                      :class="draftShowMinimap ? 'translate-x-5' : 'translate-x-0'"
                    />
                  </button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{{ t('pages.settings.query.title') }}</CardTitle>
                <CardDescription>{{ t('pages.settings.query.description') }}</CardDescription>
              </CardHeader>
              <CardContent class="space-y-5">
                <!-- Default Row Limit -->
                <div class="gap-4 grid grid-cols-2 items-start">
                  <div class="space-y-1">
                    <Label>{{ t('pages.settings.query.defaultLimit') }}</Label>
                    <p class="text-xs text-muted-foreground">
                      {{ t('pages.settings.query.defaultLimitHelp') }}
                    </p>
                  </div>
                  <div class="space-y-1">
                    <Input
                      type="number"
                      :model-value="defaultLimitInput"
                      min="10"
                      max="10000"
                      class="w-32"
                      @update:model-value="handleDefaultLimitChange($event)"
                    />
                    <p v-if="defaultLimitError" class="text-xs text-destructive-text">
                      {{ defaultLimitError }}
                    </p>
                  </div>
                </div>

                <!-- Query Timeout -->
                <div class="gap-4 grid grid-cols-2 items-start">
                  <div class="space-y-1">
                    <Label>{{ t('pages.settings.query.queryTimeout') }}</Label>
                    <p class="text-xs text-muted-foreground">
                      {{ t('pages.settings.query.queryTimeoutHelp') }}
                    </p>
                  </div>
                  <div class="space-y-1">
                    <Input
                      type="number"
                      :model-value="queryTimeoutInput"
                      min="1"
                      max="300"
                      class="w-32"
                      @update:model-value="handleQueryTimeoutChange($event)"
                    />
                    <p v-if="queryTimeoutError" class="text-xs text-destructive-text">
                      {{ queryTimeoutError }}
                    </p>
                  </div>
                </div>

                <!-- Auto Save -->
                <div class="flex items-center justify-between">
                  <div class="space-y-1">
                    <Label>{{ t('pages.settings.query.autoSave') }}</Label>
                    <p class="text-xs text-muted-foreground">
                      {{ t('pages.settings.query.autoSaveHelp') }}
                    </p>
                  </div>
                  <button
                    class="border-2 border-transparent rounded-full inline-flex flex-shrink-0 h-6 w-11 cursor-pointer transition-colors relative focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    :class="draftAutoSave ? 'bg-primary' : 'bg-muted'"
                    role="switch"
                    :aria-checked="draftAutoSave"
                    @click="toggleAutoSave"
                  >
                    <span
                      class="rounded-full bg-background h-5 w-5 inline-block pointer-events-none shadow transition-transform"
                      :class="draftAutoSave ? 'translate-x-5' : 'translate-x-0'"
                    />
                  </button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <!-- AI Tab -->
          <TabsContent value="ai" class="mt-0">
            <AiSettings />
          </TabsContent>

          <!-- MCP Bridge Tab -->
          <TabsContent value="mcp" class="mt-0">
            <McpBridge />
          </TabsContent>

          <!-- JRE & Drivers Tab -->
          <TabsContent value="jre" class="mt-0">
            <JreDriverSection />
          </TabsContent>

          <!-- About Tab -->
          <TabsContent value="about" class="mt-0 space-y-6">
            <SettingsAbout />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  </AppLayout>
</template>

<style scoped>
input[type='number']::-webkit-inner-spin-button,
input[type='number']::-webkit-outer-spin-button {
  cursor: pointer;
}
</style>
