"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty" style={{ height: "100vh" }}>
      <h1>Something interrupted the workspace.</h1>
      <p>
        Your saved projects are still available. Try loading this page again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
