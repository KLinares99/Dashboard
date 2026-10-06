import { PortalBar } from "@/components/Portal";
import { requireClientUser } from "@/lib/auth";
import "./portal.css";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  await requireClientUser();
  return (
    <div className="ios">
      <PortalBar signOut />
      {children}
    </div>
  );
}
