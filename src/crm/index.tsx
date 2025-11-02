import { Suspense } from "react";
import CRMPage from "./CRMPage";
import { DarkModeProvider } from "./DarkModeContext";
import { UserProvider } from "./UserContext";

export default function CRMWorkspace() {
  return (
    <UserProvider>
      <DarkModeProvider>
        <Suspense fallback={<div className="p-6 text-sm text-slate-500">Cargando CRM…</div>}>
          <CRMPage />
        </Suspense>
      </DarkModeProvider>
    </UserProvider>
  );
}
