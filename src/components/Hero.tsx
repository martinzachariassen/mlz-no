import { Identity } from "./Identity";
import { PageShell } from "./PageShell";

// The home page: the identity centrepiece inside the shared page shell (which
// supplies the background, TopBar and Footer, also used by the 404 page).
export function Hero() {
  return (
    <PageShell>
      <Identity />
    </PageShell>
  );
}
