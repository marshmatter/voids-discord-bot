const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const mysql = require('mysql2/promise');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('endvoting')
        .setDescription('Tally up the votes and announce the top 3 submissions!'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const MODERATOR_ROLE_ID = process.env.MODERATOR_ROLE_ID;
        const CHALLENGE_CHANNEL_ID = process.env.CHALLENGE_CHANNEL_ID;
        const AUDIT_CHANNEL_ID = process.env.AUDIT_CHANNEL_ID; 

        // Check if the user has the moderator role that's defined in .env
        const hasModeratorRole = interaction.member.roles.cache.has(MODERATOR_ROLE_ID);
        if (!hasModeratorRole) {
            return interaction.editReply({ content: 'You do not have permission to end voting.', ephemeral: true });
        }

        const db = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });

        try {
            // Fetch the active challenge to get the submissions
            const [activeChallenge] = await db.execute('SELECT * FROM challenges WHERE active = 1 LIMIT 1');
            if (activeChallenge.length === 0) {
                return interaction.editReply({ content: 'There is no active challenge to end voting for.', ephemeral: true });
            }

            // Fetch all submissions for the active challenge
            const [submissions] = await db.execute(`
                SELECT id, submission_url, user_id 
                FROM submissions 
                WHERE challenge_id = ?`, [activeChallenge[0].id]);

            if (submissions.length === 0) {
                return interaction.editReply({ content: 'There are no submissions to end voting on.', ephemeral: true });
            }

            // Fetch the challenge channel and post that voting will end
            const challengeChannel = await interaction.client.channels.fetch(CHALLENGE_CHANNEL_ID);
            const challengeEmbed = new EmbedBuilder()
                .setColor(0xE74C3C)
                .setTitle('Voting Has Ended!')
                .setDescription('The top 3 submissions will be announced by Matt shortly! Stay tuned! 🎉')
                .setTimestamp();

            await challengeChannel.send({ embeds: [challengeEmbed] });

            // Now, tally votes (👍 reactions)
            let submissionVotes = [];

            for (const submission of submissions) {
                // Fetch the submission message using submission ID (we need the message ID saved)
                try {
                    const submissionMessage = await challengeChannel.messages.fetch(submission.id);

                    if (!submissionMessage) {
                        console.error(`Submission message with ID ${submission.id} not found.`);
                        continue;
                    }

                    const thumbsUpReactions = submissionMessage.reactions.cache.get('👍');
                    const reactionCount = thumbsUpReactions ? thumbsUpReactions.count - 1 : 0; // Subtract 1 to ignore the bot's own reaction

                    submissionVotes.push({
                        submissionId: submission.id,
                        userId: submission.user_id,
                        reactionCount: reactionCount,
                    });
                } catch (error) {
                    console.error(`Error fetching submission message with ID ${submission.id}: ${error.message}`);
                }
            }

            // Sort the submissions based on reaction count (descending)
            submissionVotes.sort((a, b) => b.reactionCount - a.reactionCount);

            // Get the top 3 submissions
            const top3 = submissionVotes.slice(0, 3);

            // Fetch the Moderator channel to post results
            const auditChannel = await interaction.client.channels.fetch(AUDIT_CHANNEL_ID);

            const top3Embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('Top 3 Submissions!')
                .setDescription('Here are the top 3 submissions of the challenge:')
                .setTimestamp();

            // Add the top 3 to the embed
            top3.forEach((entry, index) => {
                top3Embed.addFields({
                    name: `#${index + 1} - Submission by <@${entry.userId}>`,
                    value: `[View Submission](${submissions.find(sub => sub.id === entry.submissionId).submission_url}) - Votes: ${entry.reactionCount}`,
                    inline: false,
                });
            });

            await auditChannel.send({ embeds: [top3Embed] });

            // Mark the challenge as inactive after voting ends
            await db.execute('UPDATE challenges SET active = 0 WHERE id = ?', [activeChallenge[0].id]);

            // Send a reply to confirm that voting has ended
            await interaction.editReply({ content: 'Voting has ended successfully! The top 3 submissions have been posted in the Moderator channel.' });
        } catch (error) {
            console.error('Error ending voting:', error);
            await interaction.editReply({ content: 'An error occurred while ending the voting process.', ephemeral: true });
        } finally {
            await db.end();
        }
    },
};
