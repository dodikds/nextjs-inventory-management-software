"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

type PurchaseReturnsErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function PurchaseReturnsError({ error, reset }: PurchaseReturnsErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="gg-card gg-card-pad" style={{ textAlign: "center", padding: "var(--sp-12) var(--sp-6)" }}>
      <TriangleAlert style={{ width: 40, height: 40, color: "var(--danger)", margin: "0 auto var(--sp-4)" }} />
      <h2 className="gg-card-title" style={{ marginBottom: "var(--sp-2)" }}>
        Something went wrong
      </h2>
      <p className="gg-muted" style={{ marginBottom: "var(--sp-6)" }}>
        We couldn&apos;t load purchase returns right now. This is usually temporary — try again in a moment.
      </p>
      <button className="gg-btn gg-btn--primary" type="button" onClick={() => reset()}>
        Try again
      </button>
    </div>
  );
}
