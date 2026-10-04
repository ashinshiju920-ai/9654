import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import {
  parseAdvancedCsvRows,
  validateAdvancedImportRows,
} from "@/lib/admin/advanced-import";

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const { collectionId, csvText, rows } = body as {
    collectionId?: string;
    csvText?: string;
    rows?: Array<Record<string, string>>;
  };

  if (!collectionId || typeof collectionId !== "string" || !collectionId.trim()) {
    return NextResponse.json(
      { error: "Target Advanced Collection is required." },
      { status: 400 },
    );
  }

  try {
    let rawRows: Array<Record<string, string>> = [];

    if (Array.isArray(rows)) {
      rawRows = rows;
    } else if (typeof csvText === "string") {
      rawRows = parseAdvancedCsvRows(csvText);
    } else {
      return NextResponse.json(
        { error: "Either csvText or rows array must be provided." },
        { status: 400 },
      );
    }

    const validationResult = await validateAdvancedImportRows(
      collectionId.trim(),
      rawRows,
    );

    return NextResponse.json(validationResult);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to validate CSV." },
      { status: 400 },
    );
  }
}
