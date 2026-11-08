/**
 * Badge dourado com a quantidade de candidaturas com contato não liberado.
 * Entra como `badge` de uma aba do PillNavbar. Dourado é fundo; o texto fica
 * escuro (AA). Sem halo/pulso: o número só faz um "pop" curto ao mudar.
 */
export function PendingBadge({ count }: { count: number }) {
  return (
    <span
      key={count}
      className="badge-pop inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-secondary px-1.5 text-[11px] font-bold leading-none tabular-nums text-slate-900"
    >
      <span aria-hidden="true">{count > 99 ? "99+" : count}</span>
      <span className="sr-only">
        {count === 1
          ? " candidatura com contato não liberado"
          : " candidaturas com contato não liberado"}
      </span>
    </span>
  );
}