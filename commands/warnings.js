const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const mysql = require('mysql2/promise');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warnings')
        .setDescription('View the warning history of a user.')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to view warnings for.')
                .setRequired(true)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const moderator = interaction.user;

        const MODERATOR_ROLE_IDS = process.env.MODERATOR_ROLE_ID.split(',');

        const hasModeratorRole = MODERATOR_ROLE_IDS.some(roleId => interaction.member.roles.cache.has(roleId));
        if (!hasModeratorRole) {
            return interaction.reply({ content: 'You do not have permission to view warnings.', ephemeral: true });
        }

        const db = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });

        try {
            console.log(`Fetching warnings for user ID: ${targetUser.id}`);

            const [warnings] = await db.execute('SELECT * FROM warnings WHERE user_id = ?', [targetUser.id]);

            console.log(warnings);

            if (!warnings || warnings.length === 0) {
                return interaction.reply({ content: `${targetUser.tag} has no warnings.` });
            }

            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle(`${targetUser.tag}'s Warning History`)
                .setDescription('Here is a list of the warnings for this user:')
                .setTimestamp();

            warnings.forEach(warning => {
                embed.addFields({
                    name: `Warning ID: ${warning.id}`,
                    value: `**Description**: ${warning.description}`,
                    inline: false
                });
            });

            interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            interaction.reply({ content: 'An error occurred while fetching the warnings.', ephemeral: true });
        } finally {
            await db.end();
        }
    },
};
