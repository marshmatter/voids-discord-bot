const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
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
                .setDescription('The lore/backstory of your image, if you have one.')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const image = interaction.options.getAttachment('image');
            const description = interaction.options.getString('description') || 'No description provided.';
            const userId = interaction.user.id;
            const username = interaction.user.username;

            if (!image || !image.contentType) {
                return interaction.editReply({
                    content: 'You must attach a valid image file (PNG, JPEG, or JPG).',
                });
            }

            const allowedFileTypes = ['image/png', 'image/jpeg', 'image/jpg'];
            if (!allowedFileTypes.includes(image.contentType)) {
                return interaction.editReply({
                    content: 'Invalid file type. Please upload an image file (PNG, JPEG, or JPG).',
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
            const threadId = activeChallenge[0].thread_id;
            const forumThread = await interaction.client.channels.fetch(threadId);

            const [existingSubmission] = await db.execute(
                'SELECT id, submitted FROM submissions WHERE user_id = ? AND challenge_id = ?',
                [userId, challengeId]
            );

            let submissionId;

            if (existingSubmission.length > 0) {
                submissionId = existingSubmission[0].id;
                if (existingSubmission[0].submitted === 0) {
                    const response = await fetch(image.url);
                    const imageBuffer = Buffer.from(await response.arrayBuffer());
                    const attachment = new AttachmentBuilder(imageBuffer, { name: 'submission.png' });

                    const auditEmbed = new EmbedBuilder()
                        .setColor(0x3498db)
                        .setTitle('🔄 Submission Updated')
                        .setDescription(`Submission updated by ${username} (${userId})`)
                        .addFields(
                            { name: 'Submission Description', value: description },
                            { name: 'Challenge ID', value: challengeId.toString() },
                            { name: 'Submission ID', value: submissionId.toString() }
                        )
                        .setTimestamp();

                    const auditChannel = await interaction.client.channels.fetch(process.env.AUDIT_CHANNEL_ID);
                    const auditMessage = await auditChannel.send({ 
                        embeds: [auditEmbed],
                        files: [attachment]
                    });

                    const permanentUrl = auditMessage.attachments.first().url;

                    await db.execute(
                        'UPDATE submissions SET submission_url = ?, description = ? WHERE id = ?',
                        [permanentUrl, description, submissionId]
                    );

                    const embed = new EmbedBuilder()
                        .setColor(0x3498db)
                        .setTitle('Submission Updated')
                        .setDescription('Your previous submission has been successfully updated!')
                        .addFields(
                            { name: 'Submission Description', value: description }
                        )
                        .setImage(permanentUrl)
                        .setFooter({ text: 'Thank you for participating!' })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });
                    await forumThread.send(`<@${userId}> has updated their submission to this challenge!`);

                    return;
                } else {
                    return interaction.editReply({
                        content: 'Your submission has already been finalized and cannot be changed.',
                    });
                }
            }

            const response = await fetch(image.url);
            const imageBuffer = Buffer.from(await response.arrayBuffer());
            const attachment = new AttachmentBuilder(imageBuffer, { name: 'submission.png' });

            const auditEmbed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('✅ New Submission')
                .setDescription(`New submission by ${username} (${userId})`)
                .addFields(
                    { name: 'Submission Description', value: description },
                    { name: 'Challenge ID', value: challengeId.toString() }
                )
                .setTimestamp();

            const auditChannel = await interaction.client.channels.fetch(process.env.AUDIT_CHANNEL_ID);
            const auditMessage = await auditChannel.send({ 
                embeds: [auditEmbed],
                files: [attachment]
            });

            const permanentUrl = auditMessage.attachments.first().url;

            const [result] = await db.execute(
                'INSERT INTO submissions (user_id, challenge_id, submission_url, description, submitted) VALUES (?, ?, ?, ?, 0)',
                [userId, challengeId, permanentUrl, description]
            );

            submissionId = result.insertId;

            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('Submission Received')
                .setDescription('Your entry has been successfully submitted!')
                .addFields(
                    { name: 'Submission Description', value: description },
                    { name: 'Image URL', value: permanentUrl }
                )
                .setImage(permanentUrl)
                .setFooter({ text: 'Thank you for participating!' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            const message = await forumThread.send(`<@${userId}> has entered their submission to this challenge!`);
            
            await db.execute(
                'UPDATE submissions SET message_id = ? WHERE id = ?',
                [message.id, submissionId]
            );

            auditEmbed.addFields({ 
                name: 'Submission ID', 
                value: submissionId.toString() 
            });

            await auditMessage.edit({ embeds: [auditEmbed] });

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
