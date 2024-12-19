const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const mysql = require('mysql2/promise');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('updatechallenge')
        .setDescription('Update an active challenge in the submissions stage')
        .addIntegerOption(option =>
            option.setName('id')
                .setDescription('The ID of the challenge to update')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('theme')
                .setDescription('New theme for the challenge'))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('New description for the challenge'))
        .addStringOption(option =>
            option.setName('submissions_close')
                .setDescription('New submissions close date (YYYY-MM-DD HH:MM:SS)'))
        .addStringOption(option =>
            option.setName('voting_begins')
                .setDescription('New voting begins date (YYYY-MM-DD HH:MM:SS)'))
        .addStringOption(option =>
            option.setName('voting_ends')
                .setDescription('New voting ends date (YYYY-MM-DD HH:MM:SS)')),

    async execute(interaction) {
        const MODERATOR_ROLE_IDS = process.env.MODERATOR_ROLE_ID.split(',');
        const hasModeratorRole = MODERATOR_ROLE_IDS.some(roleId => 
            interaction.member.roles.cache.has(roleId));

        if (!hasModeratorRole) {
            return interaction.reply({ 
                content: 'You do not have permission to update challenges.', 
                ephemeral: true 
            });
        }

        const challengeId = interaction.options.getInteger('id');
        const db = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });

        try {
            // Get current challenge details
            const [challenge] = await db.execute(
                'SELECT * FROM challenges WHERE id = ? AND state = "Submissions"',
                [challengeId]
            );

            if (challenge.length === 0) {
                return interaction.reply({ 
                    content: 'Challenge not found or is not in the submissions stage.', 
                    ephemeral: true 
                });
            }

            // Prepare update data
            const updates = {};
            const fields = ['theme', 'description', 'submissions_close', 'voting_begins', 'voting_ends'];
            
            fields.forEach(field => {
                const value = interaction.options.getString(field);
                if (value) updates[field] = value;
            });

            if (Object.keys(updates).length === 0) {
                return interaction.reply({ 
                    content: 'No updates provided.', 
                    ephemeral: true 
                });
            }

            // Build SQL query
            const setClause = Object.keys(updates)
                .map(key => `${key} = ?`)
                .join(', ');
            const values = [...Object.values(updates), challengeId];

            // Update challenge
            await db.execute(
                `UPDATE challenges SET ${setClause} WHERE id = ?`,
                values
            );

            // Update thread if theme changed
            if (updates.theme) {
                try {
                    const thread = await interaction.client.channels.fetch(challenge[0].thread_id);
                    if (thread) {
                        await thread.setName(`Challenge: ${updates.theme}`);
                    }
                } catch (error) {
                    console.error('Error updating thread name:', error);
                }
            }

            // Create embed for thread update
            const updateEmbed = new EmbedBuilder()
                .setColor(0x7700ff)
                .setTitle('Challenge Updated')
                .setDescription('The following changes have been made to this challenge:')
                .setTimestamp();

            Object.entries(updates).forEach(([key, value]) => {
                const fieldName = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                updateEmbed.addFields({ 
                    name: fieldName, 
                    value: key.includes('_') ? `<t:${Math.floor(new Date(value).getTime() / 1000)}:F>` : value 
                });
            });

            // Send update message to thread
            const thread = await interaction.client.channels.fetch(challenge[0].thread_id);
            await thread.send({ embeds: [updateEmbed] });

            // Log to audit channel
            const auditChannel = await interaction.client.channels.fetch(process.env.AUDIT_CHANNEL_ID);
            const auditEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('Challenge Updated')
                .addFields(
                    { name: 'Challenge ID', value: challengeId.toString() },
                    { name: 'Updated By', value: interaction.user.tag }
                )
                .setTimestamp();

            Object.entries(updates).forEach(([key, value]) => {
                const fieldName = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                auditEmbed.addFields({ name: fieldName, value: value });
            });

            await auditChannel.send({ embeds: [auditEmbed] });

            await interaction.reply({ 
                content: 'Challenge has been updated successfully.', 
                ephemeral: true 
            });

        } catch (error) {
            console.error('Error updating challenge:', error);
            await interaction.reply({ 
                content: 'An error occurred while updating the challenge.', 
                ephemeral: true 
            });
        } finally {
            await db.end();
        }
    },
}; 