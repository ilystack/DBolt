import { openUrl } from '@tauri-apps/plugin-opener'

export const DBOLT_BASE_URL = 'https://github.com/ilystack/DBolt'

export async function openLoginUrl(): Promise<void> {
  await openUrl(DBOLT_BASE_URL)
}

export async function openRegisterUrl(): Promise<void> {
  await openUrl(`${DBOLT_BASE_URL}/releases`)
}
