import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function Login() {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (session) {
            // Redirect to dashboard if already logged in
            router.push('/dashboard');
        }
    }, [session, router]);

    if (status === 'loading') {
        return <div>Loading...</div>;
    }

    return (
        <div className="flex min-h-screen items-center justify-center">
            <button
                onClick={() => signIn('discord')}
                className="bg-[#5865F2] text-white px-6 py-3 rounded-md flex items-center gap-2 hover:bg-[#4752C4]"
            >
                <img src="/discord-logo.svg" alt="Discord" className="w-6 h-6" />
                Login with Discord
            </button>
        </div>
    );
} 