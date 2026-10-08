/** Read ordered batches instead of trusting a limit above the API's row cap. */
export async function fetchAllRows<T, E>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: E | null }>,
  cancelled: () => boolean = () => false,
) {
  const data: T[] = [];
  const size = 200;
  while (!cancelled()) {
    const result = await page(data.length, data.length + size - 1);
    if (result.error) return { data: null, error: result.error };
    const rows = result.data || [];
    data.push(...rows);
    if (rows.length < size) break;
  }
  return { data, error: null };
}
