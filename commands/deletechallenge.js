const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const mysql = require('mysql2/promise');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deletechallenge')
        .setDescription('Delete an active challenge')
        .addIntegerOption(option =>
            option.setName('id')
                .setDescription('The ID of the challenge to delete')
                .setRequired(true)),

    async execute(interaction) {
        const MODERATOR_ROLE_IDS = process.env.MODERATOR_ROLE_ID.split(',');
        const hasModeratorRole = MODERATOR_ROLE_IDS.some(roleId => 
            interaction.member.roles.cache.has(roleId));

        if (!hasModeratorRole) {
            return interaction.reply({ 
                content: 'You do not have permission to delete challenges.', 
                ephemeral: true 
            });
        }

        const challengeId = interaction.options.getInteger('id');

        const db = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });

        try {
            const [challenge] = await db.execute(
                'SELECT * FROM challenges WHERE id = ?',
                [challengeId]
            );

            if (challenge.length === 0) {
                return interaction.reply({ 
                    content: 'Challenge not found.', 
                    ephemeral: true 
                });
            }

            if (challenge[0].thread_id) {
                try {
                    const thread = await interaction.client.channels.fetch(challenge[0].thread_id);
                    if (thread) {
                        await thread.delete();
                    }
                } catch (error) {
                    console.error('Error deleting thread:', error);
                }
            }

            await db.execute(
                'DELETE FROM challenges WHERE id = ?',
                [challengeId]
            );

            await db.execute(
                'DELETE FROM submissions WHERE challenge_id = ?',
                [challengeId]
            );

            const auditChannel = await interaction.client.channels.fetch(process.env.AUDIT_CHANNEL_ID);
            const auditEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('Challenge Deleted')
                .addFields(
                    { name: 'Challenge ID', value: challengeId.toString() },
                    { name: 'Theme', value: challenge[0].theme },
                    { name: 'Deleted By', value: interaction.user.tag }
                )
                .setTimestamp();

            await auditChannel.send({ embeds: [auditEmbed] });

            await interaction.reply({ 
                content: `Challenge "${challenge[0].theme}" has been deleted successfully.`, 
                ephemeral: true 
            });

        } catch (error) {
            console.error('Error deleting challenge:', error);
            await interaction.reply({ 
                content: 'An error occurred while deleting the challenge.', 
                ephemeral: true 
            });
        } finally {
            await db.end();
        }
    },
}; 