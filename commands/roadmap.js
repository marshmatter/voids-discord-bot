const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roadmap')
        .setDescription('View the most updated roadmap for Dystopika!'),
    async execute(interaction) {
        
        const embed = new EmbedBuilder()
        .setAuthor({
          name: "Dystopika FAQ",
        })
        .setTitle("Dystopika Roadmap")
        .setDescription("This is the current roadmap of updates coming to Dystopika. This roadmap may be updated from time, so be sure to check back later!")
        .setImage("https://i.imgur.com/FJD6e5v.png")
        .setColor("#7700ff")
        .setFooter({
          text: "If you have any further questions, please let us know!",
        })
        .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
