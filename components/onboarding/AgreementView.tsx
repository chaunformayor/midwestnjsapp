import type { Block, Run } from '@/lib/onboarding/agreements'

function Runs({ runs }: { runs: Run[] }) {
  return (
    <>
      {runs.map((r, i) =>
        r.blank ? (
          <span key={i} className="bg-amber-100 text-amber-800 font-semibold rounded px-1 whitespace-nowrap">{r.t}</span>
        ) : r.b ? (
          <b key={i} className="font-semibold">{r.t}</b>
        ) : (
          <span key={i}>{r.t}</span>
        ),
      )}
    </>
  )
}

/** Renders agreement blocks as the client reads them on the page. */
export default function AgreementView({ blocks }: { blocks: Block[] }) {
  return (
    <div className="text-[14px] leading-relaxed text-gray-900 flex flex-col gap-2">
      {blocks.map((bl, i) => {
        switch (bl.k) {
          case 'title':
            return <h3 key={i} className="font-head text-navy text-[21px] mb-2">{bl.text}</h3>
          case 'h':
            return <h4 key={i} className="font-body text-[13px] font-bold tracking-wide text-navy mt-4">{bl.text}</h4>
          case 'p':
            return <p key={i} className="max-w-[72ch]"><Runs runs={bl.runs} /></p>
          case 'ol':
            return <ol key={i} className="list-decimal pl-6 flex flex-col gap-1 max-w-[72ch]">{bl.items.map((it, j) => <li key={j}><Runs runs={it} /></li>)}</ol>
          case 'ul':
            return <ul key={i} className="list-disc pl-6 flex flex-col gap-1 max-w-[72ch]">{bl.items.map((it, j) => <li key={j}><Runs runs={it} /></li>)}</ul>
          case 'table':
            return (
              <div key={i} className="overflow-x-auto my-1">
                <table className="w-full min-w-[460px] border-collapse text-[13px]">
                  <thead>
                    <tr>{bl.head.map((h) => <th key={h} className="text-left px-2.5 py-2 border-b border-gray-200 text-[11px] uppercase tracking-wider text-gray-500 font-bold">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {bl.rows.map((row, r) => (
                      <tr key={r}>{row.map((cell, c) => <td key={c} className="align-top px-2.5 py-2 border-b border-gray-200 tabular-nums"><Runs runs={cell} /></td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          default:
            return null
        }
      })}
    </div>
  )
}
