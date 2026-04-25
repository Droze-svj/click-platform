import Phase9Dashboard from '../../../components/Phase9Dashboard';

export const metadata = {
  title: 'Global Network v9 | Sovereign Omnipresence',
  description: 'Autonomous Distribution & Federated Intelligence Swarm',
};

export default function Phase9Page() {
  return (
    <div className="flex-1 overflow-auto bg-[#080810]">
      <Phase9Dashboard />
    </div>
  );
}
