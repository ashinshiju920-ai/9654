import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const csvContent = [
    "question_text,option_a,option_b,option_c,option_d,correct_option,explanation",
    '"Which sentence demonstrates correct subject-verb agreement?","Neither the teacher nor the students was present.","Neither the teacher nor the students were present.","Either of the options are acceptable.","None of the books is missing from shelf.","B","When subjects are connected by neither...nor, the verb agrees with the closer subject (students -> were)."',
    '"What is the primary diagnostic sign of acute appendicitis?","Sudden onset of diffuse left lower quadrant pain","Localized tenderness at McBurneys point in the right lower quadrant","High-grade continuous fever without pain","Pain strictly relieved by heavy solid meals","B","McBurneys point tenderness (two-thirds from the umbilicus to anterior superior iliac spine) is classic for acute appendicitis."',
    '"In automated spoken test scoring, what does lexical resource primarily measure?","Speech rate measured strictly in syllables per minute","Variety, precision, and contextual appropriateness of vocabulary used","Background noise cancellation efficiency","Volume variation throughout continuous speech","B","Lexical resource measures the breadth and accuracy of vocabulary used during oral discourse."',
  ].join("\r\n");

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="aylem-advanced-practice-template.csv"',
    },
  });
}
