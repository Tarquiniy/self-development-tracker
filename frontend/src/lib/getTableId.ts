export type GetTableIdClientArgs = {
  propId?: string | null;
  searchParams?: URLSearchParams | null;
  pathname?: string | null;
  href?: string | null;
};

function normalizeId(v: any): string | null {
  const s = v == null ? "" : String(v).trim();
  if (!s) return null;
  if (s === "new" || s === "undefined" || s === "null") return null;
  return s;
}

/**
 * Универсальное извлечение id таблицы для клиентских компонентов.
 *
 * Источники приоритетом:
 *  1) propId (params/[id] -> компоненту)
 *  2) searchParams (id/tableId/table_id)
 *  3) pathname (/tables/:id/...)
 *  4) href (если доступен)
 */
export function getTableIdClient(args: GetTableIdClientArgs): string | null {
  const prop = normalizeId(args.propId);
  if (prop) return prop;

  const sp = args.searchParams;
  if (sp) {
    const fromSp =
      normalizeId(sp.get("id")) ??
      normalizeId(sp.get("tableId")) ??
      normalizeId(sp.get("table_id"));
    if (fromSp) return fromSp;
  }

  const pn = args.pathname ?? "";
  const m = pn.match(/\/tables\/([^/]+)/);
  const fromPathname = normalizeId(m?.[1]);
  if (fromPathname) return fromPathname;

  if (args.href) {
    try {
      const u = new URL(args.href);
      const fromHrefParams =
        normalizeId(u.searchParams.get("id")) ??
        normalizeId(u.searchParams.get("tableId")) ??
        normalizeId(u.searchParams.get("table_id"));
      if (fromHrefParams) return fromHrefParams;

      const fromHrefPath = u.pathname.match(/\/tables\/([^/]+)/)?.[1];
      return normalizeId(fromHrefPath);
    } catch {
      // ignore invalid href
    }
  }

  return null;
}

