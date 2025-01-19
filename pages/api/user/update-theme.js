import { getSession } from 'next-auth/react';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const session = await getSession({ req });
    if (!session) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { theme } = req.body;
    if (!theme || !['light', 'dark'].includes(theme)) {
        return res.status(400).json({ error: 'Invalid theme' });
    }

    try {
        // Update the session with the new theme
        await session.update({
            theme: theme,
        });

        return res.status(200).json({ theme });
    } catch (error) {
        console.error('Failed to update theme:', error);
        return res.status(500).json({ error: 'Failed to update theme' });
    }
} 