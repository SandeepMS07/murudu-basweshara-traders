/**
 * Shown when a Soya invoicing screen cannot load because its migration has not
 * been run.
 *
 * Names the file to run rather than surfacing a PostgREST error. The two
 * migrations land in order, so the message says which one is missing based on
 * which table the error mentions — telling someone to run the wrong file is
 * worse than telling them nothing.
 */
export function SoyaSetupNotice({ error }: { error: unknown }) {
  const message = String(error instanceof Error ? error.message : error);

  const missingFile = message.includes("soya_invoice")
    ? "supabase/soya-invoicing.sql"
    : message.includes("soya_items")
      ? "supabase/soya-invoicing.sql"
      : message.includes("soya_companies")
        ? "supabase/soya-companies.sql"
        : "";

  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-[#3b2323] bg-[#1a1111] p-6 text-red-100 shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-300">
        Setup Incomplete
      </p>
      <h1 className="mt-2 text-2xl font-bold">This screen is not ready yet</h1>
      {missingFile ? (
        <>
          <p className="mt-3 text-sm leading-6 text-red-200/90">
            Run this migration in the Supabase SQL editor, then reload:
          </p>
          <code className="mt-2 inline-block rounded-md border border-[#4a2c2c] bg-[#120c0c] px-3 py-1.5 font-mono text-sm text-red-100">
            {missingFile}
          </code>
        </>
      ) : (
        <p className="mt-3 text-sm leading-6 text-red-200/90">{message}</p>
      )}
    </div>
  );
}
