import type { SettingsSearchEntry } from './settings-search'
import { translate } from '@/i18n/i18n'
import { translateSearchKeyword } from './settings-search-keywords'
import { createLocalizedCatalog } from '@/i18n/localized-catalog'

export const getAccountsLocationSearchEntries = createLocalizedCatalog(() => [
  {
    title: translate('auto.components.settings.accounts.search.d09fb5ca92', 'Account Location'),
    description: translate(
      'auto.components.settings.accounts.search.b84a5b0c8a',
      'Choose whether provider accounts are inspected and added on this device or in WSL.'
    ),
    keywords: [
      ...translateSearchKeyword('auto.components.settings.accounts.search.06662af91e', 'account'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.593720c17f', 'location'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.bdbd1e668e', 'windows'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.0b4d948eb5', 'wsl'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.488a7e9206', 'linux'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.9f70aa706c', 'provider'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.e02c136ad0', 'auth')
    ]
  }
])

export const getAccountsClaudeSearchEntries = createLocalizedCatalog(() => [
  {
    title: translate('auto.components.settings.accounts.search.75682e1b62', 'Claude Accounts'),
    description: translate(
      'auto.components.settings.accounts.search.dd75a73991',
      'Optional account switching for Claude while preserving shared chat context.'
    ),
    keywords: [
      ...translateSearchKeyword('auto.components.settings.accounts.search.e14049e1a8', 'claude'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.06662af91e', 'account'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.5b3f18ef4a', 'switch'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.8b06729e0f', 'active'),
      ...translateSearchKeyword(
        'auto.components.settings.accounts.search.86edc96bc9',
        'status bar'
      ),
      ...translateSearchKeyword('auto.components.settings.accounts.search.c759741d77', 'quota'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.f2d666a886', 'optional')
    ]
  }
])

export const getAccountsOpencodeSearchEntries = createLocalizedCatalog(() => [
  {
    title: translate(
      'auto.components.settings.accounts.search.6ed1401020',
      'OpenCode Go Session Cookie'
    ),
    description: translate(
      'auto.components.settings.accounts.search.d1d2ae383c',
      'Paste your opencode.ai session cookie for rate limit fetching.'
    ),
    keywords: [
      ...translateSearchKeyword('auto.components.settings.accounts.search.8dcbef1856', 'opencode'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.61f7d1fcbe', 'cookie'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.9c4e40cf6b', 'session'),
      ...translateSearchKeyword(
        'auto.components.settings.accounts.search.e949b08ffb',
        'rate limit'
      ),
      ...translateSearchKeyword('auto.components.settings.accounts.search.86edc96bc9', 'status bar')
    ]
  },
  {
    title: translate(
      'auto.components.settings.accounts.search.4ee2029e9c',
      'OpenCode Go Workspace ID'
    ),
    description: translate(
      'auto.components.settings.accounts.search.38d22ff8d6',
      'Optional workspace ID override if the automatic lookup fails.'
    ),
    keywords: [
      ...translateSearchKeyword('auto.components.settings.accounts.search.8dcbef1856', 'opencode'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.be8b621bdc', 'workspace'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.421c6be25e', 'id'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.7e67d7d1b6', 'wrk'),
      ...translateSearchKeyword(
        'auto.components.settings.accounts.search.e949b08ffb',
        'rate limit'
      ),
      ...translateSearchKeyword('auto.components.settings.accounts.search.86edc96bc9', 'status bar')
    ]
  }
])

export const getAccountsMiniMaxSearchEntries = createLocalizedCatalog(() => [
  {
    title: translate('auto.components.settings.accounts.search.733f9e2a93', 'MiniMax Usage'),
    description: translate(
      'auto.components.settings.accounts.search.f8374c3151',
      'Configure MiniMax usage tracking. Pick the overseas or China endpoint, then paste a session cookie or save an API key that works on either host.'
    ),
    keywords: [
      ...translateSearchKeyword('auto.components.settings.accounts.search.d16378a88f', 'minimax'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.61f7d1fcbe', 'cookie'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.9c4e40cf6b', 'session'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.b2c4e7f1a8', 'endpoint'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.3a9b6d2c4e', 'api key'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.5d8f1a3b7c', 'china'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.7e2a4b8c1d', 'overseas'),
      ...translateSearchKeyword(
        'auto.components.settings.accounts.search.e949b08ffb',
        'rate limit'
      ),
      ...translateSearchKeyword('auto.components.settings.accounts.search.86edc96bc9', 'status bar')
    ]
  }
])

export const getAccountsPaneSearchEntries = createLocalizedCatalog((): SettingsSearchEntry[] => [
  ...getAccountsLocationSearchEntries(),
  ...getAccountsClaudeSearchEntries(),
  ...getAccountsOpencodeSearchEntries(),
  ...getAccountsMiniMaxSearchEntries()
])
