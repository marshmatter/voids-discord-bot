const fetch = require('node-fetch');
const { EmbedBuilder } = require('discord.js');

// Move these to module scope and initialize with empty values
let lastKnownDiscussions = new Set();
let isFirstRun = true;

const CHECK_INTERVAL = 60 * 1000; // 60 seconds

function cleanHtml(str) {
    return str
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/<[^>]*>/g, '')
        .replace(/\t/g, '')
        .replace(/\n/g, ' ')
        .trim();
}

function parseTimeAgo(timeStr) {
    // Check for "just now"
    if (timeStr.toLowerCase() === 'just now') {
        return 0;
    }

    // Check for "X minutes/hours ago"
    const relativeMatch = timeStr.match(/(\d+)\s*(minute|minutes|hour|hours)\s*ago/i);
    if (relativeMatch) {
        const [_, amount, unit] = relativeMatch;
        const number = parseInt(amount);
        
        switch(unit.toLowerCase()) {
            case 'minute':
            case 'minutes':
                return number;
            case 'hour':
            case 'hours':
                return number * 60;
        }
    }

    return null;
}

function getMonthNumber(monthStr) {
    const months = {
        'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
        'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
    };
    return months[monthStr.toLowerCase().substring(0, 3)] || 0;
}

function decodeHtml(html) {
    return html
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&');
}

async function checkSteamForum(client) {
    let responseText = '';
    try {
        const url = `https://steamcommunity.com/app/${process.env.STEAM_APP_ID}/discussions/`;
        console.log('\nChecking Steam forum for new discussions...');

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        responseText = await response.text();
        const discussions = [];
        
        // Find all forum topics with their last post times
        const topicPattern = /<div[^>]*?class="forum_topic(?!\s+[^"]*?sticky)[^"]*?"[^>]*?data-gidforumtopic="([^"]*)"[^>]*?>[\s\S]*?<div class="forum_topic_name[^"]*?"[^>]*?>(?:<[^>]*>)*([^<]+)[\s\S]*?<div class="forum_topic_op"[^>]*?>([^<]+)[\s\S]*?<a[^>]*?href="([^"]+)"[\s\S]*?<div class="forum_topic_lastpost"[^>]*?>([^<]+)<\/div>/g;

        let match;
        while ((match = topicPattern.exec(responseText)) !== null) {
            const [_, id, rawTitle, author, link, lastPost] = match;
            const title = cleanHtml(rawTitle);
            const time = cleanHtml(lastPost);

            // Extract the tooltip content for the preview
            const tooltipMatch = match[0].match(/data-tooltip-forum="([^"]*)"/);
            const tooltipContent = tooltipMatch ? 
                decodeHtml(tooltipMatch[1]).match(/<div class="topic_hover_text">([\s\S]*?)<\/div>/i) : null;
            const content = tooltipContent ? cleanHtml(tooltipContent[1]) : '';

            console.log('Found topic:', {
                id,
                title,
                author: cleanHtml(author),
                time,
                link
            });

            // Check if this is a recent post
            if (time.match(/(?:just now|\d+\s*(?:minutes?|hours?)\s*ago)/i)) {
                const minutesAgo = parseTimeAgo(time);
                
                if (minutesAgo !== null && !lastKnownDiscussions.has(link)) {
                    const discussion = {
                        id,
                        title,
                        author: cleanHtml(author),
                        time,
                        link,
                        minutesAgo,
                        content
                    };
                    discussions.push(discussion);
                    console.log('Added new discussion:', {
                        title,
                        time,
                        minutesAgo
                    });
                } else {
                    console.log(`Skipping discussion "${title}": minutesAgo=${minutesAgo}, known=${lastKnownDiscussions.has(link)}`);
                }
            } else {
                console.log(`Skipping discussion "${title}": not a recent post (${time})`);
            }
        }

        // Process discussions
        if (discussions.length > 0) {
            if (isFirstRun) {
                console.log('First run - building initial discussion list and posting...');
                await postDiscussionsToDiscord(client, discussions);
                discussions.forEach(discussion => lastKnownDiscussions.add(discussion.link));
                isFirstRun = false;
                console.log(`Initial discussion count: ${lastKnownDiscussions.size}`);
            } else {
                console.log(`Found ${discussions.length} new discussion(s) to post`);
                await postDiscussionsToDiscord(client, discussions);
                // Add new discussions to known set after posting
                discussions.forEach(discussion => lastKnownDiscussions.add(discussion.link));
            }
        }

    } catch (error) {
        console.error('Error in Steam forum check:', error);
    }
}

// Helper function to post discussions to Discord
async function postDiscussionsToDiscord(client, discussions) {
    const modChannelId = process.env.MODERATOR_CHANNEL_IDS.split(',')[0];
    console.log('Attempting to post to Discord channel:', modChannelId);
    
    try {
        const modChannel = await client.channels.fetch(modChannelId);
        if (!modChannel) {
            throw new Error(`Could not find Discord channel with ID: ${modChannelId}`);
        }
        
        console.log(`Found Discord channel: ${modChannel.name}`);
        
        for (const discussion of discussions) {
            console.log(`Creating embed for discussion: "${discussion.title}"`);
            
            const embed = new EmbedBuilder()
                .setColor(0x1b2838)
                .setAuthor({
                    name: 'New Steam Discussion',
                    iconURL: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Steam_icon_logo.svg/512px-Steam_icon_logo.svg.png'
                })
                .setTitle(discussion.title)
                .setURL(discussion.link)
                .setDescription(discussion.content.substring(0, 2048) || '*No content preview available*')
                .addFields([
                    {
                        name: '👤 Author',
                        value: discussion.author,
                        inline: true
                    },
                    {
                        name: '⏰ Posted',
                        value: discussion.time,
                        inline: true
                    }
                ])
                .setFooter({
                    text: 'Dystopika Steam Community',
                    iconURL: 'https://cdn.akamai.steamstatic.com/steam/apps/2379910/capsule_231x87.jpg'
                })
                .setTimestamp();

            if (!discussion.content) {
                embed.addFields({
                    name: '💡 Note',
                    value: 'Click the title above to view the full discussion on Steam'
                });
            }

            console.log('Sending embed to Discord...');
            await modChannel.send({ embeds: [embed] });
            console.log('Successfully posted discussion to Discord');
        }
    } catch (error) {
        console.error('Error posting to Discord:', error.stack);
        // Log the channel ID and discussions for debugging
        console.error('Channel ID:', modChannelId);
        console.error('Discussions:', JSON.stringify(discussions, null, 2));
    }
}

module.exports = {
    start: async (client) => {
        console.log('Starting Steam forum monitor...');
        
        // Do initial check and wait for it to complete
        await checkSteamForum(client);
        
        // After initial check completes, start the interval
        console.log('Initial check complete, starting regular monitoring...');
        setInterval(() => checkSteamForum(client), CHECK_INTERVAL);
    }
}; 