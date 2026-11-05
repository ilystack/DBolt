import type { EntitlementView, SessionPhase } from '../common'
import { invoke } from '@tauri-apps/api/core'
import { defineStore } from 'pinia'
import { useAccountStore } from './accountStore'

export type PlanState = 'ultimate' | 'community' | 'unknown' | 'checking'

const unlockedView: EntitlementView = {
  ultimateActive: true,
  versionLocked: true,
  localUltimate: true,
  appReleaseDate: '2026-01-01',
  ultimateExpiresAt: '2099-12-31T23:59:59Z',
  versionLockHorizon: '2099-12-31T23:59:59Z',
  cancelScheduledAt: null,
  cached: true,
  fetchedAtMs: Date.now(),
  sessionPhase: 'signed-in',
  lastError: null,
}

export const useEntitlementStore = defineStore('entitlement', {
  state: (): {
    view: EntitlementView | null
    sessionLostNotice: number
    sessionRejections: number
  } => ({
    view: null,
    sessionLostNotice: 0,
    sessionRejections: 0,
  }),
  getters: {
    isLocalUltimate: (): boolean => true,
    isCloudUltimate: (): boolean => true,
    planState: (): PlanState => 'ultimate' as PlanState,
    cancelScheduled: (): boolean => false,
    hasEntitlementError: (): boolean => false,
    sessionPhase: (): SessionPhase => 'signed-in',
    sessionExpired: (): boolean => false,
  },
  actions: {
    async clearSessionState(): Promise<void> {
      const accountStore = useAccountStore()
      accountStore.clearAuth()
      this.sessionRejections = 0
      this.view = null
      try {
        await invoke('clear_entitlement')
      }
      catch {}
    },
    async handleSessionLoss(): Promise<void> {
      await this.clearSessionState()
    },
    async resolveSessionRejection(): Promise<void> {},
    async attemptSessionRecovery(): Promise<'recovered' | 'lost'> {
      try {
        await invoke('rotate_session_now', { refreshToken: '' })
      }
      catch {}
      return 'recovered'
    },
    async seedFromHandoff(_payload?: {
      ultimateExpiresAt?: string | null
      versionLockHorizon?: string | null
      cancelScheduledAt?: string | null
    }): Promise<void> {
      const accountStore = useAccountStore()
      if (!accountStore.isLoggedIn) {
        this.view = null
        return
      }
      const revision = accountStore.sessionRevision
      const seeded = await invoke<EntitlementView>('seed_entitlement').catch(() => null)
      if (!accountStore.isLoggedIn || accountStore.sessionRevision !== revision) {
        this.view = null
        return
      }
      this.view = seeded ?? { ...unlockedView }
    },
    async hydrate(): Promise<void> {
      const accountStore = useAccountStore()
      if (!accountStore.isLoggedIn) {
        this.view = null
        return
      }
      const revision = accountStore.sessionRevision
      const cached = await invoke<EntitlementView>('get_entitlement').catch(() => null)
      if (!accountStore.isLoggedIn || accountStore.sessionRevision !== revision) {
        this.view = null
        return
      }
      if (cached?.fetchedAtMs != null) {
        this.view = cached
      }
    },
    async refreshEntitlement(_force = false): Promise<'ok' | 'lost'> {
      const accountStore = useAccountStore()
      const revision = accountStore.sessionRevision
      let view: EntitlementView | null = null
      try {
        view = await invoke<EntitlementView>('refresh_entitlement', {
          token: accountStore.token,
          refreshToken: accountStore.refreshToken || null,
          force: _force,
        })
      }
      catch {}
      if (view?.refreshedSession) {
        const rotated = view.refreshedSession
        accountStore.applySessionRefresh(
          rotated.previous_refresh_token,
          rotated.access_token,
          rotated.refresh_token,
        )
      }
      if (!accountStore.isLoggedIn || accountStore.sessionRevision !== revision) {
        this.view = null
        return 'ok'
      }
      if (view?.sessionPhase === 'expired') {
        this.view = null
        return 'lost'
      }
      this.view = view ?? { ...unlockedView }
      return 'ok'
    },
    async clearCachedEntitlement(): Promise<void> {
      this.view = null
      try {
        await invoke('clear_entitlement')
      }
      catch {}
    },
  },
})
