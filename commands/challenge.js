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
            const theme = results.length > 0 ? results[0].theme : 'No active weekly challenge at the moment.';

            const embed = new EmbedBuilder()
                .setColor(0x1F8B4C)
                .setTitle('Weekly Community Challenge')
                .setDescription('Participate in the weekly community challenge and show off your best city!')
                .addFields(
                    { name: 'Current Theme', value: theme, inline: false },
                    { 
                        name: 'How to Enter', 
                        value: '1. Upload your screenshot to Imgur.\n' +
                               '2. Copy the image link.\n' +
                               '3. Use the `/submit [url]` command to submit your entry.', 
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
