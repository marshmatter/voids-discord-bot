const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { version } = require('../package.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botinfo')
        .setDescription('Allow Cipher to introduce themself to you.'),
    async execute(interaction) {
        const bot = interaction.client.user;
        const uptime = process.uptime();
        const totalUsers = interaction.guild.memberCount;

        // Convert uptime to readable format
        const formatUptime = (seconds) => {
            const months = Math.floor(seconds / (30 * 24 * 60 * 60));
            seconds -= months * 30 * 24 * 60 * 60;
            
            const weeks = Math.floor(seconds / (7 * 24 * 60 * 60));
            seconds -= weeks * 7 * 24 * 60 * 60;
            
            const days = Math.floor(seconds / (24 * 60 * 60));
            seconds -= days * 24 * 60 * 60;
            
            const hours = Math.floor(seconds / (60 * 60));
            seconds -= hours * 60 * 60;
            
            const minutes = Math.floor(seconds / 60);
            seconds -= minutes * 60;
            
            const parts = [];
            
            if (months > 0) parts.push(`${months}mo`);
            if (weeks > 0) parts.push(`${weeks}w`);
            if (days > 0) parts.push(`${days}d`);
            if (hours > 0) parts.push(`${hours}h`);
            if (minutes > 0) parts.push(`${minutes}m`);
            if (seconds > 0) parts.push(`${Math.floor(seconds)}s`);
            
            return parts.join(' ') || '0s';
        };

        const embed = new EmbedBuilder()
            .setColor(0x7700ff)
            .setTitle(`Hi, I'm ${bot.username}!`)
            .setThumbnail('https://i.imgur.com/Ja8wUCa.png')
            .setDescription(
                "I'm here to help the Voids Within team with some moderation as well as the community challenges!"
            )
            .addFields(
                { name: 'Developer', value: `<@862537604138401822>`, inline: true },
                { name: 'Version', value: `v${version}`, inline: true },
                { name: 'Uptime', value: formatUptime(uptime), inline: true },
                { name: 'Users in Server', value: `${totalUsers}`, inline: true },
                { name: 'Library', value: 'Discord.js v14', inline: true }
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
