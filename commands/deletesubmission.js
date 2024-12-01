const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const mysql = require('mysql2/promise');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deletesubmission')
        .setDescription('Delete an inappropriate submission.')
        .addStringOption(option =>
            option.setName('submissionid')
                .setDescription('The ID of the submission to delete.')
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName('notifyuser')
                .setDescription('Notify the user about the deletion?')
                .setRequired(false)),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const MODERATOR_ROLE_ID = process.env.MODERATOR_ROLE_ID;
        const submissionId = interaction.options.getString('submissionid');
        const notifyUser = interaction.options.getBoolean('notifyuser') || false;

        const hasModeratorRole = interaction.member.roles.cache.has(MODERATOR_ROLE_ID);
        if (!hasModeratorRole) {
            return interaction.editReply({ content: 'You do not have permission to use this command.' });
        }

        const db = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });

        try {
            const [submission] = await db.execute('SELECT * FROM submissions WHERE id = ?', [submissionId]);
            if (submission.length === 0) {
                return interaction.editReply({ content: `No submission found with ID: ${submissionId}.` });
            }

            const { user_id: userId, description } = submission[0];

            await db.execute('DELETE FROM submissions WHERE id = ?', [submissionId]);

            if (notifyUser) {
                const targetUser = await interaction.client.users.fetch(userId);
                const dmEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('Submission Deleted')
                    .setDescription('Your submission has been removed by a moderator.')
                    .addFields(
                        { name: 'Reason', value: 'Violation of community guidelines or inappropriate content.' },
                        { name: 'Deleted Submission', value: description }
                    )
                    .setFooter({ text: 'Use the /new command in our Discord if you have any questions.' })
                    .setTimestamp();

                try {
                    await targetUser.send({ embeds: [dmEmbed] });
                } catch (error) {
                    console.error(`Failed to notify user ${userId}:`, error);
                }
            }

            // Log the deletion in the audit log channel
            const auditLogChannelId = process.env.AUDIT_CHANNEL_ID;
            const auditLogEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('Submission Deleted')
                .addFields(
                    { name: 'Moderator', value: interaction.user.tag, inline: true },
                    { name: 'Submission ID', value: submissionId, inline: true },
                    { name: 'User ID', value: userId, inline: true },
                    { name: 'Description', value: description }
                )
                .setFooter({ text: 'Deletion logged' })
                .setTimestamp();

            const auditLogChannel = await interaction.client.channels.fetch(auditLogChannelId);
            if (auditLogChannel) {
                await auditLogChannel.send({ embeds: [auditLogEmbed] });
            }

            // Notify the moderator
            await interaction.editReply({ content: `Submission ${submissionId} has been deleted successfully.` });
        } catch (error) {
            console.error('Error deleting submission:', error);
            await interaction.editReply({ content: 'An error occurred while deleting the submission.' });
        } finally {
            await db.end();
        }
    },
};
