const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const mysql = require('mysql2/promise');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deletewarning')
        .setDescription('Delete a predefined warning by its ID.')
        .addIntegerOption(option =>
            option
                .setName('warningid')
                .setDescription('The ID of the warning to delete.')
                .setRequired(true)),

    async execute(interaction) {
        const warningId = interaction.options.getInteger('warningid');
        const moderator = interaction.user;

        const MODERATOR_ROLE_ID = process.env.MODERATOR_ROLE_ID;

        const hasModeratorRole = interaction.member.roles.cache.has(MODERATOR_ROLE_ID);
        if (!hasModeratorRole) {
            return interaction.reply({ content: 'You do not have permission to delete warnings.', ephemeral: true });
        }

        const db = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });

        try {
            const [warning] = await db.execute('SELECT * FROM predefined_warnings WHERE id = ?', [warningId]);

            if (warning.length === 0) {
                return interaction.reply({ content: `Warning with ID ${warningId} does not exist.`, ephemeral: true });
            }

            const [deleteResult] = await db.execute('DELETE FROM predefined_warnings WHERE id = ?', [warningId]);

            if (deleteResult.affectedRows > 0) {
                const embed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('Warning Deleted')
                    .setDescription(`Successfully deleted the warning with ID **${warningId}**.`)
                    .setTimestamp();

                return interaction.reply({ embeds: [embed] });
            } else {
                return interaction.reply({ content: 'An error occurred while deleting the warning. Please try again.', ephemeral: true });
            }

        } catch (error) {
            console.error(error);
            interaction.reply({ content: 'An error occurred while processing your request.', ephemeral: true });
        } finally {
            await db.end();
        }
    },
};
