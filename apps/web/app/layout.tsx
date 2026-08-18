import './styles.css';

export const metadata = {
  title: 'Amanat Deal',
  description: 'Безопасные сделки с доказательной базой'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
