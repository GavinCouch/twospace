import type { Metadata } from "next";
import ForgotPassword from "@/features/auth/forgot-password";

export const metadata: Metadata = { title: "Reset password", robots: { index: false, follow: false } };
export default function ForgotPasswordPage() { return <ForgotPassword />; }
