type PageShellProps = {
  title: string
  description?: string
  children?: React.ReactNode
}

export function PageShell({ title, description, children }: PageShellProps) {
  return (
    <div className="px-10 py-12 max-w-5xl">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-[#1E293B] mb-1">{title}</h1>
        {description && (
          <p className="text-sm text-[#64748B]">{description}</p>
        )}
      </header>
      {children ?? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-[#64748B] shadow-sm">
          이 기능은 곧 제공될 예정입니다.
        </div>
      )}
    </div>
  )
}
