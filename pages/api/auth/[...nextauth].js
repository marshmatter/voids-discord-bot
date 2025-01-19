import NextAuth from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';

export default NextAuth({
    providers: [
        DiscordProvider({
            clientId: process.env.DISCORD_CLIENT_ID,
            clientSecret: process.env.DISCORD_CLIENT_SECRET,
            authorization: {
                params: {
                    scope: 'identify guilds guilds.members.read',
                },
            },
        }),
    ],
    callbacks: {
        async jwt({ token, account, user, trigger, session }) {
            if (account) {
                token.accessToken = account.access_token;
            }
            // Handle theme updates
            if (trigger === 'update' && session?.theme) {
                token.theme = session.theme;
            }
            return token;
        },
        async session({ session, token }) {
            session.accessToken = token.accessToken;
            session.theme = token.theme || 'light'; // Default theme
            return session;
        },
    },
}); 