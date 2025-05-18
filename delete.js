require('dotenv').config();
const { REST, Routes } = require('discord.js');

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

// Use your application ID and (optionally) your guild ID
const applicationId = process.env.CLIENT_ID; // Your bot's application/client ID
const guildId = process.env.GUILD_ID; // Optional: Specify a guild ID to delete guild-specific commands

(async () => {
    try {
        console.log('Started removing all slash commands.');

        if (guildId) {
            // Delete all guild-specific commands
            await rest.put(
                Routes.applicationGuildCommands(applicationId, guildId),
                { body: [] }
            );
            console.log(`Successfully removed all guild commands for guild ID ${guildId}.`);
        } else {
            // Delete all global commands
            await rest.put(Routes.applicationCommands(applicationId), { body: [] });
            console.log('Successfully removed all global commands.');
        }
    } catch (error) {
        console.error('Error removing slash commands:', error);
    }
})();
