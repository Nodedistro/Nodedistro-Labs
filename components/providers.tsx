"use client";
import { useEffect } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { Toaster } from "sonner";
export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    Promise.resolve(useWorkspace.persist.rehydrate()).then(() =>
      useWorkspace.getState().hydrate(),
    ).catch(()=>useWorkspace.getState().hydrate());
  }, []);
  return (
    <>
      {children}
      <Toaster theme="dark" richColors position="bottom-right" />
    </>
  );
}
