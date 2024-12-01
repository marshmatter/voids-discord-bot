const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const mysql = require('mysql2/promise');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('startchallenge')
        .setDescription('Start a new community challenge.')
        .addStringOption(option =>
            option.setName('theme')
                .setDescription('The theme for this community challenge.')
                .setRequired(false)
        )
        .addAttachmentOption(option =>
            option.setName('image')
                .setDescription('Optional image to display in the challenge thread.')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const MODERATOR_ROLE_IDS = process.env.MODERATOR_ROLE_ID.split(',');
        const CONTEST_ROLE_ID = process.env.CONTEST_ROLE_ID;
        const CHALLENGE_FORUM_ID = process.env.FORUM_CHALLENGE_ID;

        const hasModeratorRole = MODERATOR_ROLE_IDS.some(roleId => interaction.member.roles.cache.has(roleId));
        if (!hasModeratorRole) {
            return interaction.editReply({ content: 'You do not have permission to use this command.' });
        }

        const theme = interaction.options.getString('theme') || 'The possibilities are endless!';
        const image = interaction.options.getAttachment('image');

        const db = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });

        try {
            const challengeForum = await interaction.client.channels.fetch(CHALLENGE_FORUM_ID);

            const thread = await challengeForum.threads.create({
                name: `Challenge: ${theme}`,
                message: {
                    content: `<@&${CONTEST_ROLE_ID}> A new community challenge has begun! Share your best submissions here!`,
                    files: image ? [image.url] : [], // Attach the image if provided
                },
                autoArchiveDuration: 1440, // this cannot be increased, 24 hours is the max.
                reason: 'Community Challenge Start',
            });

            await db.execute(
                'INSERT INTO challenges (theme, state, thread_id, active) VALUES (?, ?, ?, 1)',
                [theme, 'Submissions', thread.id]
            );

            const embed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle('Community Challenge Started!')
                .setDescription(`A new community challenge has begun! Share your best submissions!`)
                .addFields(
                    { name: 'Theme', value: theme },
                    { name: 'How to Participate', value: '1. Type /submit in any channel.\n2. Upload your Image.\n3. Optionally, you may add a description of your image, should you wish to provide lore or a backstory!. ' }
                )
                .setFooter({ text: 'Good luck! We can’t wait to see your submissions!' })
                .setTimestamp();

            await thread.send({ embeds: [embed] });

            await interaction.editReply({ content: 'The challenge has been started successfully!' });
        } catch (error) {
            console.error('Error starting the challenge:', error);
            await interaction.editReply({ content: 'An error occurred while starting the challenge.' });
        } finally {
            await db.end();
        }
    },
};