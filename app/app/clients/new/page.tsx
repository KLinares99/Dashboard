import { ClientForm } from "@/components/Managers";
import { TopBar } from "@/components/Shell";

export const metadata = { title: "New client" };

export default function NewClientPage() {
  return (
    <>
      <TopBar eyebrow="Clients" title="New client" />
      <main className="view">
        <section className="panel"><div className="panel-b"><ClientForm /></div></section>
      </main>
    </>
  );
}
