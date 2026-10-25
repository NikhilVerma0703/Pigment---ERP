import { buildSearchWorkbook } from "@/lib/search/export";
import { parseFilters, parseTab } from "@/lib/search/filters";

export const dynamic = "force-dynamic";

/** GET /api/search/export?tab=…&<filters> → the filtered results as .xlsx. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const tab = parseTab(params);
  try {
    const { buffer, filename } = await buildSearchWorkbook(tab, parseFilters(tab, params));
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("search export failed", err);
    return new Response("The export could not be created.", { status: 500 });
  }
}
