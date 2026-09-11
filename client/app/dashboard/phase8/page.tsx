import Phase8Dashboard from '../../../components/Phase8Dashboard';
// Imported from the module, not the components/ui barrel: this page is a
// SERVER component (it exports `metadata`), and the barrel pulls in
// client-only primitives that use React context — which fails the build at
// page-data collection with "createContext is not a function".
import { PageShell } from '../../../components/ui/page';

export const metadata = {
  title: 'Neural Nexus v8 | Click Engine',
  description: 'Autonomous Omni-Router and Spatial Continuity Ledger',
};

export default function Phase8Page() {
  return (
    // Framed for consistency, not redesigned — these stay demoted to Labs.
    // The background was a hardcoded near-black, so this page rendered as a
    // black slab in light theme; ds-bg-mesh-soft is the themed equivalent.
    <PageShell width="full" flush className="flex-1 overflow-auto ds-bg-mesh-soft">
      <Phase8Dashboard />
    </PageShell>
  );
}
