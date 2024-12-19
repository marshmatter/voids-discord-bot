const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const mysql = require('mysql2/promise');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('editwarning')
        .setDescription('Edit a pre-defined warning by ID')
        .addIntegerOption(option =>
            option.setName('id')
                .setDescription('The ID of the warning to edit')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('The new warning description')
                .setRequired(true)),

    async execute(interaction) {
        const MODERATOR_ROLE_IDS = process.env.MODERATOR_ROLE_ID.split(',');
        const hasModeratorRole = MODERATOR_ROLE_IDS.some(roleId => 
            interaction.member.roles.cache.has(roleId));

        if (!hasModeratorRole) {
            return interaction.reply({ 
                content: 'You do not have permission to edit warnings.', 
                ephemeral: true 
            });
        }

        const warningId = interaction.options.getInteger('id');
        const newDescription = interaction.options.getString('description');

        const db = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });

        try {
            const [oldWarning] = await db.execute(
                'SELECT description FROM predefined_warnings WHERE id = ?',
                [warningId]
            );

            if (oldWarning.length === 0) {
                return interaction.reply({ 
                    content: `No warning found with ID ${warningId}`, 
                    ephemeral: true 
                });
            }

            await db.execute(
                'UPDATE predefined_warnings SET description = ? WHERE id = ?',
                [newDescription, warningId]
            );

            await interaction.reply({ 
                content: `Warning ID ${warningId} has been updated successfully.`, 
                ephemeral: true 
            });
            
            const auditChannel = await interaction.client.channels.fetch(process.env.AUDIT_CHANNEL_ID);
            
            const auditEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('Warning Edited')
                .addFields(
                    { name: 'Warning ID', value: warningId.toString() },
                    { name: 'Old Description', value: oldWarning[0].description },
                    { name: 'New Description', value: newDescription },
                    { name: 'Edited By', value: interaction.user.tag }
                )
                .setTimestamp();

            await auditChannel.send({ embeds: [auditEmbed] });

        } catch (error) {
            console.error(error);
            await interaction.reply({ 
                content: 'An error occurred while editing the warning.', 
                ephemeral: true 
            });
        } finally {
            await db.end();
        }
    },
}; 