import CRMPage from "./CRMPage";
import { DarkModeProvider } from "./DarkModeContext";
import { UserProvider } from "./UserContext";

export default function CRMWorkspace() {
  return (
    <UserProvider>
      <DarkModeProvider>
        <CRMPage />
      </DarkModeProvider>
    </UserProvider>
  );
}
