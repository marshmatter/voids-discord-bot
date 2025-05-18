require('dotenv').config();
const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActivityType } = require('discord.js');
const fs = require('fs');
const { version } = require('./package.json');
const steamForumMonitor = require('./modules/steamForumMonitor.js');
const logger = require('./modules/logger');

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
    logger.info(`Loaded command: ${command.data.name}`, {
        channel: 'SYSTEM',
        user: 'BOT'
    });
}

const MODERATOR_CHANNEL_IDS = process.env.MODERATOR_CHANNEL_IDS
    ? process.env.MODERATOR_CHANNEL_IDS.split(',')
    : [];
if (MODERATOR_CHANNEL_IDS.length === 0) {
    logger.error('MODERATOR_CHANNEL_IDS is not defined in the .env file.', {
        channel: 'SYSTEM',
        user: 'BOT'
    });
    process.exit(1);
}

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        logger.info(`Executing command: ${interaction.commandName}`, {
            channel: interaction.channel.name,
            user: interaction.user.tag,
            guild: interaction.guild?.name
        });
        
        await command.execute(interaction);
        
        logger.info(`Successfully executed command: ${interaction.commandName}`, {
            channel: interaction.channel.name,
            user: interaction.user.tag,
            guild: interaction.guild?.name
        });
    } catch (error) {
        logger.error(`Error executing command: ${interaction.commandName}`, {
            channel: interaction.channel.name,
            user: interaction.user.tag,
            guild: interaction.guild?.name,
            error: error.message
        });
        await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Sleep Token responses
    if (message.content.toLowerCase().includes('sleep token')) {
        const responses = [
            'The house must endure.',
            'The cycle must end.',
            'Worship.',
            'Nothing lasts forever.'
        ];
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        await message.reply(randomResponse);
        logger.info('Sleep Token response sent', {
            channel: message.channel.name,
            user: message.author.tag,
            guild: message.guild?.name
        });
    }

    // Checking to see if the message is a Direct Message.
    if (message.channel.type === 1) {
        logger.info('Received DM', {
            channel: 'DM',
            user: message.author.tag
        });

        const embed = new EmbedBuilder()
            .setTitle('User Response')
            .setColor('#2ecc71')
            .setFooter({
                text: `${message.author.tag} | ${new Date().toLocaleString()}`,
                iconURL: message.author.displayAvatarURL({ dynamic: true }),
            })
            .setTimestamp();

        if (message.content.trim()) {
            embed.setDescription(message.content);
        } else {
            embed.setDescription('No text provided.');
        }

        if (message.attachments.size > 0) {
            const imageAttachment = message.attachments.find(att => att.contentType && att.contentType.startsWith('image/'));
            if (imageAttachment) {
                embed.setImage(imageAttachment.url);
            }
        }

        // Send the embed mod channel
        for (const channelId of MODERATOR_CHANNEL_IDS) {
            try {
                const moderatorChannel = await client.channels.fetch(channelId.trim());
                if (moderatorChannel) {
                    await moderatorChannel.send({ embeds: [embed] });
                    logger.info('Forwarded DM to moderator channel', {
                        channel: 'DM',
                        user: message.author.tag
                    });
                }
            } catch (error) {
                logger.error('Failed to send user reply to moderator channel', {
                    channel: 'DM',
                    user: message.author.tag,
                    error: error.message
                });
            }
        }
    }
});

client.once('ready', () => {
    logger.info('Bot started', {
        channel: 'SYSTEM',
        user: 'BOT'
    });
    console.log('successfully finished startup');

    client.user.setPresence({
        activities: [{
            name: 'Dystopika',
            type: ActivityType.Playing,
        }],
        status: 'online',
    });

    // Start monitoring Steam forum
    steamForumMonitor.start(client);
});

// Add error handling for the client
client.on('error', (error) => {
    logger.error('Discord client error', {
        channel: 'SYSTEM',
        user: 'BOT',
        error: error.message
    });
});

client.on('warn', (warning) => {
    logger.warn('Discord client warning', {
        channel: 'SYSTEM',
        user: 'BOT',
        warning: warning
    });
});

process.on('unhandledRejection', (error) => {
    logger.error('Unhandled promise rejection', {
        channel: 'SYSTEM',
        user: 'BOT',
        error: error.message
    });
});

client.login(process.env.BOT_TOKEN);
