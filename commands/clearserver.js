const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clearserver')
    .setDescription('Deletes all channels and categories, then creates a new text channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.reply({ content: 'Clearing all channels and categories...', ephemeral: true });

    const guild = interaction.guild;
    if (!guild) return;

    // delete channels
    const channels = guild.channels.cache;
    for (const [id, channel] of channels) {
      try {
        await channel.delete();
      } catch (err) {
        console.error(`Failed to delete channel ${channel.name}:`, err);
      }
    }

    // create default channel
    try {
      await guild.channels.create({
        name: 'general',
        type: 0 // 0 = text channel
      });
    } catch (err) {
      console.error('Failed to create default channel:', err);
    }
  },
};