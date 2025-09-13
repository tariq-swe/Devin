const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Sets up the server for a software development project.'),
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: 'You need admin permissions to run this command.', ephemeral: true });
        }

        const categories = ['Project', 'Development', 'Kanban'];
        const channels = {
            'Project': ['general', 'project-overview', 'resources'],
            'Kanban': ['todo', 'in-progress', 'done'],
            'Development': ['dev-discussion', 'github', 'frontend', 'backend', 'deployments']
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