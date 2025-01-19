import { getSession } from 'next-auth/react';

export async function discordAuthMiddleware(req, res) {
    const session = await getSession({ req });

    // Check if user is authenticated
    if (!session || !session.accessToken) {
        return { 
            authorized: false, 
            error: 'Unauthorized - Please log in' 
        };
    }

    // Fetch user's guilds and member data from Discord
    try {
        const [userGuilds, memberData] = await Promise.all([
            fetch('https://discord.com/api/users/@me/guilds', {
                headers: {
                    Authorization: `Bearer ${session.accessToken}`,
                },
            }).then(res => res.json()),
            fetch(`https://discord.com/api/guilds/348570692289298432/members/${session.user.id}`, {
                headers: {
                    Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
                },
            }).then(res => res.json()),
        ]);

        // Check if user is in the Voids Within server
        const isInServer = userGuilds.some(guild => guild.id === '348570692289298432');
        if (!isInServer) {
            return {
                authorized: false,
                error: 'You must be a member of the Voids Within Discord server'
            };
        }

        // Check if user has required roles
        const hasRequiredRole = memberData.roles.some(role => 
            role === '446021241967738930' || role === '1312670780030718006'
        );
        if (!hasRequiredRole) {
            return {
                authorized: false,
                error: 'You must have the VW.Core or Bot Tech role'
            };
        }

        return { authorized: true };
    } catch (error) {
        console.error('Auth error:', error);
        return {
            authorized: false,
            error: 'Authentication failed'
        };
    }
} 