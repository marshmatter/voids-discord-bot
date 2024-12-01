const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const mysql = require('mysql2/promise');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('listwarnings')
        .setDescription('List all pre-defined warnings with their IDs.'),

    async execute(interaction) {
        const MODERATOR_ROLE_IDS = process.env.MODERATOR_ROLE_ID.split(',');

        const hasModeratorRole = MODERATOR_ROLE_IDS.some(roleId => interaction.member.roles.cache.has(roleId));
        if (!hasModeratorRole) {
            return interaction.reply({ content: 'You do not have permission to list the warnings.', ephemeral: true });
        }

        const db = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });

        try {
            const [warnings] = await db.execute('SELECT * FROM predefined_warnings');

            if (warnings.length === 0) {
                return interaction.reply({ content: 'No predefined warnings found in the database.', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('Predefined Warnings')
                .setDescription('Here is a list of all predefined warnings available for use.')
                .setTimestamp();

            warnings.forEach(warning => {
                embed.addFields({
                    name: `Warning ID: ${warning.id}`,
                    value: warning.description,
                    inline: false
                });
            });

            interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error(error);
            interaction.reply({ content: 'An error occurred while fetching the warnings.', ephemeral: true });
        } finally {
            await db.end();
        }
    },
};
