const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('notify')
        .setDescription('Send a DM notification to a user.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to notify.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The message to send.')
                .setRequired(true)),

    async execute(interaction) {
        const MODERATOR_ROLE_IDS = process.env.MODERATOR_ROLE_ID.split(',');

        const hasModeratorRole = MODERATOR_ROLE_IDS.some(roleId => interaction.member.roles.cache.has(roleId));
        if (!hasModeratorRole) {
            return interaction.reply({ content: 'You do not have the required role to use this command.', ephemeral: true });
        }

        const targetUser = interaction.options.getUser('user');
        const message = interaction.options.getString('message');
        const auditLogChannelId = process.env.AUDIT_CHANNEL_ID;

        try {
            const embed = new EmbedBuilder()
                .setTitle('Moderator Notification')
                .setDescription(message)
                .setColor('#e74c3c')
                .setFooter({ text: `Notification from ${interaction.guild.name}` })
                .setTimestamp();

            await targetUser.send({ embeds: [embed] });
            await interaction.reply({ content: `Notification sent to ${targetUser.tag}.`, ephemeral: true });

            const auditLogEmbed = new EmbedBuilder()
                .setTitle('User Notification Sent')
                .setColor('#3498db')
                .addFields(
                    { name: 'Moderator', value: interaction.user.tag, inline: true },
                    { name: 'User Notified', value: targetUser.tag, inline: true },
                    { name: 'Message', value: message, inline: false },
                    { name: 'Date/Time', value: new Date().toLocaleString(), inline: false }
                )
                .setFooter({ text: `Notification logged at ${new Date().toLocaleString()}` })
                .setTimestamp();

            const auditLogChannel = await interaction.client.channels.fetch(auditLogChannelId);
            if (auditLogChannel) {
                await auditLogChannel.send({ embeds: [auditLogEmbed] });
            }

            console.log(`Notification sent to ${targetUser.tag}: ${message}`);
        } catch (error) {
            console.error(`Could not send DM to ${targetUser.tag}:`, error);
            await interaction.reply({ content: `Failed to send a DM to ${targetUser.tag}.`, ephemeral: true });
        }
    },
};
