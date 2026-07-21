import './globals.css';
import '@livekit/components-styles/components';
import '@livekit/components-styles/themes/default';
import ThemeProvider from '@/components/ThemeProvider';

export const metadata = {
    title: 'CallIQ',
    description: 'CallIQ — real-time WebRTC contact center: voice, chat, routing, and analytics',
};

export default function RootLayout({ children }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body>
                <ThemeProvider>{children}</ThemeProvider>
            </body>
        </html>
    );
}
