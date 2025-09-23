const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const Database = require('better-sqlite3');
const db = new Database('tickets.db');

db.prepare(`CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    status TEXT,
    importance TEXT,
    assignee TEXT,
    creator TEXT,
    threadId TEXT,
    messageId TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
)`).run();

function getStatusEmoji(status) {
    const emojis = {
        'Open': '🟢',
        'In Progress': '🟡',
        'Under Review': '🔵',
        'Resolved': '✅',
        'Closed': '❌'
    };
    return emojis[status] || '⚪';
}

function getImportanceEmoji(importance) {
    const emojis = {
        'Minor': '🟢',
        'Major': '🟡',
        'Critical': '🔴'
    };
    return emojis[importance] || '⚪';
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Manage development tickets')
        .addSubcommand(sub =>
            sub.setName('create')
               .setDescription('Create a new ticket')
               .addStringOption(option =>
                   option.setName('title')
                         .setDescription('Ticket title')
                         .setRequired(true)
                         .setMaxLength(100))
               .addStringOption(option =>
                   option.setName('description')
                         .setDescription('Ticket description')
                         .setRequired(true)
                         .setMaxLength(1000))
               .addStringOption(option =>
                   option.setName('priority')
                         .setDescription('Priority level')
                         .setRequired(false)
                         .addChoices(
                             { name: '🟢 Minor', value: 'Minor' },
                             { name: '🟡 Major', value: 'Major' },
                             { name: '🔴 Critical', value: 'Critical' }
                         ))
               .addStringOption(option =>
                   option.setName('status')
                         .setDescription('Initial status')
                         .setRequired(false)
                         .addChoices(
                             { name: '🟢 Open', value: 'Open' },
                             { name: '🟡 In Progress', value: 'In Progress' },
                             { name: '🔵 Under Review', value: 'Under Review' },
                             { name: '✅ Resolved', value: 'Resolved' },
                             { name: '❌ Closed', value: 'Closed' }
                         ))
               .addUserOption(option =>
                   option.setName('assignee')
                         .setDescription('Assign ticket to user')
                         .setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('list')
               .setDescription('List all tickets'))
        .addSubcommand(sub =>
            sub.setName('view')
               .setDescription('View a specific ticket')
               .addStringOption(option =>
                   option.setName('id')
                         .setDescription('Ticket ID')
                         .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('delete')
               .setDescription('Delete a specific ticket')
               .addStringOption(option =>
                   option.setName('id')
                         .setDescription('Ticket ID')
                         .setRequired(true))),

    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'create') {
                const title = interaction.options.getString('title');
                const description = interaction.options.getString('description');
                const priority = interaction.options.getString('priority') || 'Minor';
                const status = interaction.options.getString('status') || 'Open';
                const assignee = interaction.options.getUser('assignee');
                const ticketId = Date.now().toString(36).toUpperCase();

                try {
                    const threadName = `${ticketId}-${title.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}`;
                    
                    const thread = await interaction.channel.threads.create({
                        name: threadName,
                        autoArchiveDuration: 1440,
                        reason: `Ticket created by ${interaction.user.tag}`
                    });

                    const actionRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`assign_${ticketId}`)
                            .setLabel('👤 Assign')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`status_${ticketId}`)
                            .setLabel('📊 Status')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId(`importance_${ticketId}`)
                            .setLabel('⚠️ Priority')
                            .setStyle(ButtonStyle.Secondary)
                    );

                    const statusEmoji = getStatusEmoji(status);
                    const importanceEmoji = getImportanceEmoji(priority);
                    const assigneeText = assignee ? `<@${assignee.id}>` : 'Unassigned';

                    const ticketMessage = `${statusEmoji}${importanceEmoji} **Ticket ${ticketId}**\n` +
                                        `**Title:** ${title}\n` +
                                        `**Description:** ${description}\n` +
                                        `**Status:** ${status}\n` +
                                        `**Importance:** ${priority}\n` +
                                        `**Assignee:** ${assigneeText}\n` +
                                        `**Creator:** <@${interaction.user.id}>`;

                    const msg = await thread.send({
                        content: ticketMessage,
                        components: [actionRow]
                    });

                    db.prepare(`INSERT INTO tickets (id, title, description, status, importance, assignee, creator, threadId, messageId)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                      .run(ticketId, title, description, status, priority, assignee?.id || null, interaction.user.id, thread.id, msg.id);

                    return await interaction.reply({ 
                        content: `✅ Ticket **${ticketId}** created successfully! ${thread}`, 
                        flags: MessageFlags.Ephemeral 
                    });

                } catch (error) {
                    console.error('Error creating ticket:', error);
                    return await interaction.reply({ 
                        content: '❌ Failed to create ticket. Please try again.', 
                        flags: MessageFlags.Ephemeral 
                    });
                }
            }

            if (subcommand === 'list') {
                const tickets = db.prepare('SELECT * FROM tickets ORDER BY id DESC').all();
                
                if (tickets.length === 0) {
                    return await interaction.reply({ 
                        content: '📋 No tickets found.', 
                        flags: MessageFlags.Ephemeral 
                    });
                }

                let ticketList = '**📋 Ticket List:**\n\n';
                tickets.slice(0, 10).forEach(t => {
                    const assigneeText = t.assignee ? `<@${t.assignee}>` : 'Unassigned';
                    ticketList += `**${t.id}** | ${t.title}\n`;
                    ticketList += `Status: ${t.status} | Priority: ${t.importance} | Assignee: ${assigneeText}\n\n`;
                });

                if (tickets.length > 10) {
                    ticketList += `\n*Showing 10 of ${tickets.length} tickets*`;
                }

                return await interaction.reply({ 
                    content: ticketList, 
                    flags: MessageFlags.Ephemeral 
                });
            }

            if (subcommand === 'view') {
                const ticketId = interaction.options.getString('id');
                const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
                
                if (!ticket) {
                    return await interaction.reply({ 
                        content: `❌ Ticket with ID \`${ticketId}\` not found.`, 
                        flags: MessageFlags.Ephemeral 
                    });
                }

                const statusEmoji = getStatusEmoji(ticket.status);
                const importanceEmoji = getImportanceEmoji(ticket.importance);
                const assigneeText = ticket.assignee ? `<@${ticket.assignee}>` : 'Unassigned';
                
                const ticketInfo = `${statusEmoji}${importanceEmoji} **Ticket ${ticket.id}**\n` +
                                 `**Title:** ${ticket.title}\n` +
                                 `**Description:** ${ticket.description}\n` +
                                 `**Status:** ${ticket.status}\n` +
                                 `**Importance:** ${ticket.importance}\n` +
                                 `**Assignee:** ${assigneeText}\n` +
                                 `**Creator:** <@${ticket.creator}>\n` +
                                 `**Thread:** <#${ticket.threadId}>`;

                return await interaction.reply({ 
                    content: ticketInfo, 
                    flags: MessageFlags.Ephemeral 
                });
            }

            if (subcommand === 'delete') {
                const ticketId = interaction.options.getString('id');
                const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
                
                if (!ticket) {
                    return await interaction.reply({ 
                        content: `❌ Ticket with ID \`${ticketId}\` not found.`, 
                        flags: MessageFlags.Ephemeral 
                    });
                }

                // ticket creator or admin can delete
                if (ticket.creator !== interaction.user.id && !interaction.member.permissions.has('Administrator')) {
                    return await interaction.reply({ 
                        content: `❌ You can only delete tickets you created.`, 
                        flags: MessageFlags.Ephemeral 
                    });
                }

                const confirmRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`confirmDelete_${ticketId}`)
                        .setLabel('✅ Yes, Delete')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId(`cancelDelete_${ticketId}`)
                        .setLabel('❌ Cancel')
                        .setStyle(ButtonStyle.Secondary)
                );

                return await interaction.reply({
                    content: `⚠️ **Are you sure you want to delete ticket ${ticketId}?**\n\n` +
                            `**Title:** ${ticket.title}\n` +
                            `**This action cannot be undone!**`,
                    components: [confirmRow],
                    flags: MessageFlags.Ephemeral
                });
            }

        } catch (error) {
            console.error('Error in ticket command:', error);
            return await interaction.reply({ 
                content: '❌ An error occurred while processing your request.', 
                flags: MessageFlags.Ephemeral 
            });
        }
    },

    async handleButton(interaction) {
        const [action, ticketId] = interaction.customId.split('_');
        
        try {
            const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
            if (!ticket) {
                return await interaction.reply({ 
                    content: '❌ Ticket not found.', 
                    flags: MessageFlags.Ephemeral 
                });
            }

            if (action === 'assign') {
                const members = await interaction.guild.members.fetch({ limit: 100 });
                const memberArray = Array.from(members.values());
                const options = memberArray
                    .filter(member => !member.user.bot)
                    .map(member => ({
                        label: member.displayName.substring(0, 100),
                        description: member.user.username,
                        value: member.id
                    }))
                    .slice(0, 25);

                if (options.length === 0) {
                    return await interaction.reply({ 
                        content: '❌ No members found to assign.', 
                        flags: MessageFlags.Ephemeral 
                    });
                }

                const select = new StringSelectMenuBuilder()
                    .setCustomId(`assignSelect_${ticketId}`)
                    .setPlaceholder('Select an assignee...')
                    .addOptions(options);

                const row = new ActionRowBuilder().addComponents(select);
                return await interaction.reply({ 
                    content: '👤 Select an assignee:', 
                    components: [row], 
                    flags: MessageFlags.Ephemeral 
                });
            }

            if (action === 'status') {
                const statusOptions = [
                    { label: '🟢 Open', value: 'Open', emoji: '🟢' },
                    { label: '🟡 In Progress', value: 'In Progress', emoji: '🟡' },
                    { label: '🔵 Under Review', value: 'Under Review', emoji: '🔵' },
                    { label: '✅ Resolved', value: 'Resolved', emoji: '✅' },
                    { label: '❌ Closed', value: 'Closed', emoji: '❌' }
                ];

                const select = new StringSelectMenuBuilder()
                    .setCustomId(`statusSelect_${ticketId}`)
                    .setPlaceholder('Select status...')
                    .addOptions(statusOptions);

                return await interaction.reply({ 
                    content: '📊 Select new status:', 
                    components: [new ActionRowBuilder().addComponents(select)], 
                    flags: MessageFlags.Ephemeral 
                });
            }

            if (action === 'importance') {
                const importanceOptions = [
                    { label: '🟢 Minor', value: 'Minor', emoji: '🟢' },
                    { label: '🟡 Major', value: 'Major', emoji: '🟡' },
                    { label: '🔴 Critical', value: 'Critical', emoji: '🔴' }
                ];

                const select = new StringSelectMenuBuilder()
                    .setCustomId(`importanceSelect_${ticketId}`)
                    .setPlaceholder('Select priority level...')
                    .addOptions(importanceOptions);

                return await interaction.reply({ 
                    content: '⚠️ Select priority level:', 
                    components: [new ActionRowBuilder().addComponents(select)], 
                    flags: MessageFlags.Ephemeral 
                });
            }

            if (action === 'confirmDelete') {
                try {
                    db.prepare('DELETE FROM tickets WHERE id = ?').run(ticketId);
                    
                    try {
                        const thread = await interaction.guild.channels.fetch(ticket.threadId);
                        if (thread && thread.isThread() && !thread.archived) {
                            await thread.delete('Ticket deleted by user');
                        }
                    } catch (threadError) {
                        console.log(`Thread ${ticket.threadId} could not be deleted (may already be gone):`, threadError.message);
                    }
                    
                    return await interaction.update({
                        content: `✅ **Ticket ${ticketId} has been deleted successfully!**\n\n` +
                                `The ticket has been removed from the system.`,
                        components: []
                    });
                } catch (deleteError) {
                    console.error('Error deleting ticket:', deleteError);
                    return await interaction.update({
                        content: `❌ **Error deleting ticket ${ticketId}.**\n\n` +
                                `Please try again or contact an administrator.`,
                        components: []
                    });
                }
            }

            if (action === 'cancelDelete') {
                return await interaction.update({
                    content: `❌ **Ticket deletion cancelled.**\n\nTicket ${ticketId} remains active.`,
                    components: []
                });
            }

        } catch (error) {
            console.error('Error handling button:', error);
            return await interaction.reply({ 
                content: '❌ An error occurred while processing your request.', 
                flags: MessageFlags.Ephemeral 
            });
        }
    },

    async handleSelect(interaction) {
        const [type, ticketId] = interaction.customId.split('_');
        
        try {
            const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
            if (!ticket) {
                return await interaction.reply({ 
                    content: '❌ Ticket not found.', 
                    flags: MessageFlags.Ephemeral 
                });
            }

            const selected = interaction.values[0];
            let updateMessage = '';

            if (type === 'assignSelect') {
                db.prepare('UPDATE tickets SET assignee = ? WHERE id = ?').run(selected, ticketId);
                const member = await interaction.guild.members.fetch(selected);
                updateMessage = `👤 Assigned to ${member.displayName}`;
            } else if (type === 'statusSelect') {
                db.prepare('UPDATE tickets SET status = ? WHERE id = ?').run(selected, ticketId);
                updateMessage = `📊 Status changed to ${selected}`;
            } else if (type === 'importanceSelect') {
                db.prepare('UPDATE tickets SET importance = ? WHERE id = ?').run(selected, ticketId);
                updateMessage = `⚠️ Priority changed to ${selected}`;
            }

            const updatedTicket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
            
            const thread = await interaction.guild.channels.fetch(ticket.threadId);
            if (thread && thread.isThread()) {
                const message = await thread.messages.fetch(ticket.messageId);
                
                const statusEmoji = getStatusEmoji(updatedTicket.status);
                const importanceEmoji = getImportanceEmoji(updatedTicket.importance);
                const assigneeText = updatedTicket.assignee ? `<@${updatedTicket.assignee}>` : 'Unassigned';

                const updatedContent = `${statusEmoji}${importanceEmoji} **Ticket ${updatedTicket.id}**\n` +
                                     `**Title:** ${updatedTicket.title}\n` +
                                     `**Description:** ${updatedTicket.description}\n` +
                                     `**Status:** ${updatedTicket.status}\n` +
                                     `**Importance:** ${updatedTicket.importance}\n` +
                                     `**Assignee:** ${assigneeText}\n` +
                                     `**Creator:** <@${updatedTicket.creator}>`;

                await message.edit({ content: updatedContent });
            }

            return await interaction.reply({ 
                content: `✅ ${updateMessage}`, 
                flags: MessageFlags.Ephemeral 
            });

        } catch (error) {
            console.error('Error handling select:', error);
            return await interaction.reply({ 
                content: '❌ An error occurred while updating the ticket.', 
                flags: MessageFlags.Ephemeral 
            });
        }
    }
};