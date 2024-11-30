const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const mysql = require('mysql2/promise');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('startchallenge')
        .setDescription('Start a new community challenge.')
        .addStringOption(option =>
            option
                .setName('theme')
                .setDescription('The theme for this community challenge.')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        // Retrieve the moderator role ID from the .env file
        const MODERATOR_ROLE_ID = process.env.MODERATOR_ROLE_ID;

        // Check if the user has the required role
        const hasModeratorRole = interaction.member.roles.cache.has(MODERATOR_ROLE_ID);
        if (!hasModeratorRole) {
            return interaction.editReply({ content: 'You do not have permission to use this command.' });
        }

        const theme = interaction.options.getString('theme') || 'The possibilities are endless!';
        const challengeChannelId = '1311528683713990656'; // REMINDER FOR BRANT - change the "challenge channel ID"
        const contestRoleId = '1286214789369958471'; // Same with this, we need to create a "Community Challenge" role that users can assign to themselves. DO NOT FORGET, FUTURE ME!
        const db = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });

        try {
            // Deactivate the current active challenge
            await db.execute('UPDATE challenges SET active = 0 WHERE active = 1');

            // Insert a new active challenge
            await db.execute('INSERT INTO challenges (theme, active) VALUES (?, 1)', [theme]);

            const challengeChannel = await interaction.client.channels.fetch(challengeChannelId);
            const embed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle('Community Challenge Started!')
                .setDescription(`A new community challenge has begun! Share your best screenshots with us!`)
                .addFields(
                    { name: 'Theme', value: theme },
                    { name: 'How to Participate', value: '1. Upload your screenshot to Imgur.\n2. Use the `/submit [url]` command to enter.' }
                )
                .setFooter({ text: 'Good luck! We cannot wait to see your submissions!' })
                .setTimestamp();

            await challengeChannel.send({ content: `<@&${contestRoleId}>`, embeds: [embed] });

            // Confirm the challenge has been started
            await interaction.editReply({ content: 'Challenge has been started successfully!' });
        } catch (error) {
            console.error('Error starting the challenge:', error);
            await interaction.editReply({ content: 'An error occurred while starting the challenge.' });
        } finally {
            await db.end();
        }
    },
};
