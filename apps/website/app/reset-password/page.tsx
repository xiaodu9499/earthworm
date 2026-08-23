import type { Metadata } from "next";

import ResetPasswordForm from "@/components/ResetPasswordForm";

export const metadata: Metadata = {
  title: "设置新密码｜Earthworm Web",
  description: "安全设置 Earthworm Web 账号的新密码。",
};

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
