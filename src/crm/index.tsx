import { Suspense } from "react";
import CRMPage from "./CRMPage";
import { DarkModeProvider } from "./DarkModeContext";

export default function CRMWorkspace() {
  return (
    <DarkModeProvider>
      <Suspense fallback={<div className="p-6 text-sm text-slate-500">Cargando CRM…</div>}>
        <CRMPage />
      </Suspense>
    </DarkModeProvider>
  );
}
