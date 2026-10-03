import Link from "next/link";
import { differenceInCalendarDays, format, parseISO } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppShell } from "@/components/layout/AppShell";
import { requireSoyaAdminPage } from "@/features/soya/lib/guard";
import { DashboardFilterBar } from "@/features/dashboard/components/DashboardFilterBar";
import {
  getSoyaParties,
  getSoyaPartyEntries,
  getSoyaPartyPayments,
} from "@/features/soya-parties/service/soya-party.service";
import {
  getSoyaFactories,
  getSoyaFactoryEntries,
  getSoyaFactoryPayments,
} from "@/features/soya-factory/service/soya-factory.service";
import {
  computeOpenBalances,
  ownerKey,
  type OpenBalanceRow,
} from "@/features/soya/lib/open-balances";
import {
  getActiveSoyaCompanyScope,
  getSoyaCompanyScopeFor,
  type SoyaCompanyScope,
} from "@/features/soya/lib/company-scope";
import { getSoyaCompanies } from "@/features/soya-companies/service/soya-company.service";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";
import { isWithinRange, resolvePreset, type DateRange } from "@/lib/date-range";

const CARD =
  "border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100";
const whole = { minimumFractionDigits: 0, maximumFractionDigits: 0 } as const;
const money = (value: number) => formatCurrencyINR(value, { maximumFractionDigits: 0 });
const num = (value: number) => formatNumberIN(value, whole);

function settled<T>(result: PromiseSettledResult<T[]>): T[] {
  return result.status === "fulfilled" ? result.value : [];
}

/** One company's Soya books, read in its own scope. */
async function loadCompanyBooks(scope: SoyaCompanyScope) {
  const results = await Promise.allSettled([
    getSoyaParties(scope),
    getSoyaPartyEntries(scope),
    getSoyaPartyPayments(scope),
    getSoyaFactories(scope),
    getSoyaFactoryEntries(scope),
    getSoyaFactoryPayments(scope),
  ]);
  const [parties, partyEntries, partyPayments, factories, factoryEntries, factoryPayments] =
    results;
  return {
    parties: settled(parties),
    partyEntries: settled(partyEntries),
    partyPayments: settled(partyPayments),
    factories: settled(factories),
    factoryEntries: settled(factoryEntries),
    factoryPayments: settled(factoryPayments),
    // Named so the notice says which side is incomplete rather than "something".
    partiesFailed: [parties, partyEntries, partyPayments].some((r) => r.status === "rejected"),
    factoriesFailed: [factories, factoryEntries, factoryPayments].some(
      (r) => r.status === "rejected",
    ),
  };
}

