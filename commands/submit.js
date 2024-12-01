const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const mysql = require('mysql2/promise');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('submit')
        .setDescription('Submit your entry for the current community challenge.')
        .addAttachmentOption(option =>
            option
                .setName('image')
                .setDescription('Upload your submission image.')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('description')
                .setDescription('A short description of your submission.')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const image = interaction.options.getAttachment('image');
            const description = interaction.options.getString('description') || 'No description provided.';
            const userId = interaction.user.id;

            if (!image || !image.contentType) {
                return interaction.editReply({
                    content: 'You must attach a valid image file (PNG, JPEG, JPG, or GIF).',
                });
            }

            const allowedFileTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
            if (!allowedFileTypes.includes(image.contentType)) {
                return interaction.editReply({
                    content: 'Invalid file type. Please upload an image file (PNG, JPEG, JPG, or GIF).',
                });
            }

            const db = await mysql.createConnection({
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME,
            });

            const [activeChallenge] = await db.execute(
                'SELECT id, thread_id FROM challenges WHERE state = "Submissions" LIMIT 1'
            );

            if (activeChallenge.length === 0) {
                return interaction.editReply({
                    content: 'No active challenge is currently accepting submissions.',
                });
            }

            const challengeId = activeChallenge[0].id;

            const [existingSubmission] = await db.execute(
                'SELECT id, submitted FROM submissions WHERE user_id = ? AND challenge_id = ?',
                [userId, challengeId]
            );

            const auditChannelId = process.env.AUDIT_CHANNEL_ID;
            const auditChannel = await interaction.client.channels.fetch(auditChannelId);

            if (existingSubmission.length > 0) {
                if (existingSubmission[0].submitted === 0) {
                    await db.execute(
                        'UPDATE submissions SET submission_url = ?, description = ? WHERE user_id = ? AND challenge_id = ?',
                        [image.url, description, userId, challengeId]
                    );

                    const embed = new EmbedBuilder()
                        .setColor(0x3498db)
                        .setTitle('Submission Updated')
                        .setDescription('Your previous submission has been successfully updated!')
                        .addFields(
                            { name: 'Submission Description', value: description },
                            { name: 'Image URL', value: image.url }
                        )
                        .setImage(image.url)
                        .setFooter({ text: 'Thank you for participating!' })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });

                    if (auditChannel) {
                        const auditEmbed = new EmbedBuilder()
                            .setColor(0xffa500)
                            .setTitle('Submission Updated')
                            .setDescription(`A user has updated their submission for the current challenge.`)
                            .addFields(
                                { name: 'User', value: `<@${userId}>` },
                                { name: 'Challenge ID', value: challengeId.toString() },
                                { name: 'New Submission Description', value: description },
                                { name: 'New Image URL', value: image.url }
                            )
                            .setTimestamp();
                        await auditChannel.send({ embeds: [auditEmbed] });
                    }
                    return;
                } else {
                    return interaction.editReply({
                        content: 'Your submission has already been finalized and cannot be changed.',
                    });
                }
            }

            await db.execute(
                'INSERT INTO submissions (user_id, challenge_id, submission_url, description, submitted) VALUES (?, ?, ?, ?, 0)',
                [userId, challengeId, image.url, description]
            );

            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('Submission Received')
                .setDescription('Your entry has been successfully submitted!')
                .addFields(
                    { name: 'Submission Description', value: description },
                    { name: 'Image URL', value: image.url }
                )
                .setImage(image.url)
                .setFooter({ text: 'Thank you for participating!' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            if (auditChannel) {
                const auditEmbed = new EmbedBuilder()
                    .setColor(0x3498db)
                    .setTitle('New Submission')
                    .setDescription(`A new submission has been received for the current challenge.`)
                    .addFields(
                        { name: 'User', value: `<@${userId}>` },
                        { name: 'Challenge ID', value: challengeId.toString() },
                        { name: 'Submission Description', value: description },
                        { name: 'Image URL', value: image.url }
                    )
                    .setTimestamp();
                await auditChannel.send({ embeds: [auditEmbed] });
            }
        } catch (error) {
            console.error('Error submitting entry:', error);
            if (!interaction.replied) {
                await interaction.editReply({
                    content: 'An error occurred while submitting your entry. Please try again later.',
                });
            }
        }
    },
};
