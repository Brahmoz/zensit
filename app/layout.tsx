import './globals.css';
import { Metadata } from 'next';
import EmergencyListener from './components/EmergencyListener';

export const metadata: Metadata = {
  title: 'Zensit',
  description: 'Allergy Monitoring Suite',
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#000000" />
      </head>
      <body className="bg-gray-50 text-gray-900 font-sans">
        {children}
        <EmergencyListener />
      </body>
    </html>
  );
}
