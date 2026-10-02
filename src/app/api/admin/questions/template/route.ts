import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth";
import { CSV_IMPORT_TEMPLATE } from "@/lib/admin/question-import";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const response = new NextResponse(CSV_IMPORT_TEMPLATE);
  response.headers.set("Content-Type", "text/csv; charset=utf-8");
  response.headers.set(
    "Content-Disposition",
    'attachment; filename="aylem-question-bank-template.csv"',
  );
  return response;
}
