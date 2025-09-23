const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
require('dotenv').config();

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ] 
});

// Load command files dynamically
client.commands = new Map();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

const commands = [];

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
}

// Register slash commands
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
(async () => {
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();

// Handle interactions
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        await command.execute(interaction);
    } else if (interaction.isModalSubmit()) {
        const command = client.commands.get('ticket');
        if (!command) return;
        await command.handleModalSubmit(interaction);
    } else if (interaction.isButton()) {
        const command = client.commands.get('ticket');
        if (!command) return;
        await command.handleButton(interaction);
    } else if (interaction.isStringSelectMenu()) {
        const command = client.commands.get('ticket');
        if (!command) return;
        await command.handleSelect(interaction);
    }
});

client.login(process.env.TOKEN);