import type { Metadata } from "next";

import AdminDashboard from "@/components/AdminDashboard";

export const metadata: Metadata = {
  title: "管理后台｜Earthworm Web",
  description: "Earthworm Web 学习账号与课程进度管理后台。",
};

export default function AdminPage() {
  return <AdminDashboard />;
}
