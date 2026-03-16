import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MnemonicWordGrid } from './MnemonicWordGrid'

const TEST_WORDS = [
  'abandon',
  'ability',
  'able',
  'about',
  'above',
  'absent',
  'absorb',
  'abstract',
  'absurd',
  'abuse',
  'access',
  'accident',
]

describe('MnemonicWordGrid', () => {
  it('renders all 12 words with numbering', () => {
    render(<MnemonicWordGrid words={TEST_WORDS} />)
    for (let i = 0; i < TEST_WORDS.length; i++) {
      expect(screen.getByText(`${i + 1}.`)).toBeInTheDocument()
      expect(screen.getByText(TEST_WORDS[i]!)).toBeInTheDocument()
    }
  })

  it('renders correct number of grid items', () => {
    const { container } = render(<MnemonicWordGrid words={TEST_WORDS} />)
    const items = container.querySelectorAll('.grid > div')
    expect(items).toHaveLength(12)
  })
})
