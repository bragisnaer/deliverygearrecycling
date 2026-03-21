type MethodologyInput = {
  label: string
  value: string
}

type MethodologyBlockProps = {
  formula: string
  inputs: MethodologyInput[]
}

export default function MethodologyBlock({ formula, inputs }: MethodologyBlockProps) {
  return (
    <details className="rounded-lg border border-border bg-muted/30 p-4 text-[13px]">
      <summary className="cursor-pointer font-mono text-muted-foreground hover:text-foreground">
        Calculation methodology
      </summary>
      <div className="mt-3 space-y-3">
        <p className="font-mono text-foreground">{formula}</p>
        <ul className="space-y-1">
          {inputs.map((input) => (
            <li key={input.label} className="text-muted-foreground">
              <span className="font-semibold text-foreground">{input.label}:</span>{' '}
              {input.value}
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}
