const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Temporary in-memory storage, replace with database for persistence
const tickets = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Manage development tickets')
        .addSubcommand(sub =>
            sub.setName('create')
               .setDescription('Create a new ticket'))
        .addSubcommand(sub =>
            sub.setName('list')
               .setDescription('List all tickets')),

    async execute(interaction) {
        if (interaction.options.getSubcommand() === 'create') {
            const modal = new ModalBuilder()
                .setCustomId('createTicketModal')
                .setTitle('Create Ticket');

            const titleInput = new TextInputBuilder()
                .setCustomId('ticketTitle')
                .setLabel("Ticket Title")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const descriptionInput = new TextInputBuilder()
                .setCustomId('ticketDescription')
                .setLabel("Ticket Description")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            const row1 = new ActionRowBuilder().addComponents(titleInput);
            const row2 = new ActionRowBuilder().addComponents(descriptionInput);

            modal.addComponents(row1, row2);
            return interaction.showModal(modal);
        }

        if (interaction.options.getSubcommand() === 'list') {
            if (tickets.size === 0) return interaction.reply({ content: 'No tickets found.', flags: MessageFlags.Ephemeral});

            const ticketList = Array.from(tickets.values()).map(t => 
                `ID: ${t.id} | Title: ${t.title} | Status: ${t.status} | Importance: ${t.importance} | Assignee: ${t.assignee || 'Unassigned'}`
            ).join('\n');

            return interaction.reply({ content: ticketList, flags: MessageFlags.Ephemeral});
        }
    },

    async handleModalSubmit(interaction) {
        if (interaction.customId !== 'createTicketModal') return;

        const title = interaction.fields.getTextInputValue('ticketTitle');
        const description = interaction.fields.getTextInputValue('ticketDescription');

        const ticketId = Date.now().toString();
        tickets.set(ticketId, {
            id: ticketId,
            title,
            description,
            status: 'Open',
            importance: 'Minor',
            assignee: null,
            creator: interaction.user.id
        });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`assign_${ticketId}`)
                .setLabel('Assign')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`status_${ticketId}`)
                .setLabel('Change Status')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`importance_${ticketId}`)
                .setLabel('Set Importance')
                .setStyle(ButtonStyle.Secondary)
        );

        return interaction.reply({
            content: `Ticket created: **${title}** (ID: ${ticketId})`,
            components: [row]
        });
    },

    async handleButton(interaction) {
        const [action, ticketId] = interaction.customId.split('_');
        const ticket = tickets.get(ticketId);
        if (!ticket) return interaction.reply({ content: 'Ticket not found.', flags: MessageFlags.Ephemeral});

        if (action === 'assign') {
            const select = new StringSelectMenuBuilder()
                .setCustomId(`assignSelect_${ticketId}`)
                .setPlaceholder('Select assignee')
                .addOptions(interaction.guild.members.cache.map(m => ({ label: m.user.username, value: m.id })));

            const row = new ActionRowBuilder().addComponents(select);
            return interaction.reply({ content: 'Select an assignee:', components: [row], flags: MessageFlags.Ephemeral});
        }

        if (action === 'status') {
            const select = new StringSelectMenuBuilder()
                .setCustomId(`statusSelect_${ticketId}`)
                .setPlaceholder('Select status')
                .addOptions([
                    { label: 'Open', value: 'Open' },
                    { label: 'In Progress', value: 'In Progress' },
                    { label: 'Resolved', value: 'Resolved' },
                    { label: 'Closed', value: 'Closed' }
                ]);

            const row = new ActionRowBuilder().addComponents(select);
            return interaction.reply({ content: 'Select status:', components: [row], flags: MessageFlags.Ephemeral});
        }

        if (action === 'importance') {
            const select = new StringSelectMenuBuilder()
                .setCustomId(`importanceSelect_${ticketId}`)
                .setPlaceholder('Select importance')
                .addOptions([
                    { label: 'Minor', value: 'Minor' },
                    { label: 'Major', value: 'Major' },
                    { label: 'Critical', value: 'Critical' }
                ]);

            const row = new ActionRowBuilder().addComponents(select);
            return interaction.reply({ content: 'Select importance:', components: [row], flags: MessageFlags.Ephemeral});
        }
    },

    async handleSelect(interaction) {
        const [type, ticketId] = interaction.customId.split('_');
        const ticket = tickets.get(ticketId);
        if (!ticket) return interaction.reply({ content: 'Ticket not found.', flags: MessageFlags.Ephemeral});

        const selected = interaction.values[0];

        if (type === 'assignSelect') ticket.assignee = selected;
        if (type === 'statusSelect') ticket.status = selected;
        if (type === 'importanceSelect') ticket.importance = selected;

        return interaction.update({ content: `Ticket updated: **${ticket.title}**\nStatus: ${ticket.status}\nImportance: ${ticket.importance}\nAssignee: <@${ticket.assignee || 'Unassigned'}>`, components: [] });
    }
};