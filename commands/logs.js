const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('logs')
        .setDescription('Display help information on how to get your game logs when requesting for help.'),
    async execute(interaction) {
        
        const embed = new EmbedBuilder()
            .setAuthor({
                name: "Dystopika FAQ",
            })
            .setTitle("Dystopika Log Directory")
            .setDescription("In order to help us help you when things go wrong, you can go retrieve your Dystopika log and upload it here!\n\n1. Open your Windows Explorer\n2. Copy and paste the location of the log file into your Explorer's address bar:\n\n```C:\\Users\\%USERNAME%\\AppData\\LocalLow\\Voids Within\\Dystopika```\n3. Upload the file called `Player.log` to the bug post.\n4. Await help :)\n\nIf you don't have visible file extensions configured in your Explorer, it'll just be the file named `Player` with the type `Text Document`.")                .setImage("https://i.imgur.com/jbX6dW6.gif")
            .setColor("#7700ff")
            .setFooter({
                text: "If you have any further questions, please let us know!",
            })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
