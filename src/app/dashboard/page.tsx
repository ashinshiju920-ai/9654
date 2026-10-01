import { DashboardContent } from "./dashboard-content";
import { requireUserOrRedirect } from "@/lib/auth";

export default async function DashboardPage() {
  await requireUserOrRedirect("/login");

  return <DashboardContent />;
}
