export default function CreateDealPage() {
  return (
    <main className="page">
      <div className="card">
        <p className="muted">Черновой экран</p>
        <h1>Создать безопасную сделку</h1>
        <p>Форма будет отправлять данные в API: название, описание, категория, сумма, срок проверки.</p>
        <div className="grid">
          <input placeholder="Название сделки" />
          <input placeholder="Сумма, ₸" />
          <select defaultValue="GOODS"><option value="GOODS">Товар</option><option value="SERVICE">Услуга</option><option value="REPAIR">Ремонт</option><option value="EQUIPMENT">Оборудование</option><option value="OTHER">Другое</option></select>
          <select defaultValue="48"><option value="24">24 часа</option><option value="48">48 часов</option><option value="72">3 дня</option></select>
        </div>
      </div>
    </main>
  );
}
