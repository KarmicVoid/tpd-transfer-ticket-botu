const { Client, GatewayIntentBits, Partials, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const express = require('express');
const axios = require('axios'); // Sorgulama için axios eklendi

const app = express();
app.get('/', (req, res) => res.send('TPD Ticket Botu Aktif!'));
app.listen(process.env.PORT || 3000);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

// --- AYARLAR ---
const BOT_SAHIBI_ID = "1424138026631561381"; 
const LOG_KANAL_ID = "1500546650815336468";
const PANEL_YETKILI_ROLLER = ["1500556576233357375", "1496428477291696197"]; 

// Etiketlenecek Roller
const ETIKETLENECEK_ROLLER = ["1496428477291696191", "1496428477291696192", "1496428477291696196"];
const TAGLANACAK_USER = "1473408400061763584";

// Görebilecek Ama Etiketlenmeyecek Roller
const SADECE_GOREN_ROLLER = ["1496428477291696193", "1496428477291696197"];

let ticketSayisi = 0;
if (fs.existsSync('./database.json')) {
    try { ticketSayisi = JSON.parse(fs.readFileSync('./database.json', 'utf8')).ticketSayisi || 0; } catch (e) { ticketSayisi = 0; }
}

client.on('ready', () => { console.log(`${client.user.tag} Hazır! Kategori loglama aktif.`); });

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // --- SORGULA KOMUTU ENJEKTE EDİLDİ ---
    if (message.content.startsWith('!sorgula')) {
        const args = message.content.split(' ');
        const robloxName = args[1];
        if (!robloxName) return message.reply("❌ Lütfen sorgulanacak bir Roblox ismi yazın! Örn: `!sorgula RobloxName` ");

        try {
            // Roblox Kullanıcı ID'sini bulma
            const userRes = await axios.post('https://users.roblox.com/v1/usernames/users', {
                usernames: [robloxName],
                excludeBannedUsers: false
            });

            if (!userRes.data.data.length) return message.reply("❌ Bu isimde bir Roblox kullanıcısı bulunamadı.");
            
            const userId = userRes.data.data[0].id;
            const displayName = userRes.data.data[0].displayName;

            // Kullanıcının gruplarını çekme
            const groupsRes = await axios.get(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
            const groups = groupsRes.data.data;

            if (groups.length === 0) return message.reply(`**${robloxName}** herhangi bir grupta bulunmuyor.`);

            const embed = new EmbedBuilder()
                .setTitle(`${displayName} (@${robloxName}) Grup Bilgileri`)
                .setURL(`https://www.roblox.com/users/${userId}/profile`)
                .setColor("#2ecc71")
                .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=420&height=420&format=png`)
                .setDescription(groups.map(g => `**${g.group.name}**\n┗ Rütbe: \`${g.role.name}\` (Rank: ${g.role.rank})`).join('\n\n'))
                .setFooter({ text: 'TPD Sorgu Sistemi' })
                .setTimestamp();

            message.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            message.reply("❌ Sorgulama sırasında bir hata oluştu. Roblox API'sine ulaşılamıyor.");
        }
    }

    if (message.content === '!panel') {
        const isManager = message.member.permissions.has(PermissionFlagsBits.Administrator);
        const hasSpecialRole = message.member.roles.cache.some(role => PANEL_YETKILI_ROLLER.includes(role.id));
        if (!isManager && !hasSpecialRole && message.author.id !== BOT_SAHIBI_ID) return;

        const embed = new EmbedBuilder()
            .setTitle("TPD Transfere Hoş Geldiniz")
            .setDescription("TPD Transfere hoş geldiniz, aşağıdaki \"Kategori seç...\" menüsüne basarak istediğiniz kategoride ticket açabilirsiniz.")
            .setColor("#0099ff");

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('ticket_select').setPlaceholder('Kategori seç...')
                .addOptions([
                    { label: 'Transfer Bileti', value: 'Transfer Bileti', emoji: '🎫' },
                    { label: 'Ekip Transfer Bileti', value: 'Ekip Transfer Bileti', emoji: '👥' },
                    { label: 'Yetkililerle İletişim', value: 'Yetkililerle İletişim', emoji: '📞' },
                ]),
        );
        message.channel.send({ embeds: [embed], components: [row] });
    }

    if (message.content === '!transfer') {
        message.channel.send(`**Roblox isim:**\n**Discord isim:**\n**Girdiğim kamplar:**\n**Girdiğim kamplardaki rütbelerim:**\n**Ss:**\n**Tag:** <@&1496428477291696191> <@&1496428477291696192>\n**NOT:** Max rütbe Emniyet Genel Müdürüdür.`);
    }
});

