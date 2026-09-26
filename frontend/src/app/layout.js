export const metadata = {
  title: 'Kabot — pensamiento que avanza',
  description: 'Un espacio de trabajo conversacional para pensar, decidir y avanzar.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
