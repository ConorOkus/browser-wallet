import { generateMnemonic as generateBip39Mnemonic, validateMnemonic as validateBip39Mnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { idbGet, idbPut } from '../ldk/storage/idb'

const MNEMONIC_KEY = 'primary'

export function generateMnemonic(): string {
  return generateBip39Mnemonic(wordlist, 128)
}

export function validateMnemonic(mnemonic: string): boolean {
  return validateBip39Mnemonic(mnemonic, wordlist)
}

export async function getMnemonic(): Promise<string | undefined> {
  return idbGet<string>('wallet_mnemonic', MNEMONIC_KEY)
}

export async function storeMnemonic(mnemonic: string): Promise<void> {
  const existing = await getMnemonic()
  if (existing) {
    throw new Error('Mnemonic already exists. Refusing to overwrite — this would destroy access to existing funds.')
  }
  await idbPut('wallet_mnemonic', MNEMONIC_KEY, mnemonic)
}
