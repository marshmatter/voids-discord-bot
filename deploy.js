require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');

const { CLIENT_ID, GUILD_ID, BOT_TOKEN } = process.env;

const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    commands.push(command.data.toJSON());
}

// This section is to unregister existing bot commands and then register the new version to prevent weird issues (such as multiples of the same command.)
const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (slash) commands.');

        // This is the unregister portion. Note that this is specific to a guild and not global.
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [] });

        // Registers new commands, ezpz :sip:
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });

        console.log('Successfully reloaded application (slash) commands.');
    } catch (error) {
        console.error(error);
    }
})();