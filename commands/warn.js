const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const mysql = require('mysql2/promise');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn a user with a predefined warning ID.')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to warn.')
                .setRequired(true))
        .addStringOption(option =>
            option
                .setName('warningid')
                .setDescription('The ID of the predefined warning.')
                .setRequired(true)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const warningId = interaction.options.getString('warningid');
        const moderator = interaction.user;

        console.log('Warning ID:', warningId);

        if (!warningId) {
            return interaction.reply({ content: 'You must provide a valid warning ID.', ephemeral: true });
        }

        const MODERATOR_ROLE_ID = process.env.MODERATOR_ROLE_ID;

        const hasModeratorRole = interaction.member.roles.cache.has(MODERATOR_ROLE_ID);
        if (!hasModeratorRole) {
            return interaction.reply({ content: 'You do not have permission to issue a warning.', ephemeral: true });
        }

        const db = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });

        try {
            const [warningDetails] = await db.execute('SELECT * FROM predefined_warnings WHERE id = ?', [warningId]);

            if (warningDetails.length === 0) {
                return interaction.reply({ content: `No predefined warning found with ID: ${warningId}.`, ephemeral: true });
            }

            const description = warningDetails[0].description;

            await db.execute('INSERT INTO warnings (user_id, description) VALUES (?, ?)', [targetUser.id, description]);

            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('Warning Issued')
                .setDescription(`The warning has been successfully issued to ${targetUser.tag}.`)
                .addFields({
                    name: 'Warning ID',
                    value: warningId,
                    inline: true
                })
                .addFields({
                    name: 'Description',
                    value: description,
                    inline: false
                })
                .setFooter({ text: `Issued by ${moderator.tag}` })
                .setTimestamp();

            interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            interaction.reply({ content: 'An error occurred while issuing the warning.', ephemeral: true });
        } finally {
            await db.end();
        }
    },
};
