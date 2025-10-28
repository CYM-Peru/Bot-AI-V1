import { Suspense } from "react";
import CRMPage from "./CRMPage";

export default function CRMWorkspace() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Cargando CRM…</div>}>
      <CRMPage />
    </Suspense>
  );
}
