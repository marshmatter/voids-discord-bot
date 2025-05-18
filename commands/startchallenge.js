const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ThreadAutoArchiveDuration } = require('discord.js');
const mysql = require('mysql2/promise');

function scheduleReminders(client, submissionsClose, threadId, challengeId, theme) {
    const now = new Date().getTime();
    const closeTime = new Date(submissionsClose + ' UTC').getTime();
    
    const reminders = [
        { time: 24 * 60 * 60 * 1000, message: '24 hours' },    // 24 hours
//        { time: 6 * 60 * 60 * 1000, message: '6 hours' },      // 6 hours
//        { time: 60 * 60 * 1000, message: '1 hour' },           // 1 hour
//        { time: 30 * 60 * 1000, message: '30 minutes' }        // 30 minutes
    ];

    reminders.forEach(reminder => {
        const timeUntilReminder = closeTime - reminder.time - now;
        
        if (timeUntilReminder > 0) {
            setTimeout(async () => {
                try {
                    const thread = await client.channels.fetch(threadId);
                    if (!thread) return;

                    const reminderEmbed = new EmbedBuilder()
                        .setColor(0xFF9300)
                        .setTitle('⏰ Submission Deadline Approaching!')
                        .setDescription(
                            `**Only ${reminder.message} left** to submit your entry for:\n` +
                            `"${theme}"\n\n` +
                            `Submissions close <t:${Math.floor(closeTime / 1000)}:R>\n\n` +
                            `Use \`/submit\` to enter your submission!`
                        )
                        .setTimestamp();

                    const reminderButtons = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('submit_entry')
                                .setLabel('How to Submit')
                                .setStyle(ButtonStyle.Secondary)
                                .setEmoji('📝')
                        );

                    await thread.send({ 
                        content: `<@&${process.env.CONTEST_ROLE_ID}>`,
                        embeds: [reminderEmbed],
                        components: [reminderButtons]
                    });

                } catch (error) {
                    console.error(`Error sending reminder:`, error);
                }
            }, timeUntilReminder);
        }
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('startchallenge')
        .setDescription('Start a new community challenge.')
        .addStringOption(option =>
            option.setName('theme')
                .setDescription('The theme for this community challenge.')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('description')
                .setDescription('Add a description for the challenge.')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('submissions_close')
                .setDescription('Submissions close date and time (YYYY-MM-DD HH:MM:SS).')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('voting_begins')
                .setDescription('Voting begins date and time (YYYY-MM-DD HH:MM:SS).')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('voting_ends')
                .setDescription('Voting ends date and time (YYYY-MM-DD HH:MM:SS).')
                .setRequired(true)
        )
        .addAttachmentOption(option =>
            option.setName('image')
                .setDescription('Required image to display in the challenge thread.')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('approved_mods')
                .setDescription('Format: "Mod Name|Workshop URL" (one per line). Example: "My Mod|https://steamcommunity.com/..."')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const MODERATOR_ROLE_IDS = process.env.MODERATOR_ROLE_ID.split(',');
        const CONTEST_ROLE_ID = process.env.CONTEST_ROLE_ID;
        const CHALLENGE_FORUM_ID = process.env.FORUM_CHALLENGE_ID;
        const GENERAL_CHAT_ID = process.env.GENERAL_CHAT_ID;

        const hasModeratorRole = MODERATOR_ROLE_IDS.some(roleId => interaction.member.roles.cache.has(roleId));
        if (!hasModeratorRole) {
            return interaction.editReply({ content: 'You do not have permission to use this command.' });
        }

        const db = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });

        try {
            const [rows] = await db.execute(
                'SELECT * FROM challenges WHERE state = "Submissions" LIMIT 1'
            );

            if (rows.length > 0) {
                return interaction.editReply({ content: 'There is currently a challenge accepting submissions! The current challenge must at least be in the voting stage before you can start another challenge.' });
            }

            const theme = interaction.options.getString('theme') || 'The possibilities are endless!';
            const description = interaction.options.getString('description') || 'No description provided.';
            const submissionsClose = interaction.options.getString('submissions_close');
            const votingBegins = interaction.options.getString('voting_begins');
            const votingEnds = interaction.options.getString('voting_ends');
            const approvedMods = interaction.options.getString('approved_mods') || '';
            const image = interaction.options.getAttachment('image');

            // ALTER TABLE challenges ADD COLUMN approved_mods TEXT; - I will forget this if I don't write it down here.
            
            let approvedModsList = '';
            if (approvedMods) {
                const modEntries = approvedMods.split('"').filter(entry => entry.trim());
                approvedModsList = modEntries.map(entry => {
                    const [name, url] = entry.split('|').map(part => part.trim());
                    if (!name || !url) return null;
                    return `<:CF5:1373582548030197840> [${name}](${url})`;
                }).filter(Boolean).join('\n');
            }

            const challengeForum = await interaction.client.channels.fetch(CHALLENGE_FORUM_ID);

            const thread = await challengeForum.threads.create({
                name: `Challenge: ${theme}`,
                message: {
                    content: `<@&${CONTEST_ROLE_ID}>  A new community challenge has begun! Feel free to discuss the challenge here. Enter your submission via /submit when you're ready!`,
                    files: image ? [image.url] : []
                },
                autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
                reason: 'Community Challenge Start'
            });

            const [result] = await db.execute(
                'INSERT INTO challenges (theme, description, submissions_close, voting_begins, voting_ends, thread_id, state, active, approved_mods) VALUES (?, ?, ?, ?, ?, ?, "Submissions", 1, ?)',
                [theme, description, submissionsClose, votingBegins, votingEnds, thread.id, approvedMods]
            );            

            const submissionsCloseDate = new Date(submissionsClose + ' UTC');
            const votingBeginsDate = new Date(votingBegins + ' UTC');
            const votingEndsDate = new Date(votingEnds + ' UTC');

            const embed = new EmbedBuilder()
                .setColor(0x7700ff)
                .setTitle('🎨 New Community Challenge')
                .setDescription(
                    `### ${theme}\n\n` +
                    `${description}\n` +
                    `<:D5:1373582216185118720><:D5:1373582216185118720><:D5:1373582216185118720><:D5:1373582216185118720><:D5:1373582216185118720><:D5:1373582216185118720><:D5:1373582216185118720><:D5:1373582216185118720><:D5:1373582216185118720><:D5:1373582216185118720><:D5:1373582216185118720><:D5:1373582216185118720><:D5:1373582216185118720><:D5:1373582216185118720><:D5:1373582216185118720><:D5:1373582216185118720><:D5:1373582216185118720><:D5:1373582216185118720><:D5:1373582216185118720><:D5:1373582216185118720>`
                )
                .addFields(
                    { 
                        name: '⏰ Timeline', 
                        value: 
                            `<:CF5:1373582548030197840> **Submissions Close:** <t:${Math.floor(submissionsCloseDate.getTime() / 1000)}:F>\n` +
                            `<:CF5:1373582548030197840> **Voting Begins:** <t:${Math.floor(votingBeginsDate.getTime() / 1000)}:F>\n` +
                            `<:CF5:1373582548030197840> **Voting Ends:** <t:${Math.floor(votingEndsDate.getTime() / 1000)}:F>`
                    },
                    { 
                        name: '📝 How to Participate', 
                        value: 
                            `<:CF5:1373582548030197840> Use \`/submit\` in any channel\n` +
                            `<:CF5:1373582548030197840> Upload your Image\n` +
                            `<:CF5:1373582548030197840> Add your lore/backstory via the "description" field\n` +
                            `<:CF5:1373582548030197840> Wait for the voting phase to begin!`
                    },
                    {
                        name: '⏳ Time Remaining',
                        value: 
                            `<:CF5:1373582548030197840> **Submissions:** <t:${Math.floor(submissionsCloseDate.getTime() / 1000)}:R>\n` +
                            `<:CF5:1373582548030197840> **Voting:** <t:${Math.floor(votingBeginsDate.getTime() / 1000)}:R> until <t:${Math.floor(votingEndsDate.getTime() / 1000)}:R>`
                    }
                )
                .setFooter({ 
                    text: 'Good luck! We cannot wait to see your submissions!',
                    iconURL: interaction.guild.iconURL()
                })
                .setTimestamp();

            if (image) {
                embed.setImage(image.url);
            }

            // Add approved mods field if there are any
            if (approvedModsList) {
                embed.addFields({
                    name: '📦 Approved Mods',
                    value: approvedModsList
                });
            }

            await thread.send({ embeds: [embed] });

            const generalChat = await interaction.client.channels.fetch(GENERAL_CHAT_ID);
            const announcementEmbed = new EmbedBuilder()
                .setColor(0x7700ff)
                .setTitle('🚨 A New Community Challenge Has Started! 🚨')
                .setDescription(
                    `A new community challenge has just started! Visit <#${CHALLENGE_FORUM_ID}> to learn more.\n\n` +
                    `Want to be notified about current and future challenges? Grant yourself the "Challenge Alerts" role by typing \`/challengealerts\`.`
                )
                .setTimestamp();

            await generalChat.send({ embeds: [announcementEmbed] });

            const auditChannel = await interaction.client.channels.fetch(process.env.AUDIT_CHANNEL_ID);
            const auditEmbed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('Challenge Started')
                .addFields(
                    { name: 'Action By', value: interaction.user.tag },
                    { name: 'Challenge', value: theme },
                    { name: 'Challenge ID', value: result.insertId.toString() }
                )
                .setTimestamp();

            await auditChannel.send({ embeds: [auditEmbed] });

            scheduleReminders(
                interaction.client,
                submissionsClose,
                thread.id,
                result.insertId,
                theme
            );

            await interaction.editReply({ content: 'The challenge has been started successfully!' });
        } catch (error) {
            console.error('Error starting the challenge:', error);
            await interaction.editReply({ content: 'An error occurred while starting the challenge.' });
        } finally {
            await db.end();
        }
    },
};
