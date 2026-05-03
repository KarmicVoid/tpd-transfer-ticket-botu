const { Client, GatewayIntentBits, Partials, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('TPD Ticket Botu Aktif!'));
app.listen(process.env.PORT || 3000);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

// AYARLAR VE ID'LER
const LOG_KANAL_ID = "1500546650815336468";
const ADMIN_ROL_ID = "1496428477291696197"; // Etiketlenmeyen ama gören rol
const YETKILI_ROLLER = ["1496428477291696191", "1496428477291696192", "1496428477291696196", "1496428477291696193"];
const TAGLANACAK_USER = "1473408400061763584";

let ticketSayisi = 0;
if (fs.existsSync('./database.json')) {
    try {
        const data = JSON.parse(fs.readFileSync('./database.json', 'utf8'));
        ticketSayisi = data.ticketSayisi || 0;
    } catch (e) { ticketSayisi = 0; }
}

function saveDb() {
    fs.writeFileSync('./database.json', JSON.stringify({ ticketSayisi }));
}

client.on('ready', () => {
    console.log(`${client.user.tag} | TPD Ticket Botu Görevde!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // !panel Komutu
    if (message.content === '!panel') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

        const embed = new EmbedBuilder()
            .setTitle("TPD Transfere Hoş Geldiniz")
            .setDescription("TPD Transfere hoş geldiniz, aşağıdaki \"Kategori seç...\" menüsüne basarak istediğiniz kategoride ticket açabilirsiniz.")
            .setColor("#0099ff");

        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('ticket_select')
                    .setPlaceholder('Kategori seç...')
                    .addOptions([
                        { label: 'Transfer Bileti', value: 'Transfer Bileti', emoji: '🎫' },
                        { label: 'Ekip Transfer Bileti', value: 'Ekip Transfer Bileti', emoji: '👥' },
                        { label: 'Yetkililerle İletişim', value: 'Yetkililerle İletişim', emoji: '📞' },
                    ]),
            );

        await message.channel.send({ embeds: [embed], components: [row] });
    }

    // !transfer Komutu
    if (message.content === '!transfer') {
        const transferText = `
**Roblox isim:**
**Discord isim:**
**Girdiğim kamplar:**
**Girdiğim kamplardaki rütbelerim:**
**Ss:**
**Tag:** <@&1496428477291696191> <@&1496428477291696192> 
**NOT:** Max rütbe Emniyet Genel Müdürüdür.
        `;
        message.channel.send(transferText);
    }
});

client.on('interactionCreate', async (interaction) => {
    // Ticket Açma İşlemi
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
        ticketSayisi++;
        saveDb();

        const kategori = interaction.values[0];
        const channelName = `${interaction.user.username}-ticket-${ticketSayisi}`;

        const ticketChannel = await interaction.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                { id: ADMIN_ROL_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                ...YETKILI_ROLLER.map(id => ({ id: id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }))
            ],
        });

        const welcomeEmbed = new EmbedBuilder()
            .setDescription(`Merhaba ${interaction.user}, **${kategori}** kategorisine hoş geldiniz. \n\n**!transfer** yazarak formatı görebilirsiniz, yetkililerimiz en yakın zamanda sizinle ilgilenecektir.`)
            .setColor("#2ecc71");

        const closeBtn = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Kapat').setStyle(ButtonStyle.Danger)
        );

        await ticketChannel.send({ 
            content: `${YETKILI_ROLLER.map(id => `<@&${id}>`).join(" ")} <@${TAGLANACAK_USER}>`, 
            embeds: [welcomeEmbed], 
            components: [closeBtn] 
        });

        await interaction.reply({ content: `Biletiniz açıldı: ${ticketChannel}`, ephemeral: true });
    }

    // Kapatma Butonuna Basınca Soru Sorma (Modal)
    if (interaction.isButton() && interaction.customId === 'close_ticket') {
        const modal = new ModalBuilder()
            .setCustomId('close_modal')
            .setTitle('Bileti Kapat');

        const reasonInput = new TextInputBuilder()
            .setCustomId('close_reason')
            .setLabel("Bilet neden kapatılsın?")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Kapatma sebebinizi buraya yazın...")
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
        await interaction.showModal(modal);
    }

    // Modal Onaylanınca Log Tutma ve Kapatma
    if (interaction.isModalSubmit() && interaction.customId === 'close_modal') {
        const reason = interaction.fields.getTextInputValue('close_reason');
        const channel = interaction.channel;

        await interaction.reply({ content: "Bilet kaydediliyor ve siliniyor...", ephemeral: true });

        const messages = await channel.messages.fetch({ limit: 100 });
        let logContent = `TPD TICKET LOG\n------------------\n`;
        logContent += `Bileti Açan: ${channel.name.split('-ticket-')[0]}\n`;
        logContent += `Kapatan: ${interaction.user.tag}\n`;
        logContent += `Kapatılma Sebebi: ${reason}\n`;
        logContent += `Açılma/Kapanış Tarihi: ${new Date().toLocaleString('tr-TR')}\n`;
        logContent += `------------------\n\n`;

        messages.reverse().forEach(m => {
            logContent += `[${m.createdAt.toLocaleString('tr-TR')}] ${m.author.tag}: ${m.content}\n`;
        });

        const attachment = new AttachmentBuilder(Buffer.from(logContent, 'utf-8'), { name: `ticket-log-${channel.name}.txt` });

        const logKanal = interaction.guild.channels.cache.get(LOG_KANAL_ID);
        if (logKanal) {
            await logKanal.send({ 
                content: `🚨 **Bilet Kapatıldı!**\n**Personel:** ${channel.name.split('-ticket-')[0]}\n**Kapatan:** ${interaction.user}\n**Sebep:** ${reason}\n**Bildirim:** <@&${ADMIN_ROL_ID}>`, 
                files: [attachment] 
            });
        }

        setTimeout(() => channel.delete(), 5000);
    }
});

client.login(process.env.TOKEN);

