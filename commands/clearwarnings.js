const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const mysql = require('mysql2/promise');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clearwarnings')
        .setDescription('Clear all warnings for a specific user.')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user whose warnings you want to clear.')
                .setRequired(true)
        ),
    async execute(interaction) {
        const MODERATOR_ROLE_ID = process.env.MODERATOR_ROLE_ID;
        const AUDIT_CHANNEL_ID = process.env.AUDIT_CHANNEL_ID;

        if (!interaction.member.roles.cache.has(MODERATOR_ROLE_ID)) {
            return interaction.reply({
                content: 'You do not have permission to use this command.',
                ephemeral: true,
            });
        }

        const targetUser = interaction.options.getUser('user');
        const db = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });

        try {
            await db.execute('DELETE FROM warnings WHERE user_id = ?', [targetUser.id]);

            await interaction.reply({
                content: `All warnings for ${targetUser.tag} have been cleared.`,
                ephemeral: true,
            });

            const auditChannel = await interaction.client.channels.fetch(AUDIT_CHANNEL_ID);

            if (auditChannel) {
                const auditEmbed = new EmbedBuilder()
                    .setColor(0x3498DB)
                    .setTitle('Warnings Cleared')
                    .setDescription('All warnings have been cleared for a user.')
                    .addFields(
                        { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
                        { name: 'Affected User', value: `<@${targetUser.id}>`, inline: true },
                        { name: 'Date/Time', value: `<t:${Math.floor(Date.now() / 1000)}>`, inline: true }
                    )
                    .setFooter({ text: `Moderator: ${interaction.user.tag}` })
                    .setTimestamp();

                await auditChannel.send({ embeds: [auditEmbed] });
            } else {
                console.error('Audit channel not found.');
            }
        } catch (error) {
            console.error('Error clearing warnings:', error);
            await interaction.reply({
                content: 'An error occurred while clearing the warnings. Please try again later.',
                ephemeral: true,
            });
        } finally {
            await db.end();
        }
    },
};
