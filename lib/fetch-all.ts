// The database hands back at most 1,000 rows per request — even with a higher
// .limit() — and gives no error when it cuts a list short. Anything that feeds
// a total, a count or an export must read in pages, or figures are silently
// truncated. Same { data, error } shape as a normal query, so call sites only
// change how the query is started.
//
// The query passed in must have a stable order (end it with .order("id")),
// otherwise rows can repeat or go missing between pages.
const PAGE = 1000;

export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ data: T[]; error: null } | { data: null; error: { message: string } }> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return { data: rows, error: null };
  }
}
