import Link from "next/link";
import { CircuitBoard } from "lucide-react";
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" className="logo" aria-label="Nodedistro Labs home">
      <span className="logo-mark">
        <CircuitBoard size={21} />
      </span>
      {!compact && (
        <>
          nodedistro<span className="logo-dot"> labs</span>
        </>
      )}
    </Link>
  );
}
