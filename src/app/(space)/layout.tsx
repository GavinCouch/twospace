import { AccountGate } from "@/components/account-gate";
import { AppShell } from "@/components/app-shell";
export default function SpaceLayout({ children }: { children: React.ReactNode }) {
  return <AccountGate><AppShell>{children}</AppShell></AccountGate>;
}
