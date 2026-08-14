export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export function paginate<T>(
  [data, total]: [T[], number],
  { page, limit }: { page: number; limit: number },
): Paginated<T> {
  return { data, meta: { page, limit, total } };
}
