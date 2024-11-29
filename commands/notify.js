const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

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
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages), // restricted to the VW.Mod role.
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const message = interaction.options.getString('message');

        try {
            const embed = new EmbedBuilder()
                .setTitle('Moderator Notification')
                .setDescription(message)
                .setColor('#e74c3c')
                .setFooter({ text: `Notification from ${interaction.guild.name}` })
                .setTimestamp();

            await targetUser.send({ embeds: [embed] });
            await interaction.reply({ content: `Notification sent to ${targetUser.tag}.`, ephemeral: true });

            console.log(`Notification sent to ${targetUser.tag}: ${message}`);
        } catch (error) {
            console.error(`Could not send DM to ${targetUser.tag}:`, error);
            await interaction.reply({ content: `Failed to send a DM to ${targetUser.tag}.`, ephemeral: true });
        }
    },
};
