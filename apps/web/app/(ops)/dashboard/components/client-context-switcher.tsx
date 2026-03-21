type Client = {
  id: string
  name: string
}

type ClientContextSwitcherProps = {
  clients: Client[]
  activeClientId?: string
}

export default function ClientContextSwitcher({
  clients,
  activeClientId,
}: ClientContextSwitcherProps) {
  return (
    <form method="GET" action="/dashboard" className="flex items-center gap-2">
      <select
        name="client"
        defaultValue={activeClientId ?? ''}
        className="rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-[13px]"
      >
        <option value="">All clients</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded-lg bg-foreground px-3 py-1.5 font-mono text-[13px] text-background"
      >
        Filter
      </button>
    </form>
  )
}
