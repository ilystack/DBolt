import type { PaidFeature } from '../../common'

export type UpgradeDialogOptions = { coverCta?: boolean }

type OpenUpgradeDialogFn = ((feature?: PaidFeature, options?: UpgradeDialogOptions) => void) | null

export function registerUpgradeDialog(_fn: OpenUpgradeDialogFn): void {
  // DBolt: no upgrade dialog registered
}

export function openUpgradeDialog(_feature?: PaidFeature, _options?: UpgradeDialogOptions): void {
  // DBolt: all features free & unlocked
}
