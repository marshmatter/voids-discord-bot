const { SlashCommandBuilder } = require('discord.js');
const mysql = require('mysql2/promise');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addwarning')
        .setDescription('Add a new pre-defined warning.')
        .addStringOption(option =>
            option
                .setName('description')
                .setDescription('Description of the warning.')
                .setRequired(true)),

    async execute(interaction) {
        const description = interaction.options.getString('description');
        const moderator = interaction.user;

        const MODERATOR_ROLE_ID = process.env.MODERATOR_ROLE_ID;

        const hasModeratorRole = interaction.member.roles.cache.has(MODERATOR_ROLE_ID);
        if (!hasModeratorRole) {
            return interaction.reply({ content: 'You do not have permission to add a warning.', ephemeral: true });
        }

        const db = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });

        try {
            const [result] = await db.execute(
                'INSERT INTO predefined_warnings (description) VALUES (?)',
                [description]
            );

            if (result.affectedRows > 0) {
                const warningId = result.insertId;
                interaction.reply({ 
                    content: `Successfully added the new warning. The warning ID is **${warningId}**.`, 
                    ephemeral: true 
                });
            } else {
                interaction.reply({ content: 'Failed to add the new warning. Please try again.', ephemeral: true });
            }
        } catch (error) {
            console.error(error);
            interaction.reply({ content: 'An error occurred while adding the warning.', ephemeral: true });
        } finally {
            await db.end();
        }
    },
};
