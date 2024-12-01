const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { version } = require('../package.json'); // Import version from package.json

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botinfo')
        .setDescription('Allow Cipher to introduce themself to you.'),
    async execute(interaction) {
        const bot = interaction.client.user;
        const uptime = process.uptime();
        const totalUsers = interaction.guild.memberCount;
        const uptimeString = new Date(uptime * 1000).toISOString().substr(11, 8);

        const embed = new EmbedBuilder()
            .setColor(0x7700ff)
            .setTitle(`Hi, I'm ${bot.username}!`)
            .setThumbnail('https://i.imgur.com/vsLDxkK.png')
            .setDescription(
                "I'm here to help the Voids Within team with some moderation as well as the community challenges!"
            )
            .addFields(
                { name: 'Developer', value: `<@862537604138401822>`, inline: true },
                { name: 'Version', value: `v${version}`, inline: true }, // Added version
                { name: 'Uptime', value: `${uptimeString}`, inline: true },
                { name: 'Users in Server', value: `${totalUsers}`, inline: true },
                { name: 'Library', value: 'Discord.js v14', inline: true }
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
