import { DriveSection } from "@/components/DriveSection";
import { TopBar } from "@/components/Shell";
import { portalBundle } from "../data";

export const metadata = { title: "Content" };

export default async function PortalContent({ searchParams }: { searchParams: Promise<{ folder?: string }> }) {
  const [{ folder }, bundle] = await Promise.all([searchParams, portalBundle()]);
  return (
    <>
      <TopBar eyebrow="Client portal" title="Content" />
      <main className="view">
        <section className="hero"><h2>Your <em>content</em>.</h2><p>Posts, reels and graphics we&apos;ve made for you. Tap any item to open it.</p></section>
        <DriveSection client={bundle.client} folder={folder} base="/portal/content" staff={false} />
      </main>
    </>
  );
}
