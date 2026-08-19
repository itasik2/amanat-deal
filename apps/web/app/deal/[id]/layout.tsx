import './extras.css';
import { DealExtras } from './DealExtras';

export default function DealLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <DealExtras />
    </>
  );
}
