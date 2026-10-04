const packages = [
  { tokens: "1M", price: "PKR 2,000" },
  { tokens: "3M", price: "PKR 5,000" },
  { tokens: "5M", price: "PKR 7,000" },
  { tokens: "10M", price: "PKR 10,000" },
];

export default function TokenPackagesPanel() {
  return (
    <section
      className="mb-7 rounded-[22px] border border-[#d9ddd2] bg-[#fbf9f3] p-5 sm:p-7"
      data-testid="panel-token-packages"
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[#bd7653]">
            For invited accounts
          </p>
          <h2 className="brand-display mt-2 text-2xl font-bold">
            Token packages
          </h2>
        </div>
        <p className="max-w-xl text-xs leading-5 text-[#74827a]">
          Audio costs 10 tokens per minute. Shorter clips are prorated, with
          partial tokens rounded up to the next whole token.
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {packages.map((item) => (
          <article
            key={item.tokens}
            className="rounded-2xl border border-[#e0ded4] bg-[#f6f4ed] p-4"
            data-testid={`card-token-package-${item.tokens.toLowerCase()}`}
          >
            <p className="font-mono-ui text-xl font-bold tracking-tight text-[#20383c]">
              {item.tokens} <span className="text-sm font-medium">tokens</span>
            </p>
            <p className="mt-2 text-sm font-bold text-[#a96043]">{item.price}</p>
          </article>
        ))}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div
          className="rounded-2xl border border-[#e0ded4] bg-[#f6f4ed] p-4"
          data-testid="payment-jazzcash"
        >
          <p className="font-mono-ui text-[10px] uppercase tracking-[.12em] text-[#7c8982]">
            JazzCash
          </p>
          <a
            href="tel:03081054604"
            className="mt-2 block text-lg font-bold text-[#20383c]"
          >
            03081054604
          </a>
          <p className="mt-1 text-xs text-[#74827a]">Payee: Muhammad Abbas</p>
        </div>
        <div
          className="rounded-2xl border border-[#e0ded4] bg-[#f6f4ed] p-4"
          data-testid="payment-easypaisa"
        >
          <p className="font-mono-ui text-[10px] uppercase tracking-[.12em] text-[#7c8982]">
            EasyPaisa
          </p>
          <a
            href="tel:03282207004"
            className="mt-2 block text-lg font-bold text-[#20383c]"
          >
            03282207004
          </a>
          <p className="mt-1 text-xs text-[#74827a]">Payee: Muhammad Abbas</p>
        </div>
      </div>

      <p className="mt-4 rounded-xl bg-[#eaf0e8] px-4 py-3 text-xs leading-5 text-[#587064]">
        Payments are verified manually. Share your transfer confirmation with
        an administrator; tokens are added after verification. No automatic
        checkout or crediting occurs.
      </p>
    </section>
  );
}