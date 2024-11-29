const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const mysql = require('mysql2/promise');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('startchallenge')
        .setDescription('Start a new weekly challenge.')
        .addStringOption(option =>
            option
                .setName('theme')
                .setDescription('The theme for this week\'s challenge.')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        // This checks if a user has the "ManageGuild" permission. This likely will need to change to another mod-only permission.
        if (!interaction.member.permissions.has('ManageGuild')) {
            return interaction.editReply({ content: 'You do not have permission to use this command.' });
        }

        const theme = interaction.options.getString('theme') || 'The possibilities are endless!';
        const challengeChannelId = '1311528683713990656'; // REMINDER FOR BRANT - change the "challenge channel ID"
        const contestRoleId = '1286214789369958471'; // Same with this, we need to create a "Weekly Challenge" role that users can assign to themselves. DO NOT FORGET, FUTURE ME!
        const db = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });

        try {
            // When /startchallenge is run, this will automatically make the previous challenge inactive. Only run /startchallenge once, if you make a mistake, just remember doing it again will mark the current challenge inactive, if users already submitted, they will have to be notified to submit again.
            await db.execute('UPDATE challenges SET active = 0 WHERE active = 1');

            await db.execute('INSERT INTO challenges (theme, active) VALUES (?, 1)', [theme]);

            const challengeChannel = await interaction.client.channels.fetch(challengeChannelId);
            const embed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle('Weekly Challenge Started!')
                .setDescription(`A new weekly challenge has begun! Share your best screenshots with us!.`)
                .addFields(
                    { name: 'Theme', value: theme },
                    { name: 'How to Participate', value: '1. Upload your screenshot to Imgur.\n2. Use the `/submit [url]` command to enter.' }
                )
                .setFooter({ text: 'Good luck! We cannot wait to see your submissions!' })
                .setTimestamp();

            await challengeChannel.send({ content: `<@&${contestRoleId}>`, embeds: [embed] });

            // Sends a message confirming the start of the community challenge. Don't /startchallenge again unless absolutely necessary :)
            await interaction.editReply({ content: 'Challenge has been started successfully!' });
        } catch (error) {
            console.error('Error starting the challenge:', error);
            await interaction.editReply({ content: 'An error occurred while starting the challenge.' });
        } finally {
            await db.end();
        }
    },
};
