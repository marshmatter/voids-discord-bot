const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const mysql = require('mysql2/promise');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('endvoting')
        .setDescription('End the voting process for the current community challenge.'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const MODERATOR_ROLE_IDS = process.env.MODERATOR_ROLE_ID.split(',');
        const MODERATOR_CHANNEL_IDS = process.env.MODERATOR_CHANNEL_IDS.split(',');

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
            const [activeChallenge] = await db.execute(
                'SELECT id, thread_id, voting_thread_id, theme FROM challenges WHERE state = "Voting" LIMIT 1'
            );
            if (activeChallenge.length === 0) {
                return interaction.editReply({ content: 'There is no active voting challenge to end.' });
            }

            const challengeId = activeChallenge[0].id;
            const votingThreadId = activeChallenge[0].voting_thread_id;
            const challengeTheme = activeChallenge[0].theme || 'Community Challenge';

            let votingThread;
            try {
                votingThread = await interaction.client.channels.fetch(votingThreadId);
            } catch (error) {
                console.error('Error fetching voting thread:', error);
                return interaction.editReply({ content: 'The voting thread could not be found.' });
            }

            const [submissions] = await db.execute(
                'SELECT * FROM submissions WHERE challenge_id = ? AND submitted = 1',
                [challengeId]
            );
            if (submissions.length === 0) {
                return interaction.editReply({ content: 'No valid submissions to end voting for.' });
            }

            const submissionVotes = [];
            for (const submission of submissions) {
                try {
                    const submissionMessage = await votingThread.messages.fetch(submission.message_id);
                    const customEmoji = interaction.guild.emojis.cache.find(emoji => emoji.name === 'dystopika');
                    const customEmojiReaction = submissionMessage.reactions.cache.get(customEmoji?.id);
                    const voteCount = customEmojiReaction ? customEmojiReaction.count - 1 : 0;
                    submissionVotes.push({ submission, voteCount });
                } catch (error) {
                    console.error(`Failed to fetch message or reactions for submission ${submission.id}:`, error);
                    // If message is not found, count it as 0 votes
                    submissionVotes.push({ submission, voteCount: 0 });
                }
            }

            submissionVotes.sort((a, b) => b.voteCount - a.voteCount);

            const votingClosedEmbed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle(`Voting for the "${challengeTheme}" Challenge has Closed!`)
                .setDescription('The top submissions will be announced soon!')
                .setTimestamp();

            await votingThread.send({ embeds: [votingClosedEmbed] });

            // Post results in the original challenge thread
            const originalThread = await interaction.client.channels.fetch(activeChallenge[0].thread_id);
            await originalThread.send({ embeds: [votingClosedEmbed] });

            let rank = 1;
            for (const { submission, voteCount } of submissionVotes.slice(0, 3)) {
                const user = await interaction.client.users.fetch(submission.user_id);
                const submissionImage = submission.submission_url;
                const imageAttachment = submissionImage ? { url: submissionImage } : {};

                const resultEmbed = new EmbedBuilder()
                    .setColor(0x2ecc71)
                    .setTitle(`Top Submission #${rank} for the "${challengeTheme}" Challenge`)
                    .setDescription(`Rank ${rank}: ${user.username}\nVotes: ${voteCount}\nDescription: ${submission.description || 'No description provided.'}`)
                    .setTimestamp();

                if (imageAttachment.url) {
                    resultEmbed.setImage(imageAttachment.url);
                }

                for (const channelId of MODERATOR_CHANNEL_IDS) {
                    const modChannel = await interaction.client.channels.fetch(channelId);
                    if (modChannel) {
                        await modChannel.send({ embeds: [resultEmbed] });
                    }
                }

                rank++;
            }

            await db.execute('UPDATE challenges SET state = "Closed", active = 0 WHERE id = ?', [challengeId]);

            // Add audit log
            const auditChannel = await interaction.client.channels.fetch(process.env.AUDIT_CHANNEL_ID);
            const auditEmbed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle('Voting Ended')
                .addFields(
                    { name: 'Action By', value: interaction.user.tag },
                    { name: 'Challenge', value: challengeTheme },
                    { name: 'Challenge ID', value: challengeId.toString() }
                )
                .setTimestamp();

            await auditChannel.send({ embeds: [auditEmbed] });

            await interaction.editReply({ content: 'Voting has been ended and results have been posted.' });
        } catch (error) {
            console.error('Error ending voting:', error);
            await interaction.editReply({ content: 'An error occurred while ending the voting process.' });
        } finally {
            await db.end();
        }
    },
};
