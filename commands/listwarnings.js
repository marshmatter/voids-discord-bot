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

            // Paginate warnings
            const embeds = [];
            const warningsPerPage = 25;

            for (let i = 0; i < warnings.length; i += warningsPerPage) {
                const slice = warnings.slice(i, i + warningsPerPage);

                const embed = new EmbedBuilder()
                    .setColor(0x2ecc71)
                    .setTitle('Predefined Warnings')
                    .setDescription(`Here is a list of all predefined warnings available for use. Page ${Math.ceil(i / warningsPerPage) + 1}/${Math.ceil(warnings.length / warningsPerPage)}`)
                    .setTimestamp();

                slice.forEach(warning => {
                    const truncatedDescription = warning.description.length > 1024
                        ? `${warning.description.substring(0, 1021)}...`
                        : warning.description;

                    embed.addFields({
                        name: `Warning ID: ${warning.id}`,
                        value: truncatedDescription,
                        inline: false
                    });
                });

                embeds.push(embed);
            }

            // Send all embeds in a single reply
            await interaction.reply({ embeds: embeds, ephemeral: true });

        } catch (error) {
            console.error(error);
            interaction.reply({ content: 'An error occurred while fetching the warnings.', ephemeral: true });
        } finally {
            await db.end();
        }
    },
};
