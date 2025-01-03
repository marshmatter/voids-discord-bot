const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const mysql = require('mysql2/promise');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('challenge')
        .setDescription('Get information about the current community challenge.'),

    async execute(interaction) {
        const db = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });

        try {
            const [results] = await db.execute('SELECT theme FROM challenges WHERE active = 1 LIMIT 1');
            const theme = results.length > 0 ? results[0].theme : 'No active community challenge at the moment.';

            const embed = new EmbedBuilder()
                .setColor(0x1F8B4C)
                .setTitle('Community Challenge')
                .setDescription('Participate in the community challenge and show off your best city!')
                .addFields(
                    { name: 'Current Theme', value: theme, inline: false },
                    { 
                        name: 'How to Enter', 
                        value: '1. Type /submit in any channel.\n' +
                                '2. Upload your Image\n' +
                                '3. Optionally, add the lore/backstory via the "description"! ', 
                        inline: false 
                    }
                )
                .setFooter({ text: 'Good luck! We are really excited to see your submissions!' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error fetching challenge information:', error);
            await interaction.reply({ content: 'An error occurred while fetching the challenge details.', ephemeral: true });
        } finally {
            await db.end();
        }
    },
};
