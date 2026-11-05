import { createPinia, setActivePinia } from 'pinia'
import { useEntitlementStore } from '@/store/entitlementStore'
import { isEntitlementError, shouldStripSshTunnel } from '../../src/common/entitlement'

describe('dbolt entitlement store (open source edition)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('guarantees all local and cloud features are permanently unlocked', () => {
    const store = useEntitlementStore()
    expect(store.isLocalUltimate).toBe(true)
    expect(store.isCloudUltimate).toBe(true)
    expect(store.planState).toBe('ultimate')
    expect(store.sessionExpired).toBe(false)
    expect(store.hasEntitlementError).toBe(false)
  })

  it('never strips SSH tunnels when entitlement is active', () => {
    const store = useEntitlementStore()
    expect(shouldStripSshTunnel(true, store.isLocalUltimate)).toBe(false)
    expect(shouldStripSshTunnel(false, store.isLocalUltimate)).toBe(false)
    expect(shouldStripSshTunnel(undefined, store.isLocalUltimate)).toBe(false)
  })

  it('detects entitlement required error types', () => {
    expect(isEntitlementError(new Error('ENTITLEMENT_REQUIRED'))).toBe(true)
    expect(isEntitlementError('ENTITLEMENT_REQUIRED')).toBe(true)
    expect(isEntitlementError('OTHER_ERROR')).toBe(false)
  })

  it('refreshEntitlement always resolves to ok with active view', async () => {
    const store = useEntitlementStore()
    const outcome = await store.refreshEntitlement()
    expect(outcome).toBe('ok')
    expect(store.isLocalUltimate).toBe(true)
  })

  it('attemptSessionRecovery always resolves to recovered', async () => {
    const store = useEntitlementStore()
    const outcome = await store.attemptSessionRecovery()
    expect(outcome).toBe('recovered')
  })
})
