const fetch = require('node-fetch');
const { EmbedBuilder } = require('discord.js');

// Move these to module scope and initialize with empty values
let lastKnownDiscussions = new Set();
let isFirstRun = true;
let activeChallenges = new Set();

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

// Add a function to check a specific forum category
async function checkForumCategory(categoryId, responseText) {
    const discussions = [];
    const topicPattern = /<div[^>]*?class="forum_topic(?!\s+[^"]*?sticky)[^"]*?"[^>]*?data-gidforumtopic="([^"]*)"[^>]*?>[\s\S]*?<div class="forum_topic_name[^"]*?"[^>]*?>(?:<[^>]*>)*([^<]+)[\s\S]*?<div class="forum_topic_op"[^>]*?>([^<]+)[\s\S]*?<a[^>]*?href="([^"]+)"[\s\S]*?<div class="forum_topic_lastpost"[^>]*?>([^<]+)<\/div>/g;

    let match;
    while ((match = topicPattern.exec(responseText)) !== null) {
        const [_, id, rawTitle, author, link, lastPost] = match;
        const title = cleanHtml(rawTitle);
        
        // Skip discussions with empty titles
        if (!title.trim()) {
            console.log('Skipping discussion with empty title');
            continue;
        }

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

        // Add this to track challenges
        if (title.toLowerCase().includes('challenge')) {
            activeChallenges.add({
                id: id,
                title: title,
                status: 'Active',
                created: new Date().toISOString(),
                author: author,
                link: link
            });
        }
    }
    return discussions;
}

// Update the main check function to handle multiple categories
async function checkSteamForum(client) {
    try {
        const categories = [
            { id: 0, name: 'General Discussions' },
            { id: 1, name: 'Technical Help' }
        ];

        const allDiscussions = [];

        for (const category of categories) {
            const url = `https://steamcommunity.com/app/${process.env.STEAM_APP_ID}/discussions/${category.id}/`;
            console.log(`\nChecking Steam forum category: ${category.name}...`);

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} for category ${category.name}`);
            }

            const responseText = await response.text();
            const discussions = await checkForumCategory(category.id, responseText);
            allDiscussions.push(...discussions);
        }

        // Process all discussions found
        if (allDiscussions.length > 0) {
            if (isFirstRun) {
                console.log('First run - building initial discussion list and posting...');
                await postDiscussionsToDiscord(client, allDiscussions);
                allDiscussions.forEach(discussion => lastKnownDiscussions.add(discussion.link));
                isFirstRun = false;
                console.log(`Initial discussion count: ${lastKnownDiscussions.size}`);
            } else {
                console.log(`Found ${allDiscussions.length} new discussion(s) to post`);
                await postDiscussionsToDiscord(client, allDiscussions);
                allDiscussions.forEach(discussion => lastKnownDiscussions.add(discussion.link));
            }
        }

    } catch (error) {
        console.error('Error in Steam forum check:', error);
    }
}

// Helper function to post discussions to Discord
async function postDiscussionsToDiscord(client, discussions) {
    const userIds = ['862537604138401822'];
    console.log('Attempting to send DMs to users:', userIds);
    
    try {
        // Fetch all users first
        const users = await Promise.all(userIds.map(id => client.users.fetch(id)));
        console.log(`Found ${users.length} users to notify`);
        
        for (const discussion of discussions) {
            // Skip discussions with empty titles
            if (!discussion.title.trim()) {
                console.log('Skipping discussion with empty title:', discussion);
                continue;
            }

            console.log(`Creating embed for discussion: "${discussion.title}"`);
            
            const embed = new EmbedBuilder()
                .setColor(0x1b2838)
                .setAuthor({
                    name: 'New Steam Discussion',
                    iconURL: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Steam_icon_logo.svg/512px-Steam_icon_logo.svg.png'
                })
                .setTitle(discussion.title || 'Untitled Discussion')
                .setURL(discussion.link)
                .setDescription(discussion.content.substring(0, 2048) || '*No content preview available*')
                .addFields([
                    {
                        name: '👤 Author',
                        value: discussion.author,
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

            // Send DM to each user
            for (const user of users) {
                console.log(`Sending DM to ${user.tag}...`);
                try {
                    await user.send({ embeds: [embed] });
                    console.log(`Successfully sent DM to ${user.tag}`);
                } catch (dmError) {
                    console.error(`Failed to send DM to ${user.tag}:`, dmError);
                }
            }
        }
    } catch (error) {
        console.error('Error sending DMs:', error.stack);
        console.error('Discussions:', JSON.stringify(discussions, null, 2));
    }
}

// Add this new function for startup notification
async function sendStartupNotification(client) {
    const userIds = ['862537604138401822'];
    console.log('Sending startup notification to users:', userIds);
    
    try {
        const users = await Promise.all(userIds.map(id => client.users.fetch(id)));
        
        const embed = new EmbedBuilder()
            .setColor(0x1b2838)
            .setAuthor({
                name: 'Steam Forum Monitor',
                iconURL: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Steam_icon_logo.svg/512px-Steam_icon_logo.svg.png'
            })
            .setTitle('Monitor Started')
            .setDescription('The Steam forum monitor has started and is now watching for new discussions.')
            .setTimestamp();

        for (const user of users) {
            console.log(`Sending startup notification to ${user.tag}...`);
            try {
                await user.send({ embeds: [embed] });
                console.log(`Successfully sent startup notification to ${user.tag}`);
            } catch (dmError) {
                console.error(`Failed to send startup notification to ${user.tag}:`, dmError);
            }
        }
    } catch (error) {
        console.error('Error sending startup notifications:', error.stack);
    }
}

// Add this function to export challenges
async function getActiveChallenges() {
    return Array.from(activeChallenges).map(challenge => ({
        id: challenge.id,
        status: challenge.status,
        created: challenge.created,
        title: challenge.title
    }));
}

// Update the start function to send the startup notification
module.exports = {
    start: async (client) => {
        console.log('Starting Steam forum monitor...');
        
        // Send startup notification first
        await sendStartupNotification(client);
        
        // Do initial check and wait for it to complete
        await checkSteamForum(client);
        
        // After initial check completes, start the interval
        console.log('Initial check complete, starting regular monitoring...');
        setInterval(() => checkSteamForum(client), CHECK_INTERVAL);
    },
    getActiveChallenges
}; 