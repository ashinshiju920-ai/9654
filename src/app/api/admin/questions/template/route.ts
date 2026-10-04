import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth";
import { generateCsvTemplate } from "@/lib/admin/question-import";

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const { searchParams } = new URL(request.url);
  const courseParam = searchParams.get("course")?.trim().toLowerCase();

  const templateCsv = generateCsvTemplate(courseParam || undefined);
  const filename = courseParam
    ? `aylem-${courseParam}-questions-template.csv`
    : "aylem-question-bank-template.csv";

  const response = new NextResponse(templateCsv);
  response.headers.set("Content-Type", "text/csv; charset=utf-8");
  response.headers.set(
    "Content-Disposition",
    `attachment; filename="${filename}"`,
  );
  return response;
}