// ... interactionCreate kısmı olduğu gibi aşağıda devam eder (Aynısı kaldığı için burayı kısaltıyorum)
client.on('interactionCreate', async (interaction) => {
    if (!interaction.guild) return;

    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
        if (interaction.replied || interaction.deferred) return;
        
        await interaction.deferReply({ ephemeral: true });
        ticketSayisi++;
        fs.writeFileSync('./database.json', JSON.stringify({ ticketSayisi }));

        const kategori = interaction.values[0];

        const ticketChannel = await interaction.guild.channels.create({
            name: `${interaction.user.username}-ticket-${ticketSayisi}`,
            type: ChannelType.GuildText,
            topic: `Kategori: ${kategori}`, 
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                ...ETIKETLENECEK_ROLLER.map(id => ({ id: id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] })),
                ...SADECE_GOREN_ROLLER.map(id => ({ id: id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] }))
            ],
        });

        const closeBtn = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm_close').setLabel('Kapat').setStyle(ButtonStyle.Danger)
        );

        await ticketChannel.send({ 
            content: `${ETIKETLENECEK_ROLLER.map(id => `<@&${id}>`).join(" ")} <@${TAGLANACAK_USER}>`, 
            embeds: [new EmbedBuilder().setDescription(`Merhaba ${interaction.user}, **${kategori}** hoş geldiniz. !transfer yazarak formatı görebilirsiniz.`).setColor("#2ecc71")], 
            components: [closeBtn] 
        });

        await interaction.editReply({ content: `Biletiniz açıldı: ${ticketChannel}` });
    }

    if (interaction.isButton() && interaction.customId === 'confirm_close') {
        const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_yes').setLabel('Evet✅').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('close_no').setLabel('Vazgeç❌').setStyle(ButtonStyle.Secondary)
        );
        await interaction.reply({ content: "Kapatmak istediğine emin misin?", components: [confirmRow] });
    }

    if (interaction.isButton() && interaction.customId === 'close_no') {
        await interaction.message.delete();
    }

    if (interaction.isButton() && interaction.customId === 'close_yes') {
        const modal = new ModalBuilder().setCustomId('close_modal').setTitle('Bileti Kapat');
        modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('close_reason').setLabel("Bilet neden kapatılsın?").setStyle(TextInputStyle.Paragraph).setRequired(true)
        ));
        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'close_modal') {
        const reason = interaction.fields.getTextInputValue('close_reason');
        const kategoriBilgisi = interaction.channel.topic || "Belirtilmemiş"; 
        
        await interaction.reply({ content: "Bilet kaydediliyor ve 3 saniye içinde kapatılıyor..." });

        const messages = await interaction.channel.messages.fetch({ limit: 100 });
        let logContent = `TPD TICKET TRANSCRIPT\n--------------------------\n`;
        logContent += `Bilet Kanalı: ${interaction.channel.name}\n`;
        logContent += `Bilet Kategorisi: ${kategoriBilgisi}\n`;
        logContent += `Bileti Kapatan: ${interaction.user.tag}\n`;
        logContent += `Kapatma Sebebi: ${reason}\n`;
        logContent += `Tarih: ${new Date().toLocaleString('tr-TR')}\n`;
        logContent += `--------------------------\n\n`;

        messages.reverse().forEach(m => { 
            if(!m.content && m.embeds.length > 0) return; 
            logContent += `[${m.createdAt.toLocaleString('tr-TR')}] ${m.author.tag}: ${m.content}\n`; 
        });

        const attachment = new AttachmentBuilder(Buffer.from(logContent, 'utf-8'), { name: `transcript-${interaction.channel.name}.txt` });
        const logKanal = interaction.guild.channels.cache.get(LOG_KANAL_ID);
        
        if (logKanal) {
            await logKanal.send({ 
                content: `🚨 **Bilet Kapatıldı!**\n**Kategori:** \`${kategoriBilgisi}\`\n**Personel:** ${interaction.channel.name.split('-ticket-')[0]}\n**Kapatan:** ${interaction.user}\n**Sebep:** ${reason}\n**Bildirim:** <@&1496428477291696197>`, 
                files: [attachment] 
            });
        }
        setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
    }
});

client.login(process.env.TOKEN);
