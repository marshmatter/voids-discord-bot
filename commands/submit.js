const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const mysql = require('mysql2/promise');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('submit')
        .setDescription('Submit your entry for the current community challenge.')
        .addStringOption(option =>
            option
                .setName('url')
                .setDescription('The URL of your submission.')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const submissionUrl = interaction.options.getString('url');
        const db = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });

        try {
            const [activeChallenge] = await db.execute(
                'SELECT id FROM challenges WHERE active = 1 LIMIT 1'
            );

            if (activeChallenge.length === 0) {
                return interaction.editReply({
                    content: 'No active challenge is currently running. Please try again later.',
                });
            }

            const challengeId = activeChallenge[0].id;
            const userId = interaction.user.id;

            const [existingSubmission] = await db.execute(
                'SELECT id FROM submissions WHERE user_id = ? AND challenge_id = ?',
                [userId, challengeId]
            );

            if (existingSubmission.length > 0) {
                return interaction.editReply({
                    content: 'You have already submitted an entry for the current challenge.',
                });
            }

            await db.execute(
                'INSERT INTO submissions (user_id, challenge_id, submission_url) VALUES (?, ?, ?)',
                [userId, challengeId, submissionUrl]
            );

            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('Submission Received')
                .setDescription('Your entry has been successfully submitted!')
                .addFields({ name: 'Submission URL', value: submissionUrl })
                .setFooter({ text: 'Thank you for participating!' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            const auditChannelId = process.env.AUDIT_CHANNEL_ID;
            const auditChannel = await interaction.client.channels.fetch(auditChannelId);

            if (auditChannel) {
                const auditEmbed = new EmbedBuilder()
                    .setColor(0x3498DB)
                    .setTitle('New Submission')
                    .setDescription(`A new submission has been received for the current community challenge.`)
                    .addFields(
                        { name: 'User', value: `<@${userId}>`, inline: true },
                        { name: 'Challenge ID', value: challengeId.toString(), inline: true },
                        { name: 'Submission URL', value: submissionUrl, inline: false }
                    )
                    .setFooter({ text: `Submitted by ${interaction.user.tag}` })
                    .setTimestamp();

                await auditChannel.send({ embeds: [auditEmbed] });
            } else {
                console.error('Audit channel not found.');
            }
        } catch (error) {
            console.error('Error submitting entry:', error);
            await interaction.editReply({
                content: 'An error occurred while submitting your entry. Please try again later.',
            });
        } finally {
            await db.end();
        }
    },
};
