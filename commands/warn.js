const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const mysql = require('mysql2/promise');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn a user with a predefined warning ID.')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to warn.')
                .setRequired(true))
        .addStringOption(option =>
            option
                .setName('warningid')
                .setDescription('The ID of the predefined warning.')
                .setRequired(true))
        .addStringOption(option =>
            option
                .setName('context')
                .setDescription('Optional additional context for the warning.')
                .setRequired(false)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const warningId = interaction.options.getString('warningid');
        const context = interaction.options.getString('context') || null;
        const moderatorId = interaction.user.id; // Get the moderator's ID
        const auditLogChannelId = process.env.AUDIT_CHANNEL_ID;

        console.log('Target User:', targetUser);
        console.log('Warning ID:', warningId);
        console.log('Additional Information:', context);

        if (!warningId) {
            return interaction.reply({ content: 'You must provide a valid warning ID.', ephemeral: true });
        }

        const MODERATOR_ROLE_IDS = process.env.MODERATOR_ROLE_ID.split(',');

        const hasModeratorRole = MODERATOR_ROLE_IDS.some(roleId => interaction.member.roles.cache.has(roleId));
        if (!hasModeratorRole) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        const db = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });

        try {
            const [warningDetails] = await db.execute('SELECT * FROM predefined_warnings WHERE id = ?', [warningId]);

            if (warningDetails.length === 0) {
                return interaction.reply({ content: `No predefined warning found with ID: ${warningId}.`, ephemeral: true });
            }

            const description = warningDetails[0].description;

            // Include moderator_id in the query
            await db.execute(
                'INSERT INTO warnings (user_id, warning_id, description, context, moderator_id) VALUES (?, ?, ?, ?, ?)',
                [targetUser.id, warningId, description, context, moderatorId]
            );

            const dmEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('You Have Received a Warning')
                .addFields(
                    { name: 'Reason', value: description },
                    ...(context ? [{ name: 'Additional Information', value: context }] : []),
                )
                .setFooter({ text: `Confused? Type /new in our Server to open a ticket with our Team.` })
                .setTimestamp();

            let dmStatus = 'Warning sent via DM.';
            try {
                await targetUser.send({ embeds: [dmEmbed] });
            } catch (error) {
                console.error(`Could not send DM to ${targetUser.tag}:`, error);
                dmStatus = 'Unable to send warning via DM. User may have DMs disabled.';
            }

            const replyEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('Warning Issued')
                .setDescription(`Successfully issued a warning to ${targetUser.tag}.`)
                .addFields(
                    { name: 'Warning ID', value: warningId, inline: true },
                    { name: 'Reason', value: description, inline: false },
                    ...(context ? [{ name: 'Additional Information', value: context, inline: false }] : []),
                )
                .setFooter({ text: dmStatus })
                .setTimestamp();

            await interaction.reply({ embeds: [replyEmbed] });

            const auditLogEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('Warning Issued')
                .addFields(
                    { name: 'Moderator', value: interaction.user.tag, inline: true },
                    { name: 'Warned User', value: targetUser.tag, inline: true },
                    { name: 'Warning ID', value: warningId, inline: true },
                    { name: 'Reason', value: description, inline: false },
                    ...(context ? [{ name: 'Additional Information', value: context, inline: false }] : []),
                )
                .setFooter({ text: `Warning issued at`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            const auditLogChannel = await interaction.client.channels.fetch(auditLogChannelId);
            if (auditLogChannel) {
                await auditLogChannel.send({ embeds: [auditLogEmbed] });
            }
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'An error occurred while issuing the warning.', ephemeral: true });
        } finally {
            await db.end();
        }
    },
};
