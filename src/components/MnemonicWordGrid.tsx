interface MnemonicWordGridProps {
  words: string[]
}

export function MnemonicWordGrid({ words }: MnemonicWordGridProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {words.map((word, i) => (
        <div
          key={i}
          className="flex items-center gap-2 rounded-xl bg-dark-elevated px-4 py-3 font-mono text-sm"
        >
          <span className="w-6 text-right text-[var(--color-on-dark-muted)]">{i + 1}.</span>
          <span>{word}</span>
        </div>
      ))}
    </div>
  )
}
