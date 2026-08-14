import type { Metadata } from "next";

import AdminQuizPage from "@/components/AdminQuizPage";

export const metadata: Metadata = {
  title: "관리자 | 코이노니아 스피드퀴즈"
};

export default function AdminPage() {
  return <AdminQuizPage />;
}
