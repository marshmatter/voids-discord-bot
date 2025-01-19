const fetch = require('node-fetch');
const { EmbedBuilder } = require('discord.js');

let lastKnownDiscussions = new Set();
let lastCheck = Date.now();

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
    // First, check if it's a date format like "Jan 15 @ 2:15pm"
    const dateMatch = timeStr.match(/(\w+)\s+(\d+)\s*@\s*(\d+):(\d+)(am|pm)/i);
    if (dateMatch) {
        const [_, month, day, hour, minute, ampm] = dateMatch;
        const now = new Date();
        
        // Always use 2024 as the base year for consistency
        const year = 2024;
        const date = new Date(year, getMonthNumber(month), parseInt(day));
        let hours = parseInt(hour);
        
        // Convert to 24 hour format
        if (ampm.toLowerCase() === 'pm' && hours < 12) hours += 12;
        if (ampm.toLowerCase() === 'am' && hours === 12) hours = 0;
        
        date.setHours(hours, parseInt(minute));
        
        // For testing purposes, pretend "now" is also in 2024
        const testNow = new Date(2024, now.getMonth(), now.getDate(), 
                               now.getHours(), now.getMinutes(), now.getSeconds());
        
        // Calculate minutes ago
        const minutesAgo = Math.floor((testNow - date) / (1000 * 60));
        console.log('Time parsing:', {
            timeStr,
            date: date.toISOString(),
            minutesAgo,
            testNow: testNow.toISOString()
        });
        return minutesAgo;
    }

    // Then check for relative time formats
    const matches = {
        'Just now': 0,
        'minute ago': 1,
        'minutes ago': match => parseInt(match),
        'hour ago': 60,
        'hours ago': match => parseInt(match) * 60,
        'day ago': 24 * 60,
        'days ago': match => parseInt(match) * 24 * 60
    };

    for (const [pattern, minutes] of Object.entries(matches)) {
        if (timeStr.includes(pattern)) {
            if (typeof minutes === 'function') {
                const num = parseInt(timeStr);
                return minutes(num);
            }
            return minutes;
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

        // Debug client state
        console.log('Bot Status:', {
            loggedIn: client.user?.tag || 'Not logged in',
            ready: client.isReady()
        });

        const response = await fetch(url, {
            headers: {
                'Accept': 'text/html',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Cookie': 'Steam_Language=english'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        responseText = await response.text();
        const discussions = [];
        const forumTopicPattern = /<div[^>]*?class="forum_topic[^"]*"[^>]*?data-gidforumtopic="([^"]*)"[^>]*?>[\s\S]*?<a[^>]*?href="([^"]*)"[^>]*?>[\s\S]*?<div class="forum_topic_name[^"]*">([^<]+)<\/div>/g;
        let topicMatch;

        while ((topicMatch = forumTopicPattern.exec(responseText)) !== null) {
            const topicId = topicMatch[1];
            const link = topicMatch[2];
            const title = topicMatch[3];

            // Skip if we've seen this discussion before
            if (lastKnownDiscussions.has(link)) {
                continue;
            }

            // Find the tooltip data for this specific topic
            const tooltipPattern = new RegExp(`data-gidforumtopic="${topicId}"[^>]*?data-tooltip-forum="([^"]*)"`, 'i');
            const tooltipMatch = responseText.match(tooltipPattern);
            
            if (tooltipMatch) {
                const tooltipData = decodeHtml(tooltipMatch[1]);
                const contentMatch = tooltipData.match(/<div class="topic_hover_text">([\s\S]*?)<\/div>/i);
                const authorMatch = tooltipData.match(/Posted by:\s*<span class="topic_hover_data">([^<]+)<\/span>/i);
                const timeMatch = tooltipData.match(/Posted by:[^<]*<span[^>]*>[^<]*<\/span>,\s*<span[^>]*>([^<]+)<\/span>/i);

                if (authorMatch && timeMatch) {
                    const time = cleanHtml(timeMatch[1]);
                    const minutesAgo = parseTimeAgo(time);
                    
                    // Only add discussions that are from the current month/year
                    const now = new Date();
                    const discussionDate = new Date(2024, getMonthNumber(time.split(' ')[0]), parseInt(time.split(' ')[1]));
                    
                    if (discussionDate.getMonth() === now.getMonth() && 
                        discussionDate.getDate() === now.getDate()) {
                        const discussion = {
                            id: topicId,
                            title: cleanHtml(title),
                            content: contentMatch ? cleanHtml(contentMatch[1]) : '',
                            link,
                            author: cleanHtml(authorMatch[1]),
                            time,
                            minutesAgo
                        };
                        discussions.push(discussion);
                    }
                }
            }
        }

        // Filter for only new or recent discussions
        const newDiscussions = discussions.filter(discussion => {
            const isRecent = discussion.minutesAgo !== null && discussion.minutesAgo <= 60; // Changed to 60 minutes (1 hour)
            const isNew = !lastKnownDiscussions.has(discussion.link);
            return isRecent && isNew; // Must be both recent AND new
        });

        if (newDiscussions.length > 0) {
            console.log(`Found ${newDiscussions.length} new discussion(s) from the last hour`);
            const modChannelId = process.env.MODERATOR_CHANNEL_IDS.split(',')[0];

            try {
                const modChannel = await client.channels.fetch(modChannelId);
                
                for (const discussion of newDiscussions) {
                    console.log(`Posting discussion: "${discussion.title}"`);
                    
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

                    // If there's no content, we can add a note
                    if (!discussion.content) {
                        embed.addFields({
                            name: '💡 Note',
                            value: 'Click the title above to view the full discussion on Steam'
                        });
                    }

                    try {
                        const sent = await modChannel.send({ embeds: [embed] });
                        console.log('Successfully sent message:', sent.id);
                        lastKnownDiscussions.add(discussion.link);
                    } catch (sendError) {
                        console.error('Error sending message:', {
                            error: sendError.message,
                            code: sendError.code,
                            status: sendError.status
                        });
                    }
                }
            } catch (channelError) {
                console.error('Error fetching channel:', {
                    error: channelError.message,
                    code: channelError.code,
                    status: channelError.status
                });
            }
        } else {
            console.log('No new discussions found');
        }

        // Debug the known discussions set
        console.log('Known discussions count:', lastKnownDiscussions.size);

    } catch (error) {
        console.error('Error in Steam forum check:', {
            message: error.message,
            stack: error.stack
        });
    }
}

module.exports = {
    start: (client) => {
        console.log('Starting Steam forum monitor...');
        // Check every minute
        setInterval(() => checkSteamForum(client), 60 * 1000);
        
        // Initial check
        checkSteamForum(client);
    }
}; 