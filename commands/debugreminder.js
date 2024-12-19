const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const mysql = require('mysql2/promise');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('debugreminder')
        .setDescription('Force a reminder notification for the active challenge (Mod only)')
        .addStringOption(option =>
            option.setName('time')
                .setDescription('Which reminder to test')
                .setRequired(true)
                .addChoices(
                    { name: '24 hours', value: '24h' },
                    { name: '6 hours', value: '6h' },
                    { name: '1 hour', value: '1h' },
                    { name: '30 minutes', value: '30m' }
                )),

    async execute(interaction) {
        // Check for moderator permissions
        const MODERATOR_ROLE_IDS = process.env.MODERATOR_ROLE_ID.split(',');
        const hasModeratorRole = MODERATOR_ROLE_IDS.some(roleId => 
            interaction.member.roles.cache.has(roleId));

        if (!hasModeratorRole) {
            return interaction.reply({ 
                content: 'This command is for moderators only.', 
                ephemeral: true 
            });
        }

        const db = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });

        try {
            // Get active challenge
            const [activeChallenge] = await db.execute(
                'SELECT * FROM challenges WHERE state = "Submissions" ORDER BY id DESC LIMIT 1'
            );

            if (activeChallenge.length === 0) {
                return interaction.reply({
                    content: 'No active challenge found in submissions stage.',
                    ephemeral: true
                });
            }

            const challenge = activeChallenge[0];
            const closeTime = new Date(challenge.submissions_close + ' UTC').getTime();
            const timeChoice = interaction.options.getString('time');
            
            let reminderMessage;
            switch(timeChoice) {
                case '24h': reminderMessage = '24 hours'; break;
                case '6h': reminderMessage = '6 hours'; break;
                case '1h': reminderMessage = '1 hour'; break;
                case '30m': reminderMessage = '30 minutes'; break;
            }

            const reminderEmbed = new EmbedBuilder()
                .setColor(0xFF9300)
                .setTitle('⏰ [DEBUG] Submission Deadline Approaching!')
                .setDescription(
                    `**Only ${reminderMessage} left** to submit your entry for:\n` +
                    `"${challenge.theme}"\n\n` +
                    `Submissions close <t:${Math.floor(closeTime / 1000)}:R>\n\n` +
                    `Use \`/submit\` to enter your submission!`
                )
                .setFooter({ text: 'This is a debug notification' })
                .setTimestamp();

            const thread = await interaction.client.channels.fetch(challenge.thread_id);
            await thread.send({ 
                content: `[DEBUG REMINDER] <@&${process.env.CONTEST_ROLE_ID}>`,
                embeds: [reminderEmbed]
            });

            // Log to audit channel
            const auditChannel = await interaction.client.channels.fetch(process.env.AUDIT_CHANNEL_ID);
            const auditEmbed = new EmbedBuilder()
                .setColor(0xFF9300)
                .setTitle('Debug Reminder Triggered')
                .addFields(
                    { name: 'Challenge', value: challenge.theme },
                    { name: 'Reminder Type', value: reminderMessage },
                    { name: 'Triggered By', value: interaction.user.tag }
                )
                .setTimestamp();

            await auditChannel.send({ embeds: [auditEmbed] });

            await interaction.reply({ 
                content: `Debug reminder (${reminderMessage}) sent successfully.`, 
                ephemeral: true 
            });

        } catch (error) {
            console.error('Error sending debug reminder:', error);
            await interaction.reply({ 
                content: 'An error occurred while sending the debug reminder.', 
                ephemeral: true 
            });
        } finally {
            await db.end();
        }
    },
}; 