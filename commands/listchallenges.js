const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const mysql = require('mysql2/promise');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('listchallenges')
        .setDescription('List all active community challenges.'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const db = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });

        try {
            const [activeChallenges] = await db.execute(
                'SELECT id, theme, state FROM challenges WHERE state IN ("Submissions", "Voting") AND active = 1'
            );

            if (activeChallenges.length === 0) {
                return interaction.editReply({ content: 'There are no active challenges at the moment.' });
            }

            const challengesEmbed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('Active Community Challenges')
                .setDescription('Here are the current active challenges:')
                .setTimestamp();

            activeChallenges.forEach(challenge => {
                challengesEmbed.addFields({
                    name: challenge.theme,
                    value: `Status: ${challenge.state}\nID: ${challenge.id}`,
                });
            });

            await interaction.editReply({ embeds: [challengesEmbed] });
        } catch (error) {
            console.error('Error listing challenges:', error);
            await interaction.editReply({ content: 'An error occurred while listing the challenges. Please try again later.' });
        } finally {
            await db.end();
        }
    },
};
