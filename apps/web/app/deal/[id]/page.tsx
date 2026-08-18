export default function DealPage({ params }: { params: { id: string } }) {
  return (
    <main className="page">
      <div className="card">
        <p className="muted">Сделка №{params.id}</p>
        <h1>Карточка сделки</h1>
        <p>Здесь будут условия, сумма, комиссия, статус escrow, доставка, срок проверки и история.</p>
      </div>
    </main>
  );
}
