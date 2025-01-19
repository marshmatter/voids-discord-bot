const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const mysql = require('mysql2/promise');

function scheduleReminders(client, submissionsClose, threadId, challengeId, theme) {
    const now = new Date().getTime();
    const closeTime = new Date(submissionsClose + ' UTC').getTime();
    
    // Schedule reminders at different intervals
    const reminders = [
        { time: 24 * 60 * 60 * 1000, message: '24 hours' },    // 24 hours
        { time: 6 * 60 * 60 * 1000, message: '6 hours' },      // 6 hours
        { time: 60 * 60 * 1000, message: '1 hour' },           // 1 hour
        { time: 30 * 60 * 1000, message: '30 minutes' }        // 30 minutes
    ];

    reminders.forEach(reminder => {
        const timeUntilReminder = closeTime - reminder.time - now;
        
        // Only schedule if the reminder is in the future
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

                    await thread.send({ 
                        content: `<@&${process.env.CONTEST_ROLE_ID}>`,
                        embeds: [reminderEmbed]
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
            const image = interaction.options.getAttachment('image');

            const challengeForum = await interaction.client.channels.fetch(CHALLENGE_FORUM_ID);

            const thread = await challengeForum.threads.create({
                name: `Challenge: ${theme}`,
                message: {
                    content: `<@&${CONTEST_ROLE_ID}>  A new community challenge has begun! Feel free to discuss the challenge here. Enter your submission via /submit when you're ready! You may revise your submission until voting has started. Additionally, submissions will remain private until voting has started!`,
                    files: image ? [image.url] : [],
                },
                autoArchiveDuration: 1440,
                reason: 'Community Challenge Start',
            });

            const [result] = await db.execute(
                'INSERT INTO challenges (theme, description, submissions_close, voting_begins, voting_ends, thread_id, state, active) VALUES (?, ?, ?, ?, ?, ?, "Submissions", 1)',
                [theme, description, submissionsClose, votingBegins, votingEnds, thread.id]
            );            

            const submissionsCloseDate = new Date(submissionsClose + ' UTC');
            const votingBeginsDate = new Date(votingBegins + ' UTC');
            const votingEndsDate = new Date(votingEnds + ' UTC');

            const embed = new EmbedBuilder()
                .setColor(0x7700ff)
                .setTitle('Community Challenge Started!')
                .addFields(
                    { name: 'Theme', value: theme },
                    { name: 'Description', value: description },
                    { name: 'Submissions Close', value: `<t:${Math.floor(submissionsCloseDate.getTime() / 1000)}:F>` },
                    { name: 'Voting Begins', value: `<t:${Math.floor(votingBeginsDate.getTime() / 1000)}:F>` },
                    { name: 'Voting Ends', value: `<t:${Math.floor(votingEndsDate.getTime() / 1000)}:F>` },
                    { name: 'How to Participate', value: '1. Type /submit in any channel.\n2. Upload your Image.\n3. Optionally, add the lore/backstory via the "description"!' }
                )
                .setFooter({ text: 'Good luck! We can’t wait to see your submissions!' })
                .setTimestamp();

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
