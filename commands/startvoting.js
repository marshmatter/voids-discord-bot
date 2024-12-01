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

            const [challengeData] = await db.execute('SELECT thread_id FROM challenges WHERE id = ?', [challengeId]);

            if (challengeData.length === 0 || !challengeData[0].thread_id) {
                return interaction.editReply({ content: 'No forum thread found for the active challenge.', ephemeral: true });
            }

            const forumThreadId = challengeData[0].thread_id;
            const challengeChannel = await interaction.client.channels.fetch(forumThreadId);

            if (!challengeChannel) {
                return interaction.editReply({ content: 'The challenge forum thread could not be found.', ephemeral: true });
            }

            const [submissions] = await db.execute('SELECT * FROM submissions WHERE challenge_id = ? AND submitted = 0', [challengeId]);

            if (submissions.length === 0) {
                return interaction.editReply({ content: 'No submissions have been finalized for this challenge yet.', ephemeral: true });
            }

            await challengeChannel.send(`<@&${CONTEST_ROLE_ID}> `);

            const votingAnnouncementEmbed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle('Voting for the Community Challenge has Started!')
                .setDescription('The voting process for this challenge submissions is now live! 🗳️\n\nPlease react to your favorite submissions below to cast your vote.')
                .setFooter({ text: 'Vote for your favorite submissions!' })
                .setTimestamp();

            await challengeChannel.send({ embeds: [votingAnnouncementEmbed] });

            for (const submission of submissions) {
                const user = await interaction.client.users.fetch(submission.user_id);

                const submissionEmbed = new EmbedBuilder()
                    .setColor(0x2ecc71)
                    .setTitle(`Submission by ${user.username}`)
                    .setDescription(submission.description || 'No description provided.')
                    .setImage(submission.submission_url)
                    .setFooter({ text: 'Thank you for participating!' })
                    .setTimestamp();

                const message = await challengeChannel.send({ embeds: [submissionEmbed] });

                const customEmoji = interaction.guild.emojis.cache.find(emoji => emoji.name === 'dystopika'); 
                if (customEmoji) {
                    await message.react(customEmoji); 
                } else {
                    console.error('Custom emoji not found.');
                    await message.react('👍');
                }

                await db.execute('UPDATE submissions SET thread_id = ?, message_id = ?, vote_count = 0 WHERE id = ?', [forumThreadId, message.id, submission.id]);
            }

            await db.execute('UPDATE submissions SET submitted = 1 WHERE challenge_id = ?', [challengeId]);
            await db.execute('UPDATE challenges SET state = "Voting" WHERE id = ?', [challengeId]);

            await interaction.editReply({ content: 'Voting has been started! Submissions are now posted for voting.' });

        } catch (error) {
            console.error('Error starting voting:', error);
            await interaction.editReply({ content: 'An error occurred while starting the voting process.', ephemeral: true });
        } finally {
            await db.end();
        }
    },
};
