const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('challengealerts')
        .setDescription('Add or Remove the "Challenge Alerts" role to yourself.'),

    async execute(interaction) {
        const CONTEST_ROLE_ID = process.env.CONTEST_ROLE_ID;

        if (!CONTEST_ROLE_ID) {
            return interaction.reply({ content: 'Error: The Challenge Alerts role is not configured. Please reach out to <@862537604138401822>', ephemeral: true });
        }

        const member = interaction.member;

        if (member.roles.cache.has(CONTEST_ROLE_ID)) {
            try {
                await member.roles.remove(CONTEST_ROLE_ID);
                return interaction.reply({ content: 'You have been unsubscribed from challenge alerts.', ephemeral: true });
            } catch (error) {
                console.error(`Error removing the challenge alerts role from user ${member.id}:`, error);
                return interaction.reply({ content: 'There was an error unsubscribing you from challenge alerts. Please reach out to <@862537604138401822>.', ephemeral: true });
            }
        } else {
            try {
                await member.roles.add(CONTEST_ROLE_ID);
                return interaction.reply({ content: 'You have been subscribed to challenge alerts.', ephemeral: true });
            } catch (error) {
                console.error(`Error adding the challenge alerts role to user ${member.id}:`, error);
                return interaction.reply({ content: 'There was an error subscribing you to challenge alerts. Please reach out to <@862537604138401822>.', ephemeral: true });
            }
        }
    },
};
