const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const mysql = require('mysql2/promise');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mysubmissions')
        .setDescription('View your submissions for the active challenge.'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const db = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });

        try {
            const [activeChallenge] = await db.execute(
                'SELECT id, theme, state FROM challenges WHERE state IN ("Submissions", "Voting") ORDER BY id DESC LIMIT 1'
            );

            if (activeChallenge.length === 0) {
                return interaction.editReply({
                    content: 'There is no active challenge at the moment.',
                });
            }

            const [submissions] = await db.execute(
                'SELECT * FROM submissions WHERE user_id = ? AND challenge_id = ?',
                [interaction.user.id, activeChallenge[0].id]
            );

            if (submissions.length === 0) {
                return interaction.editReply({
                    content: 'You haven\'t submitted anything to the current challenge yet.',
                });
            }

            const embed = new EmbedBuilder()
                .setColor(0x7700ff)
                .setTitle('Your Challenge Submissions')
                .setDescription(`Current Challenge: ${activeChallenge[0].theme}\nStatus: ${activeChallenge[0].state}`)
                .setTimestamp();

            const embeds = [];

            submissions.forEach((submission, index) => {
                embed.addFields(
                    { 
                        name: `Submission ${index + 1}`, 
                        value: submission.description || 'No description provided.',
                        inline: false 
                    },
                    { 
                        name: 'Status', 
                        value: submission.submitted ? 'Finalized' : 'Draft (can be updated)', 
                        inline: true 
                    },
                    { 
                        name: 'Submitted At', 
                        value: `<t:${Math.floor(new Date(submission.timestamp).getTime() / 1000)}:F>`,
                        inline: true 
                    }
                );

                if (submission.submission_url) {
                    const submissionEmbed = new EmbedBuilder()
                        .setColor(0x7700ff)
                        .setImage(submission.submission_url);
                    
                    embeds.push(submissionEmbed);
                }
            });

            embed.setFooter({ 
                text: activeChallenge[0].state === 'Submissions' 
                    ? 'You can update your submission until voting begins' 
                    : 'Voting is in progress - submissions can no longer be modified' 
            });

            await interaction.editReply({ embeds: [embed, ...embeds] });

        } catch (error) {
            console.error('Error fetching submissions:', error);
            await interaction.editReply({
                content: 'An error occurred while fetching your submissions.',
            });
        } finally {
            await db.end();
        }
    },
}; 