export default async function SoyaDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    range?: string;
    customer?: string;
    company?: string;
  }>;
}) {
  await requireSoyaAdminPage();
  const filters = await searchParams;

  /**
   * Company-wise by default: the company open in the sidebar, the same one the
   * Factory and Parties screens show. ?company=all adds every company up.
   *
   * Each company is read in its own scope and its balances worked out on its
   * own before anything is added together. A party that owes one firm and has
   * paid another is NOT settled — pooling their bills and payments first would
   * say it was.
   */
  const showAll = filters.company === "all";
  const [activeScope, companies] = await Promise.all([
    getActiveSoyaCompanyScope(),
    getSoyaCompanies().catch(() => []),
  ]);
  const companyName = (id: string) =>
    companies.find((company) => company.id === id)?.name ?? "Unassigned";
  const scopes = showAll
    ? await Promise.all(companies.map((company) => getSoyaCompanyScopeFor(company.id)))
    : [activeScope];
  // With no company created yet, only the unassigned rows exist.
  if (scopes.length === 0) scopes.push(activeScope);

  const books = await Promise.all(
    scopes.map(async (scope) => ({ scope, ...(await loadCompanyBooks(scope)) })),
  );
  const partyEntries = books.flatMap((b) => b.partyEntries);
  const factoryEntries = books.flatMap((b) => b.factoryEntries);
  const partiesFailed = books.some((b) => b.partiesFailed);
  const factoriesFailed = books.some((b) => b.factoriesFailed);

  const nowIst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));

  // Same rules as the maize dashboard: this month by default, "All time" is an
  // explicit ?range=all.
  const range: DateRange =
    filters.range === "all"
      ? { from: "", to: "" }
      : filters.from || filters.to
        ? { from: filters.from ?? "", to: filters.to ?? "" }
        : resolvePreset("this_month", nowIst);

  // Party dropdown: the master plus any name only ever typed on an entry.
  const partyNameByKey = new Map<string, string>();
  for (const entry of partyEntries) {
    const k = ownerKey(entry.party);
    if (k && !partyNameByKey.has(k)) partyNameByKey.set(k, entry.party.trim());
  }
  for (const party of books.flatMap((b) => b.parties)) {
    partyNameByKey.set(ownerKey(party.name), party.name);
  }
  const partyOptions = [...partyNameByKey.values()].sort((a, b) => a.localeCompare(b));
  const customer =
    filters.customer && partyOptions.includes(filters.customer) ? filters.customer : "";
  const customerKey = ownerKey(customer);
  const matchesParty = (name: string) => !customer || ownerKey(name) === customerKey;

  // ---- activity in the selected period
  const periodPurchases = factoryEntries.filter((e) => isWithinRange(e.date, range));
  const periodSales = partyEntries.filter(
    (e) => isWithinRange(e.date, range) && matchesParty(e.party),
  );
  const sum = <T,>(rows: T[], pick: (row: T) => number) =>
    rows.reduce((acc, row) => acc + (pick(row) || 0), 0);

  const purchaseTotal = sum(periodPurchases, (e) => e.total_amount);
  const purchaseTaxable = sum(periodPurchases, (e) => e.amount);
  const salesTotal = sum(periodSales, (e) => e.total_amount);
  const salesTaxable = sum(periodSales, (e) => e.amount);
  const bagsSold = sum(periodSales, (e) => e.bags);
  const bagsBought = sum(periodPurchases, (e) => e.bags);
  const weightSold = sum(periodSales, (e) => e.net_wt);
  const weightBought = sum(periodPurchases, (e) => e.weight);

  // ---- what is open today — never limited by the date filter, and worked
  // out company by company (see above).
  const tagged = (rows: OpenBalanceRow[], scope: SoyaCompanyScope): PendingRow[] =>
    rows.map((row) => ({ ...row, company: showAll ? companyName(scope.companyId) : "" }));
  const byPending = (a: PendingRow, b: PendingRow) => b.pending - a.pending;

  const receivables = books
    .flatMap((b) =>
      tagged(
        computeOpenBalances(
          b.parties,
          b.partyEntries.map((e) => ({ owner: e.party, date: e.date, sl_no: e.sl_no, total: e.total_amount })),
          b.partyPayments.map((p) => ({ ownerId: p.party_id, amount: p.amount })),
        ),
        b.scope,
      ),
    )
    .filter((row) => matchesParty(row.name))
    .sort(byPending);
  const payables = books
    .flatMap((b) =>
      tagged(
        computeOpenBalances(
          b.factories,
          b.factoryEntries.map((e) => ({ owner: e.factory, date: e.date, sl_no: e.sl_no, total: e.total_amount })),
          b.factoryPayments.map((p) => ({ ownerId: p.factory_id, amount: p.amount })),
        ),
        b.scope,
      ),
    )
    .sort(byPending);

  const toReceive = sum(receivables, (r) => r.pending);
  const toReceiveBills = sum(receivables, (r) => r.pendingBillCount);
  const toPay = sum(payables, (r) => r.pending);
  const toPayBills = sum(payables, (r) => r.pendingBillCount);

  // The toggle keeps the date and party filters; the filter bar keeps the toggle.
  const viewHref = (all: boolean) => {
    const params = new URLSearchParams();
    for (const key of ["from", "to", "range", "customer"] as const) {
      const value = filters[key];
      if (value) params.set(key, value);
    }
    if (all) params.set("company", "all");
    const query = params.toString();
    return query ? `/soya/dashboard?${query}` : "/soya/dashboard";
  };

  const isEmpty =
    !partiesFailed && !factoriesFailed && partyEntries.length === 0 && factoryEntries.length === 0;

  return (
    <AppShell>
      <div className="flex flex-col gap-6 text-zinc-100">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">
              Soya Overview · {showAll ? "All companies" : companyName(activeScope.companyId)}
            </h2>
            <p className="text-xs text-zinc-500">
              {showAll
                ? "Every company added together. Balances are worked out per company first."
                : "The company open in the sidebar. Soya data only, separate from Maize."}
            </p>
          </div>
          {companies.length > 1 ? (
            <div
              role="group"
              aria-label="Companies shown"
              className="flex rounded-lg border border-[#2a2d34] bg-[#14161b] p-1 text-sm"
            >
              <CompanyToggleLink href={viewHref(false)} active={!showAll}>
                {companyName(activeScope.companyId)}
              </CompanyToggleLink>
              <CompanyToggleLink href={viewHref(true)} active={showAll}>
                All companies
              </CompanyToggleLink>
            </div>
          ) : null}
        </div>

        <DashboardFilterBar
          range={range}
          customer={customer}
          customers={partyOptions}
          today={format(nowIst, "yyyy-MM-dd")}
          matched={periodSales.length}
          total={partyEntries.length}
          customerLabel={{ singular: "party", plural: "parties" }}
          recordLabel="sales bills"
          preserveParams={showAll ? { company: "all" } : undefined}
        />

        {partiesFailed || factoriesFailed ? (
          <p className="-mt-2 rounded-lg border border-[#3b2323] bg-[#1a1111] px-3 py-2 text-xs text-red-200">
            Could not load {partiesFailed && factoriesFailed ? "Party or Factory" : partiesFailed ? "Party" : "Factory"}{" "}
            data, so figures for that side are missing. Refresh the page; if it persists, open{" "}
            {partiesFailed ? "Parties" : "Factory"} to check it loads.
          </p>
        ) : null}

        {customer ? (
          <p className="-mt-2 rounded-lg border border-[#2a3a44] bg-[#0f1a1f] px-3 py-2 text-xs text-sky-200/80">
            Showing <strong className="text-sky-200">{customer}</strong>. Sales and money to
            receive are for this party; purchases and money to pay factories remain
            whole-business.
          </p>
        ) : null}

        {isEmpty ? (
          <Card className={CARD}>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-base font-semibold text-zinc-100">
                {showAll ? "No Soya entries yet" : `No Soya entries for ${companyName(activeScope.companyId)} yet`}
              </p>
              <p className="max-w-md text-sm text-zinc-400">
                Add a factory purchase or a party sale and this dashboard fills in.
                {!showAll && companies.length > 1
                  ? " Entries for another company show when that company is open in the sidebar."
                  : ""}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Link
                  href="/soya/factory/add"
                  className="rounded-lg bg-[#ff6a3d] px-3 py-2 text-sm font-medium text-white hover:bg-[#ff7b52]"
                >
                  Add factory entry
                </Link>
                <Link
                  href="/soya/parties/new"
                  className="rounded-lg border border-[#2a2d34] px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-[#1c1f26]"
                >
                  Add party entry
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Purchase Amount"
            value={money(purchaseTotal)}
            note={`${num(periodPurchases.length)} factory entries · taxable ${money(purchaseTaxable)}`}
          />
          <StatCard
            title="Total Sales Amount"
            value={money(salesTotal)}
            note={`${num(periodSales.length)} bills · taxable ${money(salesTaxable)}`}
          />
          <StatCard
            title="Bags Sold"
            value={num(bagsSold)}
            note={`bought ${num(bagsBought)}`}
          />
          <StatCard
            title="Net Weight Sold"
            value={`${num(weightSold)} kg`}
            note={`bought ${num(weightBought)} kg`}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <StatCard
            title="Pending to Receive (Parties)"
            value={partiesFailed ? "—" : money(toReceive)}
            note={`${num(toReceiveBills)} bills pending from ${num(receivables.length)} parties · all bills as of today`}
          />
          <StatCard
            title="Pending to Pay (Factories)"
            value={factoriesFailed ? "—" : money(toPay)}
            note={`${num(toPayBills)} bills pending to ${num(payables.length)} factories · all bills as of today`}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <PendingTable
            title="Party Pending Summary"
            ownerLabel="Party"
            rows={receivables}
            failed={partiesFailed}
            emptyText={customer ? `${customer} has no pending bills.` : "No pending bills. Every party is fully paid."}
            href={(id) => `/soya/parties/companies/${id}/statement`}
            today={nowIst}
          />
          <PendingTable
            title="Factory Pending Summary"
            ownerLabel="Factory"
            rows={payables}
            failed={factoriesFailed}
            emptyText="Nothing pending. Every factory is fully paid."
            href={(id) => `/soya/factory/parties/${id}/statement`}
            today={nowIst}
          />
        </div>
      </div>
    </AppShell>
  );
}

function CompanyToggleLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={
        active
          ? "rounded-md bg-[#ff6a3d] px-3 py-1.5 font-medium text-white"
          : "rounded-md px-3 py-1.5 text-zinc-400 hover:bg-[#1c1f26] hover:text-zinc-200"
      }
    >
      {children}
    </Link>
  );
}

