// frontend/src/app/api/tables/[id]/grid/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const tableId = params.id;
  const url = new URL(req.url);
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  if (!start || !end) return NextResponse.json({ error: 'missing_range' }, { status: 400 });

  try {
    const cats = await supabaseAdmin.from('tables_categories').select('*').eq('table_id', tableId).order('created_at');
    if (cats.error) return NextResponse.json({ error: cats.error.message }, { status: 500 });

    const cells = await supabaseAdmin
      .from('category_cells')
      .select('*')
      .eq('table_id', tableId)
      .gte('day', start)
      .lte('day', end);
    if (cells.error) return NextResponse.json({ error: cells.error.message }, { status: 500 });

    return NextResponse.json({ data: { categories: cats.data ?? [], cells: cells.data ?? [] } });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
