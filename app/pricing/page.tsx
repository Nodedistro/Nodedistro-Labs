import { PublicNav } from "@/app/page";
import { PricingCards } from "@/components/workspace/pricing";
export default function Page() {
  return (
    <div className="public">
      <PublicNav />
      <main className="public-section" style={{ paddingTop: 55 }}>
        <div className="eyebrow">BUILT FOR YOUR NEXT CHAPTER</div>
        <h1 style={{ fontSize: 52, marginTop: 18 }}>
          A little room to experiment.
          <br />A lot of room to grow.
        </h1>
        <p className="section-copy">
          Start with a local demo, then connect your workspace to the services
          you need.
        </p>
        <PricingCards />
      </main>
    </div>
  );
}
