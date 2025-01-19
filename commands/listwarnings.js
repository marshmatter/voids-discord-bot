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

            const embeds = [];
            const WARNINGS_PER_EMBED = 5; 
            
            for (let i = 0; i < warnings.length; i += WARNINGS_PER_EMBED) {
                const warningChunk = warnings.slice(i, i + WARNINGS_PER_EMBED);
                const currentPage = Math.floor(i / WARNINGS_PER_EMBED) + 1;
                const totalPages = Math.ceil(warnings.length / WARNINGS_PER_EMBED);

                const embed = new EmbedBuilder()
                    .setColor(0x2ecc71)
                    .setTitle(currentPage === 1 ? 'Predefined Warnings' : 'Predefined Warnings (Continued)')
                    .setDescription(`Page ${currentPage}/${totalPages}`)
                    .setTimestamp();

                for (const warning of warningChunk) {
                    const truncatedDescription = warning.description.length > 500
                        ? `${warning.description.substring(0, 497)}...`
                        : warning.description;

                    embed.addFields({
                        name: `Warning ID: ${warning.id}`,
                        value: truncatedDescription,
                        inline: false
                    });
                }

                embeds.push(embed);
            }

            await interaction.reply({ embeds: embeds, ephemeral: true });

        } catch (error) {
            console.error(error);
            interaction.reply({ content: 'An error occurred while fetching the warnings.', ephemeral: true });
        } finally {
            await db.end();
        }
    },
};
