import { NextResponse } from "next/server";

type PdfRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, { params }: PdfRouteProps) {
  const { id } = await params;

  return NextResponse.redirect(new URL(`/api/materials/${id}/download`, request.url), 308);
}
