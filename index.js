require('dotenv').config();
const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const { version } = require('./package.json');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
    ],
    partials: ['CHANNEL'],
});

client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

const MODERATOR_CHANNEL_IDS = process.env.MODERATOR_CHANNEL_IDS
    ? process.env.MODERATOR_CHANNEL_IDS.split(',')
    : [];
if (MODERATOR_CHANNEL_IDS.length === 0) {
    console.error('Error: MODERATOR_CHANNEL_IDS is not defined in the .env file.');
    process.exit(1); 
}

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
    }
});

client.on('messageCreate', async (message) => {
    // making sure the bot doesn't go into a loop talking to itself, that'd be wild.
    if (message.channel.type === 1 && !message.author.bot) {
        const embed = new EmbedBuilder()
            .setTitle('User Response')
            .setColor('#2ecc71')
            .setDescription(`${message.content}`)
            .setFooter({
                text: `${message.author.tag} | ${new Date().toLocaleString()}`,
                iconURL: message.author.displayAvatarURL({ dynamic: true }),
            });

        for (const channelId of MODERATOR_CHANNEL_IDS) {
            try {
                const moderatorChannel = await client.channels.fetch(channelId.trim());
                if (moderatorChannel) {
                    await moderatorChannel.send({ embeds: [embed] });
                }
            } catch (error) {
                console.error(`Failed to send user reply to moderator channel (${channelId}):`, error);
            }
        }
    }
});

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    console.log(`Cipher Bot - Version ${version}`);
    console.log('successfully finished startup');

    client.user.setPresence({
        activities: [{
            name: 'Dystopika', 
            type: 0, // Activity Type 0 = Playing, 1 = Streaming, 2 = Listening, 3 = Watching | using "Streaming" will set their icon to purple.
        }],
        status: 'online',
    });
});

client.login(process.env.BOT_TOKEN);
