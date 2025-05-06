const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const mysql = require('mysql2/promise');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('startvoting')
        .setDescription('Start the voting process for the community challenge submissions.'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const MODERATOR_ROLE_IDS = process.env.MODERATOR_ROLE_ID.split(',');
        const CONTEST_ROLE_ID = process.env.CONTEST_ROLE_ID;
        const FORUM_CHALLENGE_ID = process.env.FORUM_CHALLENGE_ID;
        const GENERAL_CHAT_ID = process.env.GENERAL_CHAT_ID;
        const CHALLENGE_FORUM_ID = process.env.FORUM_CHALLENGE_ID;

        const hasModeratorRole = MODERATOR_ROLE_IDS.some(roleId => interaction.member.roles.cache.has(roleId));
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
            const [activeChallenge] = await db.execute('SELECT * FROM challenges WHERE active = 1 LIMIT 1');
            if (activeChallenge.length === 0) {
                return interaction.editReply({ content: 'There is no active challenge to start voting for.', ephemeral: true });
            }

            const challengeId = activeChallenge[0].id;
            const challengeTheme = activeChallenge[0].theme;

            const [submissions] = await db.execute('SELECT * FROM submissions WHERE challenge_id = ? AND submitted = 0', [challengeId]);
            if (submissions.length === 0) {
                return interaction.editReply({ content: 'No submissions have been finalized for this challenge yet.', ephemeral: true });
            }

            // Create a new voting thread in the challenges forum
            const challengeForum = await interaction.client.channels.fetch(FORUM_CHALLENGE_ID);
            const votingThread = await challengeForum.threads.create({
                name: `Voting: ${challengeTheme}`,
                message: {
                    content: `<@&${CONTEST_ROLE_ID}> Voting has begun for the "${challengeTheme}" challenge!`,
                },
                autoArchiveDuration: 1440,
                reason: 'Community Challenge Voting',
            });

            const votingAnnouncementEmbed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle('🗳️ Community Challenge Voting')
                .setDescription(
                    `The voting process for "${challengeTheme}" is now live!\n\n` +
                    `**How to Vote:**\n` +
                    `• React with the Dystopika emoji on your favorite submissions\n` +
                    `• You can vote for multiple submissions\n` +
                    `• Please don't vote for your own submission\n\n` +
                    `All submissions will be posted below. Good luck to all participants! 🎉`
                )
                .setFooter({ text: 'Vote for your favorite submissions!' })
                .setTimestamp();

            await votingThread.send({ embeds: [votingAnnouncementEmbed] });

            // Post each submission in the voting thread
            for (const submission of submissions) {
                const user = await interaction.client.users.fetch(submission.user_id);

                const submissionEmbed = new EmbedBuilder()
                    .setColor(0x2ecc71)
                    .setTitle(`Submission by ${user.username}`)
                    .setDescription(submission.description || 'No description provided.')
                    .setImage(submission.submission_url)
                    .setFooter({ text: 'React with the Dystopika emoji to vote!' })
                    .setTimestamp();

                const message = await votingThread.send({ embeds: [submissionEmbed] });

                const customEmoji = interaction.guild.emojis.cache.find(emoji => emoji.name === 'dystopika');
                if (customEmoji) {
                    await message.react(customEmoji);
                } else {
                    console.error('Custom emoji not found.');
                    await message.react('👍');
                }

                // Update the submission record with the new voting message
                await db.execute(
                    'UPDATE submissions SET thread_id = ?, message_id = ?, vote_count = 0 WHERE id = ?',
                    [votingThread.id, message.id, submission.id]
                );
            }

            // Update challenge and submissions status
            await db.execute('UPDATE submissions SET submitted = 1 WHERE challenge_id = ?', [challengeId]);
            await db.execute(
                'UPDATE challenges SET state = "Voting", voting_thread_id = ? WHERE id = ?',
                [votingThread.id, challengeId]
            );

            // Post announcement in the original challenge thread
            const originalThread = await interaction.client.channels.fetch(activeChallenge[0].thread_id);
            const redirectEmbed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle('Voting Has Begun!')
                .setDescription(
                    `The voting phase for this challenge has started!\n\n` +
                    `**Please head over to the [Voting Thread](${votingThread.url}) to view submissions and cast your votes!**`
                )
                .setTimestamp();

            await originalThread.send({ embeds: [redirectEmbed] });

            await interaction.editReply({ 
                content: `Voting has been started! A new voting thread has been created: ${votingThread.url}` 
            });

            // Add audit log
            const auditChannel = await interaction.client.channels.fetch(process.env.AUDIT_CHANNEL_ID);
            const auditEmbed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle('Voting Started')
                .addFields(
                    { name: 'Action By', value: interaction.user.tag },
                    { name: 'Challenge', value: challengeTheme },
                    { name: 'Challenge ID', value: challengeId.toString() }
                )
                .setTimestamp();

            await auditChannel.send({ embeds: [auditEmbed] });

            // Challenge Voting Announcement
            const generalChat = await interaction.client.channels.fetch(GENERAL_CHAT_ID);
            const announcementEmbed = new EmbedBuilder()
                .setColor(0x7700ff)
                .setTitle('🚨 Community Challenge has Started Voting! 🚨')
                .setDescription(
                    `Our current community challenge has entered the voting phase! Visit <#${CHALLENGE_FORUM_ID}> to learn more.\n\n` +
                    `Want to be notified about current and future challenges? Grant yourself the "Challenge Alerts" role by typing \`/challengealerts\`.`
                )
                .setTimestamp();

            await generalChat.send({ embeds: [announcementEmbed] });


        } catch (error) {
            console.error('Error starting voting:', error);
            await interaction.editReply({ content: 'An error occurred while starting the voting process.', ephemeral: true });
        } finally {
            await db.end();
        }
    },
};
