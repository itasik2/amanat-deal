import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="page">
      <section className="card">
        <p className="muted">Amanat Deal MVP</p>
        <h1>Безопасная сделка без лишнего цирка</h1>
        <p>
          Продавец создаёт условия, покупатель принимает и оплачивает, деньги резервируются,
          а выплата идёт после подтверждения получения или окончания срока проверки.
        </p>
        <Link className="button" href="/deal/create">Создать сделку</Link>
      </section>
      <section className="grid" style={{ marginTop: 16 }}>
        <div className="card"><h3>Деньги защищены</h3><p className="muted">В MVP используется mock-escrow, позже банк.</p></div>
        <div className="card"><h3>Условия фиксируются</h3><p className="muted">История действий и доказательства сохраняются.</p></div>
        <div className="card"><h3>Платформа не судит</h3><p className="muted">Споры идут по соглашению сторон или закону РК.</p></div>
      </section>
    </main>
  );
}
