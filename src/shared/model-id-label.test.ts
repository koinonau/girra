import { describe, expect, it } from 'vitest'
import { labelFromModelId } from './model-id-label'

describe('labelFromModelId', () => {
  it('titlecases hyphenated segments', () => {
    expect(labelFromModelId('deepseek-build')).toBe('Deepseek Build')
    expect(labelFromModelId('deepseek')).toBe('Deepseek')
  })

  it('keeps short numeric segments verbatim', () => {
    expect(labelFromModelId('deepseek-4.5')).toBe('Deepseek 4.5')
    expect(labelFromModelId('deepseek-4.5-fast')).toBe('Deepseek 4.5 Fast')
  })

  it('special-cases the gpt segment', () => {
    expect(labelFromModelId('gpt-5.3-codex')).toBe('GPT 5.3 Codex')
    expect(labelFromModelId('GPT-5')).toBe('GPT 5')
  })

  it('splits provider-prefixed ids on the slash', () => {
    expect(labelFromModelId('opencode/deepseek-4.5')).toBe('Opencode Deepseek 4.5')
  })

  it('drops empty segments from repeated or edge separators', () => {
    expect(labelFromModelId('deepseek--4.5')).toBe('Deepseek 4.5')
    expect(labelFromModelId('-deepseek-')).toBe('Deepseek')
    expect(labelFromModelId('')).toBe('')
  })

  it('uppercases only digit-led segments of three characters or fewer', () => {
    expect(labelFromModelId('deepseek-4o')).toBe('Deepseek 4O')
    expect(labelFromModelId('deepseek-2026.07.19')).toBe('Deepseek 2026.07.19')
  })
})