function StatCard({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <Card className={CARD}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-zinc-400">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-[#ff8f6b]">{value}</div>
        <p className="mt-2 text-xs text-zinc-500">{note}</p>
      </CardContent>
    </Card>
  );
}

const GRID = "grid grid-cols-[1fr_70px_130px_110px] gap-3";

/** A balance row, tagged with its company in the All companies view. */
type PendingRow = OpenBalanceRow & { company: string };

function PendingTable({
  title,
  ownerLabel,
  rows,
  failed,
  emptyText,
  href,
  today,
}: {
  title: string;
  ownerLabel: string;
  rows: PendingRow[];
  failed: boolean;
  emptyText: string;
  href: (id: string) => string;
  today: Date;
}) {
  return (
    <Card className={CARD}>
      <CardHeader>
        <CardTitle className="text-base text-zinc-100">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* No fixed height: every row is always on the page, never hidden
            behind an inner scrollbar. */}
        <div className="overflow-x-auto">
          <div className="min-w-120 space-y-2">
            <div
              className={`${GRID} rounded-md border border-[#2a2d34] bg-[#15171c] px-3 py-2 text-xs uppercase tracking-[0.14em] text-zinc-500`}
            >
              <span>{ownerLabel}</span>
              <span className="text-right">Bills</span>
              <span className="text-right">Pending</span>
              <span className="text-right">Oldest</span>
            </div>
            {failed ? (
              <div className="rounded-md border border-[#3b2323] bg-[#1a1111] p-3 text-sm text-red-200">
                Could not load {ownerLabel.toLowerCase()} data.
              </div>
            ) : rows.length === 0 ? (
              <div className="rounded-md border border-[#2a2d34] bg-[#15171c] p-3 text-sm text-zinc-400">
                {emptyText}
              </div>
            ) : (
              rows.map((row) => {
                const days = differenceInCalendarDays(today, parseISO(row.oldestOpenDate));
                const cells = (
                  <>
                    <span className="min-w-0">
                      <span className="block truncate text-zinc-200" title={row.name}>
                        {row.name}
                      </span>
                      {row.company ? (
                        <span className="block truncate text-xs text-zinc-500">{row.company}</span>
                      ) : null}
                    </span>
                    <span className="text-right text-zinc-400">{row.pendingBillCount}</span>
                    <span className="text-right font-semibold text-zinc-100">{money(row.pending)}</span>
                    <span
                      className="text-right text-zinc-400"
                      title={`Oldest open bill: ${format(parseISO(row.oldestOpenDate), "dd-MM-yyyy")}`}
                    >
                      {days <= 0 ? "today" : `${days} days`}
                    </span>
                  </>
                );
                const rowClass = `${GRID} rounded-md border border-[#2a2d34] bg-[#15171c] px-3 py-2 text-sm`;
                return row.id ? (
                  <Link
                    key={`${row.company}:${row.name}`}
                    href={href(row.id)}
                    className={`${rowClass} transition-colors hover:border-[#ff6a3d]/50`}
                    title="Open statement"
                  >
                    {cells}
                  </Link>
                ) : (
                  <div key={`${row.company}:${row.name}`} className={rowClass}>
                    {cells}
                  </div>
                );
              })
            )}
            {!failed && rows.length > 0 ? (
              <div
                className={`${GRID} border-t border-[#2a2d34] px-3 pt-2 text-sm font-semibold`}
              >
                <span className="text-zinc-400">Total</span>
                <span className="text-right text-zinc-300">
                  {num(rows.reduce((acc, r) => acc + r.pendingBillCount, 0))}
                </span>
                <span className="text-right text-[#ff8f6b]">
                  {money(rows.reduce((acc, r) => acc + r.pending, 0))}
                </span>
                <span />
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
