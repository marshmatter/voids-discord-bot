const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const mysql = require('mysql2/promise');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('startvoting')
        .setDescription('Start the voting process for the community challenge submissions.'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const MODERATOR_ROLE_ID = process.env.MODERATOR_ROLE_ID;
        const CHALLENGE_CHANNEL_ID = process.env.CHALLENGE_CHANNEL_ID;

        if (!CHALLENGE_CHANNEL_ID) {
            return interaction.editReply({ content: 'Challenge channel ID is not configured properly.', ephemeral: true });
        }

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
            const [activeChallenge] = await db.execute('SELECT * FROM challenges WHERE active = 1 LIMIT 1');

            if (activeChallenge.length === 0) {
                return interaction.editReply({ content: 'There is no active challenge to start voting for.', ephemeral: true });
            }

            const theme = activeChallenge[0].theme || 'No theme defined'; // Default to 'No theme defined' if no theme exists

            const challengeChannel = await interaction.client.channels.fetch(CHALLENGE_CHANNEL_ID);

            if (!challengeChannel) {
                return interaction.editReply({ content: 'The challenge channel could not be found.', ephemeral: true });
            }

            const votingAnnouncementEmbed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle('Voting for the Community Challenge has Started!')
                .setDescription(`The voting process for this challenge submissions is now live! 🗳️\n\n**The theme of this challenge is:** ${theme}`)
                .setFooter({ text: 'Vote for your favorite submissions!' })
                .setTimestamp();

            await challengeChannel.send({ embeds: [votingAnnouncementEmbed] });

            const [submissions] = await db.execute(`
                SELECT id, submission_url, user_id 
                FROM submissions 
                WHERE challenge_id = ?`, [activeChallenge[0].id]);

            if (submissions.length === 0) {
                return interaction.editReply({ content: 'There are no submissions to start voting.', ephemeral: true });
            }

            await interaction.editReply({ content: 'Voting has been started! Submissions are being posted...' });

            for (const submission of submissions) {
                const user = await interaction.client.users.fetch(submission.user_id);

                const embed = new EmbedBuilder()
                    .setColor(0x3498DB)
                    .setTitle('Community Challenge Submission')
                    .setDescription(`Submitted by: **${user.tag}**`)
                    .setImage(submission.submission_url)
                    .setFooter({ text: `Submission ID: ${submission.id}` })
                    .setTimestamp();

                const message = await challengeChannel.send({ embeds: [embed] });
                await message.react('👍');
            }
        } catch (error) {
            console.error('Error starting voting:', error);
            await interaction.editReply({ content: 'An error occurred while starting the voting process.', ephemeral: true });
        } finally {
            await db.end();
        }
    },
};
