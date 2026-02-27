import { Header } from "./Header";
import { SponsorFooter } from "./SponsorFooter";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main
        style={{
          paddingTop: "56px",
          paddingBottom: "40px",
          minHeight: "100vh",
        }}
      >
        {children}
      </main>
      <SponsorFooter />
    </>
  );
}
