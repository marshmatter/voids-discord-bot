import '../styles/globals.css'
import { NextUIProvider } from "@nextui-org/react";
import { SessionProvider, useSession } from 'next-auth/react';
import { useEffect } from 'react';

// Create a wrapper component that uses useSession
function ThemeHandler({ children }) {
  const { data: sessionData } = useSession();

  useEffect(() => {
    if (sessionData?.theme) {
      document.documentElement.className = sessionData.theme;
    }
  }, [sessionData?.theme]);

  return children;
}

function MyApp({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <NextUIProvider>
        <ThemeHandler>
          <Component {...pageProps} />
        </ThemeHandler>
      </NextUIProvider>
    </SessionProvider>
  );
}

export default MyApp 