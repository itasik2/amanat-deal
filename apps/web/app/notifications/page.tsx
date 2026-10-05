'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
const labels: Record<string,string> = {push:'Push',telegram:'Telegram',whatsapp:'WhatsApp',email:'Email',sms:'SMS'};
export default function NotificationsPage(){
  const [state,setState]=useState<{available:boolean;channels:string[]}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function request(path='',method='GET'){
    const response=await fetch('/api/backend/notifications'+path,{method,cache:'no-store',signal:AbortSignal.timeout(20000)});
    if(response.status===401){window.location.href='/login';throw new Error('Войдите в аккаунт');}
    const data=await response.json();if(!response.ok)throw new Error(data.message||'Сервис временно недоступен');return data;
  }
  useEffect(()=>{void request().then(setState).catch(e=>setError(e.message));},[]);
  async function connect(){setBusy(true);setError('');try{const r=await request('/connect','POST');window.location.assign(r.url);}catch(e){setError(e instanceof Error?e.message:'Ошибка');setBusy(false);}}
  return <main className="page narrow"><Link href="/" className="back-link">← Amanat Deal</Link><section className="card spacing-top"><div className="eyebrow">Уведомления</div><h1>Не пропустите важное по сделке</h1><p className="lead">Подключите удобный канал: Push, Telegram, Email, SMS или WhatsApp. Notify KZ поможет настроить и проверить доставку.</p>{error&&<p role="alert">{error}</p>}{state?<><p>Ваш выбор: <strong>{state.channels.length?state.channels.map(c=>labels[c]||c).join(' → '):'уведомления отключены'}</strong></p><button className="button" disabled={busy||!state.available} onClick={()=>void connect()}>{busy?'Открываем…':'Настроить и проверить каналы'}</button>{!state.available&&<p>Интеграция ещё не включена администратором.</p>}</>:!error&&<p>Загрузка настроек…</p>}<p className="muted small spacing-top">Откроется защищённая страница Notify KZ. Дополнительная регистрация не нужна. Вы сможете изменить выбор или отключить все уведомления.</p></section><section className="card spacing-top"><h2>О чём сообщаем</h2><p>Присоединение участника, подтверждение условий, mock-резервирование, отправка результата, начало проверки, проблема и завершение mock-сделки.</p><p className="muted">Amanat работает в mock-режиме: эти уведомления не подтверждают движение реальных денег. WhatsApp для событий доступен после настройки одобренного шаблона сервиса.</p></section></main>;
}
