// frontend/src/app/dashboard/page.tsx
import { redirect } from "next/navigation";

export default function DashboardPage() {
  // permanent redirect to unified tables page
  redirect("/tables");
}
