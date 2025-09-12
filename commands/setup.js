const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Sets up the server for a software development project.'),
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: 'You need admin permissions to run this command.', ephemeral: true });
        }

        const categories = ['Project', 'Development'];
        const channels = {
            'Project': ['general', 'project-overview', 'resources'],
            'Development': ['dev-discussion', 'todo', 'frontend', 'backend', 'github', 'deployments']
        };

        for (const categoryName of categories) {
            const category = await interaction.guild.channels.create({
                name: categoryName,
                type: 4 // category
            });

            for (const channelName of channels[categoryName]) {
                await interaction.guild.channels.create({
                    name: channelName,
                    type: 0, // text channel
                    parent: category.id
                });
            }
        }

        await interaction.reply('Server setup complete! All necessary channels have been created.');
    }
};