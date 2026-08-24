import type { PageTarget, Profile } from '../lib/types'
import raw from './targets.json' with { type: 'json' }

export const PAGES = raw.pages as PageTarget[]
export const PROFILES = raw.profiles as Profile[]
