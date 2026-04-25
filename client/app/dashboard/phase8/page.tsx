import Phase8Dashboard from '../../../components/Phase8Dashboard';

export const metadata = {
  title: 'Neural Nexus v8 | Click Engine',
  description: 'Autonomous Omni-Router and Spatial Continuity Ledger',
};

export default function Phase8Page() {
  return (
    <div className="flex-1 overflow-auto bg-black">
      <Phase8Dashboard />
    </div>
  );
}
