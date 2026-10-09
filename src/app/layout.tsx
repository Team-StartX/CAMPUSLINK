import type { Metadata } from 'next';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/effect-creative';
import 'swiper/css/navigation';
import './globals.css';
import './auth.css';
import './admin.css';
import './directory.css';
import './preparation.css';
import './workspace.css';
import './dashboard.css';
import './communication.css';
import './contest-progress.css';
import './public-nav.css';
import './documents.css';
import './insights.css';
import './dashboard-theme.css';
import './analytics-charts.css';
import { Providers } from '@/components/providers';
import { Platform } from '@/components/platform';
export const metadata: Metadata = {
  title: 'CampusLink — Your potential. Your next chapter.',
  description:
    'Build verified skills, discover opportunities, and take the next step in your career. A connected campus placement ecosystem.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* Browser extensions can add attributes to body before React hydrates. */}
      <body suppressHydrationWarning>
        <Providers>
          <Platform />
          {children}
        </Providers>
      </body>
    </html>
  );
}
