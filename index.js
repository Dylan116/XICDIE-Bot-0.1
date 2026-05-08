// ============================================================
//  xicnie Bot v2.0 — Global Multi-Server Recruitment System
//  Storage  : counter.json (no database needed)
//  Keep-alive: Express on PORT (for UptimeRobot / Render)
// ============================================================
import 'dotenv/config';
import {
  Client, GatewayIntentBits, Events, ActivityType,
  EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} from 'discord.js';
import express from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE  = join(__dirname, 'counter.json');

// ============================================================
//  DATA LAYER — counter.json
// ============================================================

function load() {
  if (!existsSync(DATA_FILE)) return { projects: {}, applications: {}, nextAppId: 1 };
  return JSON.parse(readFileSync(DATA_FILE, 'utf8'));
}
function save(data) { writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8'); }

const pkey = (guildId, name) => `${guildId}:${name}`;

function getProject(guildId, name)  { return load().projects[pkey(guildId, name)] ?? null; }
function getProjectById(id)         { return load().projects[id] ?? null; }

function createProject(guildId, name) {
  const data = load(), key = pkey(guildId, name);
  if (data.projects[key]) throw new Error('DUPLICATE_NAME');
  data.projects[key] = {
    id: key, guildId, name,
    embedTitle: '', embedDescription: '', embedColor: '#5865F2',
    buttonLabel: 'สมัคร', buttonColor: 'Primary',
    fieldCount: 1, fieldLabels: [],
    adminRoleId: '', adminChannelId: '', targetChannelId: '',
    messageId: '', channelId: '',
  };
  save(data);
  return data.projects[key];
}

function updateProject(id, fields) {
  const data = load();
  if (!data.projects[id]) return;
  data.projects[id] = { ...data.projects[id], ...fields };
  save(data);
}

function resetProject(id) {
  const data = load();
  if (!data.projects[id]) return;
  const p = data.projects[id];
  data.projects[id] = {
    ...p,
    embedTitle: '', embedDescription: '', embedColor: '#5865F2',
    buttonLabel: 'สมัคร', buttonColor: 'Primary',
    fieldCount: 1, fieldLabels: [],
    adminRoleId: '', adminChannelId: '', targetChannelId: '',
    messageId: '', channelId: '',
  };
  save(data);
}

function saveApplication(guildId, projectName, applicantId, applicantTag, answers) {
  const data = load();
  const id   = data.nextAppId++;
  data.applications[id] = {
    id, guildId, projectName, applicantId, applicantTag, answers,
    status: 'pending', logMessageId: '', logChannelId: '',
    createdAt: new Date().toISOString(),
  };
  save(data);
  return data.applications[id];
}

function getApplication(id)  { return load().applications[id] ?? null; }

function updateApplicationStatus(id, status, logMsgId, logChId) {
  const data = load();
  if (!data.applications[id]) return;
  data.applications[id] = { ...data.applications[id], status, logMessageId: logMsgId ?? '', logChannelId: logChId ?? '' };
  save(data);
}

function countApplications() {
  return Object.keys(load().applications).length;
}

// ============================================================
//  COLOR UTILITIES — hex → nearest Discord ButtonStyle
// ============================================================

const DISCORD_COLORS = [
  { style: ButtonStyle.Primary,   rgb: [88, 101, 242], label: '🔵 น้ำเงิน' },
  { style: ButtonStyle.Success,   rgb: [87, 242, 135], label: '🟢 เขียว'   },
  { style: ButtonStyle.Danger,    rgb: [237, 66, 69],  label: '🔴 แดง'     },
  { style: ButtonStyle.Secondary, rgb: [78, 80, 88],   label: '⚪ เทา'     },
];

function hexToRgb(hex) {
  const c = hex.replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(c)) return null;
  return [parseInt(c.slice(0,2),16), parseInt(c.slice(2,4),16), parseInt(c.slice(4,6),16)];
}
const dist = (a, b) => Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2);

function hexToButtonStyle(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return DISCORD_COLORS[0];
  return DISCORD_COLORS.reduce((best, e) => dist(rgb, e.rgb) < dist(rgb, best.rgb) ? e : best, DISCORD_COLORS[0]);
}

function getButtonStyle(color) {
  if (color.startsWith('#')) return hexToButtonStyle(color).style;
  return ({ Success: ButtonStyle.Success, Danger: ButtonStyle.Danger, Secondary: ButtonStyle.Secondary })[color] ?? ButtonStyle.Primary;
}

function colorLabel(color) {
  if (color.startsWith('#')) { const m = hexToButtonStyle(color); return `${color} → ${m.label}`; }
  return ({ Success: '🟢 เขียว', Danger: '🔴 แดง', Secondary: '⚪ เทา' })[color] ?? '🔵 น้ำเงิน';
}

// ============================================================
//  EMOJI PARSER — <:name:id> / <a:name:id>
// ============================================================

function parseButtonLabel(raw) {
  const m = raw.match(/<(a?):(\w+):(\d+)>/);
  if (m) return { label: raw.replace(/<a?:\w+:\d+>/g, '').trim(), emoji: { animated: m[1]==='a', name: m[2], id: m[3] } };
  return { label: raw };
}

// ============================================================
//  UI BUILDERS
// ============================================================

function buildAdminEmbed(p) {
  const labels = p.fieldLabels ?? [];
  return new EmbedBuilder()
    .setTitle(`⚙️ ตั้งค่าระบบ: ${p.name}`)
    .setColor(0x5865f2)
    .addFields(
      { name: '📌 ชื่อโปรเจกต์',   value: p.name,                                                                                          inline: true  },
      { name: '🎨 สี Embed',        value: p.embedColor || '#5865F2',                                                                       inline: true  },
      { name: '🔢 จำนวนช่องกรอก', value: `${p.fieldCount || 1} ช่อง`,                                                                     inline: true  },
      { name: '📝 หัวข้อช่องกรอก', value: labels.length ? labels.map((l,i) => `${i+1}. ${l||'(ยังไม่ได้ตั้ง)'}`).join('\n') : '(ยังไม่ได้ตั้งหัวข้อ)', inline: false },
      { name: '📢 ห้องวางฟอร์ม',   value: p.targetChannelId ? `<#${p.targetChannelId}>` : '(ใช้ช่องปัจจุบันอัตโนมัติ)',                  inline: true  },
      { name: '⚙️ ห้องแอดมิน',    value: p.adminChannelId  ? `<#${p.adminChannelId}>`  : '(ยังไม่ได้ตั้ง)',                             inline: true  },
      { name: '🎖️ ยศที่จะให้',    value: p.adminRoleId     ? `<@&${p.adminRoleId}>`    : '(ยังไม่ได้ตั้ง)',                             inline: true  },
      { name: '🖊️ ชื่อปุ่ม',      value: p.buttonLabel || 'สมัคร',                                                                       inline: true  },
      { name: '🎨 สีปุ่ม',         value: colorLabel(p.buttonColor || 'Primary'),                                                          inline: true  },
    )
    .setFooter({ text: 'ตั้งค่าทุกอย่างแล้วกด [ 🚀 ปล่อยฟอร์ม ] เพื่อส่ง Embed ให้สมาชิก' });
}

function buildPreviewEmbed(p) {
  const e = new EmbedBuilder().setColor(p.embedColor || '#5865F2');
  if (p.embedTitle)       e.setTitle(p.embedTitle);
  if (p.embedDescription) e.setDescription(p.embedDescription);
  if (!p.embedTitle && !p.embedDescription)
    e.setDescription('*(ยังไม่มีเนื้อหา — กด ✏️ แก้ไขเนื้อหา Embed เพื่อเพิ่ม)*');
  return e;
}

function buildAdminRows(projectId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`edit_content:${projectId}`).setLabel('✏️ แก้ไขเนื้อหา Embed').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`edit_fields:${projectId}`).setLabel('📋 แก้ไขหัวข้อช่องกรอก').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`system_settings:${projectId}`).setLabel('⚙️ ตั้งค่าระบบ').setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`field_count:${projectId}`)
        .setPlaceholder('🔢 เลือกจำนวนช่องกรอก (1-5)')
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel('1 ช่อง').setValue('1').setEmoji('1️⃣'),
          new StringSelectMenuOptionBuilder().setLabel('2 ช่อง').setValue('2').setEmoji('2️⃣'),
          new StringSelectMenuOptionBuilder().setLabel('3 ช่อง').setValue('3').setEmoji('3️⃣'),
          new StringSelectMenuOptionBuilder().setLabel('4 ช่อง').setValue('4').setEmoji('4️⃣'),
          new StringSelectMenuOptionBuilder().setLabel('5 ช่อง').setValue('5').setEmoji('5️⃣'),
        ),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`edit_button_color:${projectId}`).setLabel('🎨 เลือกสีปุ่ม').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`edit_button_label:${projectId}`).setLabel('🖊️ ตั้งชื่อปุ่ม').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`publish:${projectId}`).setLabel('🚀 ปล่อยฟอร์ม').setStyle(ButtonStyle.Success),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`clear_start:${projectId}`).setLabel('🗑️ ลบข้อมูลทั้งหมด').setStyle(ButtonStyle.Danger),
    ),
  ];
}

function buildPublicButton(p) {
  const parsed = parseButtonLabel(p.buttonLabel || 'สมัคร');
  const btn = new ButtonBuilder()
    .setCustomId(`apply:${p.guildId}:${p.name}`)
    .setStyle(getButtonStyle(p.buttonColor));
  if (parsed.emoji)       btn.setEmoji({ id: parsed.emoji.id, name: parsed.emoji.name, animated: parsed.emoji.animated });
  if (parsed.label)       btn.setLabel(parsed.label);
  else if (!parsed.emoji) btn.setLabel('สมัคร');
  return new ActionRowBuilder().addComponents(btn);
}

// ============================================================
//  MODAL BUILDERS
// ============================================================

function buildContentModal(p) {
  const modal = new ModalBuilder().setCustomId(`modal_content:${p.id}`).setTitle('✏️ แก้ไขเนื้อหา Embed');
  const t = new TextInputBuilder().setCustomId('embed_title').setLabel('หัวข้อ Embed (Title)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(256);
  const d = new TextInputBuilder().setCustomId('embed_description').setLabel('รายละเอียด (Description)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(4000);
  const c = new TextInputBuilder().setCustomId('embed_color').setLabel('สี Embed (Hex เช่น #FF0000)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(7);
  if (p.embedTitle)       t.setValue(p.embedTitle.slice(0, 256));
  if (p.embedDescription) d.setValue(p.embedDescription.slice(0, 4000));
  if (p.embedColor)       c.setValue(p.embedColor.slice(0, 7));
  modal.addComponents(new ActionRowBuilder().addComponents(t), new ActionRowBuilder().addComponents(d), new ActionRowBuilder().addComponents(c));
  return modal;
}

function buildFieldsModal(p) {
  const count  = p.fieldCount ?? 1;
  const labels = p.fieldLabels ?? [];
  const modal  = new ModalBuilder().setCustomId(`modal_fields:${p.id}`).setTitle(`📋 แก้ไขหัวข้อช่องกรอก (${count} ช่อง)`);
  for (let i = 0; i < count; i++) {
    const inp = new TextInputBuilder().setCustomId(`field_${i}`).setLabel(`หัวข้อช่องที่ ${i+1}`).setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(45);
    if (labels[i]) inp.setValue(labels[i].slice(0, 45));
    modal.addComponents(new ActionRowBuilder().addComponents(inp));
  }
  return modal;
}

function buildSystemSettingsModal(p) {
  const modal = new ModalBuilder().setCustomId(`modal_system:${p.id}`).setTitle('⚙️ ตั้งค่าระบบ');
  const r = new TextInputBuilder().setCustomId('admin_role_id').setLabel('ID ยศที่จะให้เมื่ออนุมัติ').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(30);
  const a = new TextInputBuilder().setCustomId('admin_channel_id').setLabel('ID ห้องแอดมิน (รับใบสมัคร)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(30);
  const t = new TextInputBuilder().setCustomId('target_channel_id').setLabel('ID ห้องวางฟอร์ม (ส่ง Embed ให้สมาชิก)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(30);
  if (p.adminRoleId)     r.setValue(p.adminRoleId.slice(0, 30));
  if (p.adminChannelId)  a.setValue(p.adminChannelId.slice(0, 30));
  if (p.targetChannelId) t.setValue(p.targetChannelId.slice(0, 30));
  modal.addComponents(new ActionRowBuilder().addComponents(r), new ActionRowBuilder().addComponents(a), new ActionRowBuilder().addComponents(t));
  return modal;
}

function buildButtonColorModal(p) {
  const modal = new ModalBuilder().setCustomId(`modal_button_color:${p.id}`).setTitle('🎨 เลือกสีปุ่ม');
  const inp   = new TextInputBuilder().setCustomId('button_hex_color').setLabel('ระบุโค้ดสีปุ่ม (Hex Color)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(7);
  if (p.buttonColor?.startsWith('#')) inp.setValue(p.buttonColor.slice(0, 7));
  modal.addComponents(new ActionRowBuilder().addComponents(inp));
  return modal;
}

function buildButtonLabelModal(p) {
  const modal = new ModalBuilder().setCustomId(`modal_button_label:${p.id}`).setTitle('🖊️ ตั้งชื่อปุ่ม');
  const inp   = new TextInputBuilder().setCustomId('button_label').setLabel('ข้อความบนปุ่ม (รองรับ <:emoji:id>)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80);
  if (p.buttonLabel) inp.setValue(p.buttonLabel.slice(0, 80));
  modal.addComponents(new ActionRowBuilder().addComponents(inp));
  return modal;
}

function buildRejectReasonModal(appId) {
  const modal = new ModalBuilder().setCustomId(`modal_reject:${appId}`).setTitle('❌ ปฏิเสธใบสมัคร');
  const inp   = new TextInputBuilder().setCustomId('reject_reason').setLabel('สาเหตุที่ปฏิเสธ').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500);
  modal.addComponents(new ActionRowBuilder().addComponents(inp));
  return modal;
}

function buildApplicationModal(p) {
  const count  = p.fieldCount ?? 1;
  const labels = p.fieldLabels ?? [];
  const modal  = new ModalBuilder().setCustomId(`modal_apply:${p.guildId}:${p.name}`).setTitle(p.embedTitle || 'ใบสมัคร');
  for (let i = 0; i < count; i++) {
    const label = labels[i] || `ข้อมูลที่ ${i+1}`;
    const inp   = new TextInputBuilder().setCustomId(`answer_${i}`).setLabel(label).setStyle(TextInputStyle.Short).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(inp));
  }
  return modal;
}

// ============================================================
//  KEEP-ALIVE SERVER — UptimeRobot / Render health check
// ============================================================

const app = express();
app.get('/',       (_req, res) => res.send('✅ xicnie Bot กำลังทำงาน'));
app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));
const PORT = Number(process.env.PORT ?? 8080);
app.listen(PORT, '0.0.0.0', () => console.log(`🌐 Keep-alive server เปิดที่ port ${PORT}`));

// ============================================================
//  DISCORD CLIENT
// ============================================================

if (!process.env.DISCORD_TOKEN) {
  console.error('❌ กรุณาสร้างไฟล์ .env และใส่ DISCORD_TOKEN');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function updatePresence() {
  const count = countApplications();
  client.user?.setPresence({
    status: 'online',
    activities: [{ name: `${count} คนสมัครสมาชิก`, type: ActivityType.Watching }],
  });
}

client.once(Events.ClientReady, c => {
  console.log(`✅ Bot พร้อมใช้งาน: ${c.user.tag}`);
  updatePresence();
  setInterval(updatePresence, 5 * 60 * 1000);
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if      (interaction.isChatInputCommand()) await handleCommand(interaction);
    else if (interaction.isButton())           await handleButton(interaction);
    else if (interaction.isStringSelectMenu()) await handleSelect(interaction);
    else if (interaction.isModalSubmit())      { await handleModal(interaction); updatePresence(); }
  } catch (err) {
    console.error('Interaction error:', err);
    try {
      const msg = { content: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่', ephemeral: true };
      if (interaction.deferred || interaction.replied) await interaction.editReply(msg);
      else await interaction.reply(msg);
    } catch {}
  }
});

// ============================================================
//  /xicnie COMMAND
// ============================================================

async function handleCommand(interaction) {
  if (interaction.commandName !== 'xicnie') return;
  const name    = interaction.options.getString('name', true).trim();
  const guildId = interaction.guildId;
  let project   = getProject(guildId, name);
  if (!project) {
    try { project = createProject(guildId, name); }
    catch { await interaction.reply({ content: '❌ ชื่อโปรเจกต์นี้ถูกใช้ไปแล้วในเซิร์ฟเวอร์นี้', ephemeral: true }); return; }
  }
  await interaction.reply({ embeds: [buildAdminEmbed(project), buildPreviewEmbed(project)], components: buildAdminRows(project.id) });
}

// ============================================================
//  BUTTON HANDLER
// ============================================================

async function handleButton(interaction) {
  const [action, ...parts] = interaction.customId.split(':');
  const projectId = parts.join(':');

  switch (action) {
    case 'edit_content': {
      const p = getProjectById(projectId);
      if (!p) { await interaction.reply({ content: '❌ ไม่พบโปรเจกต์', ephemeral: true }); return; }
      await interaction.showModal(buildContentModal(p)); return;
    }
    case 'edit_fields': {
      const p = getProjectById(projectId);
      if (!p) { await interaction.reply({ content: '❌ ไม่พบโปรเจกต์', ephemeral: true }); return; }
      await interaction.showModal(buildFieldsModal(p)); return;
    }
    case 'system_settings': {
      const p = getProjectById(projectId);
      if (!p) { await interaction.reply({ content: '❌ ไม่พบโปรเจกต์', ephemeral: true }); return; }
      await interaction.showModal(buildSystemSettingsModal(p)); return;
    }
    case 'edit_button_color': {
      const p = getProjectById(projectId);
      if (!p) { await interaction.reply({ content: '❌ ไม่พบโปรเจกต์', ephemeral: true }); return; }
      await interaction.showModal(buildButtonColorModal(p)); return;
    }
    case 'edit_button_label': {
      const p = getProjectById(projectId);
      if (!p) { await interaction.reply({ content: '❌ ไม่พบโปรเจกต์', ephemeral: true }); return; }
      await interaction.showModal(buildButtonLabelModal(p)); return;
    }

    case 'publish': {
      const p = getProjectById(projectId);
      if (!p) { await interaction.reply({ content: '❌ ไม่พบโปรเจกต์', ephemeral: true }); return; }
      if (!p.adminChannelId) {
        await interaction.reply({ content: '❌ กรุณาตั้งค่า **ห้องแอดมิน** ก่อนปล่อยฟอร์ม (กด ⚙️ ตั้งค่าระบบ)', ephemeral: true }); return;
      }
      await interaction.deferReply({ ephemeral: true });
      let sendChannel = interaction.channel;
      if (p.targetChannelId) {
        try { const ch = await interaction.guild?.channels.fetch(p.targetChannelId); if (ch?.isTextBased()) sendChannel = ch; } catch {}
      }
      const sent = await sendChannel.send({ embeds: [buildPreviewEmbed(p)], components: [buildPublicButton(p)] });
      updateProject(p.id, { messageId: sent.id, channelId: sendChannel.id });
      await interaction.editReply({ content: `✅ ปล่อยฟอร์ม **${p.name}** ไปที่ ${p.targetChannelId ? `<#${p.targetChannelId}>` : 'ช่องนี้'} สำเร็จแล้ว!` }); return;
    }

    case 'apply': {
      const [guildId, ...nameParts] = parts;
      const p = getProject(guildId, nameParts.join(':'));
      if (!p) { await interaction.reply({ content: '❌ ไม่พบโปรเจกต์นี้แล้ว', ephemeral: true }); return; }
      await interaction.showModal(buildApplicationModal(p)); return;
    }

    case 'approve': {
      const appId = parts[0];
      const app   = getApplication(appId);
      if (!app)                     { await interaction.reply({ content: '❌ ไม่พบใบสมัครนี้', ephemeral: true }); return; }
      if (app.status !== 'pending') { await interaction.reply({ content: '❌ ใบสมัครนี้ถูกดำเนินการแล้ว', ephemeral: true }); return; }
      await interaction.deferUpdate();
      if (app.guildId) {
        const p = getProject(app.guildId, app.projectName);
        if (p?.adminRoleId) {
          try { const m = await interaction.guild?.members.fetch(app.applicantId); await m?.roles.add(p.adminRoleId); } catch {}
        }
      }
      updateApplicationStatus(appId, 'approved', app.logMessageId, app.logChannelId);
      try {
        const user = await interaction.client.users.fetch(app.applicantId);
        await user.send({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('✅ ใบสมัครของคุณได้รับการอนุมัติ!').setDescription(`โปรเจกต์: **${app.projectName}**\nยินดีต้อนรับเข้าสู่ทีม!`).setTimestamp()] });
      } catch {}
      const approvedEmbed = new EmbedBuilder().setColor(0x57f287).setTitle('✅ อนุมัติแล้ว').setDescription(`อนุมัติโดย <@${interaction.user.id}>`).setTimestamp();
      const doneRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('done_approve').setLabel('✅ อนุมัติแล้ว').setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId('done_reject').setLabel('❌ ปฏิเสธ').setStyle(ButtonStyle.Danger).setDisabled(true),
      );
      await interaction.editReply({ embeds: [...interaction.message.embeds, approvedEmbed], components: [doneRow] }); return;
    }

    case 'reject': {
      const appId = parts[0];
      const app   = getApplication(appId);
      if (!app)                     { await interaction.reply({ content: '❌ ไม่พบใบสมัครนี้', ephemeral: true }); return; }
      if (app.status !== 'pending') { await interaction.reply({ content: '❌ ใบสมัครนี้ถูกดำเนินการแล้ว', ephemeral: true }); return; }
      await interaction.showModal(buildRejectReasonModal(appId)); return;
    }

    case 'clear_start': {
      const p = getProjectById(projectId);
      if (!p) { await interaction.reply({ content: '❌ ไม่พบโปรเจกต์', ephemeral: true }); return; }
      const confirmEmbed = new EmbedBuilder().setColor(0xed4245).setTitle('⚠️ ยืนยันการล้างข้อมูล')
        .setDescription(`คุณกำลังจะล้างข้อมูลทั้งหมดของโปรเจกต์ **${p.name}** ซึ่งรวมถึง\n\n• หัวข้อและรายละเอียด Embed\n• หัวข้อช่องกรอกทั้งหมด\n• ชื่อปุ่มและสีปุ่ม\n• ห้องแอดมิน, ห้องวางฟอร์ม และยศที่ตั้งไว้\n\n**การกระทำนี้ไม่สามารถยกเลิกได้!**`);
      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`clear_confirm:${p.id}`).setLabel('✅ ยืนยัน ล้างข้อมูล').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`clear_cancel:${p.id}`).setLabel('❌ ยกเลิก').setStyle(ButtonStyle.Secondary),
      );
      await interaction.update({ embeds: [confirmEmbed], components: [confirmRow] }); return;
    }
    case 'clear_confirm': {
      const p = getProjectById(projectId);
      if (!p) { await interaction.reply({ content: '❌ ไม่พบโปรเจกต์', ephemeral: true }); return; }
      resetProject(p.id);
      const fresh = getProjectById(p.id);
      await interaction.update({ embeds: [buildAdminEmbed(fresh), buildPreviewEmbed(fresh)], components: buildAdminRows(fresh.id) }); return;
    }
    case 'clear_cancel': {
      const p = getProjectById(projectId);
      if (!p) { await interaction.reply({ content: '❌ ไม่พบโปรเจกต์', ephemeral: true }); return; }
      await interaction.update({ embeds: [buildAdminEmbed(p), buildPreviewEmbed(p)], components: buildAdminRows(p.id) }); return;
    }

    default: return;
  }
}

// ============================================================
//  SELECT MENU HANDLER
// ============================================================

async function handleSelect(interaction) {
  const [action, ...parts] = interaction.customId.split(':');
  if (action !== 'field_count') return;
  const p = getProjectById(parts.join(':'));
  if (!p) { await interaction.reply({ content: '❌ ไม่พบโปรเจกต์', ephemeral: true }); return; }
  const count  = parseInt(interaction.values[0], 10);
  const labels = Array.from({ length: count }, (_, i) => (p.fieldLabels ?? [])[i] ?? '');
  updateProject(p.id, { fieldCount: count, fieldLabels: labels });
  const updated = getProjectById(p.id);
  await interaction.update({ embeds: [buildAdminEmbed(updated), buildPreviewEmbed(updated)], components: buildAdminRows(updated.id) });
}

// ============================================================
//  MODAL SUBMIT HANDLER
// ============================================================

async function handleModal(interaction) {
  const [action, ...parts] = interaction.customId.split(':');

  switch (action) {
    case 'modal_apply': {
      const [guildId, ...nameParts] = parts;
      const p = getProject(guildId, nameParts.join(':'));
      if (!p) { await interaction.reply({ content: '❌ ไม่พบโปรเจกต์', ephemeral: true }); return; }
      await interaction.deferReply({ ephemeral: true });
      const answers  = Array.from({ length: p.fieldCount ?? 1 }, (_, i) => interaction.fields.getTextInputValue(`answer_${i}`));
      const app      = saveApplication(guildId, p.name, interaction.user.id, interaction.user.tag, answers);
      const labels   = p.fieldLabels ?? [];
      const appEmbed = new EmbedBuilder().setColor(0xfee75c).setTitle(`📋 ใบสมัคร: ${p.name}`)
        .setDescription(`ผู้สมัคร: <@${interaction.user.id}> (${interaction.user.tag})`)
        .addFields(answers.map((a, i) => ({ name: labels[i] || `ช่องที่ ${i+1}`, value: a || '(ไม่ได้กรอก)', inline: false })))
        .setTimestamp().setFooter({ text: `Application ID: ${app.id}` });
      const decisionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`approve:${app.id}`).setLabel('✅ อนุมัติ (ให้ยศ)').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`reject:${app.id}`).setLabel('❌ ปฏิเสธ').setStyle(ButtonStyle.Danger),
      );
      if (p.adminChannelId) {
        try {
          const ch = await interaction.guild?.channels.fetch(p.adminChannelId);
          if (ch?.isTextBased()) {
            const logMsg = await ch.send({ embeds: [appEmbed], components: [decisionRow] });
            updateApplicationStatus(app.id, 'pending', logMsg.id, ch.id);
          }
        } catch {}
      }
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('✅ ส่งใบสมัครสำเร็จ!').setDescription('ใบสมัครของคุณถูกส่งไปยังแอดมินแล้ว รอผลการพิจารณานะครับ/ค่ะ').setTimestamp()] }); return;
    }

    case 'modal_content': {
      const p = getProjectById(parts.join(':'));
      if (!p) { await interaction.reply({ content: '❌ ไม่พบโปรเจกต์', ephemeral: true }); return; }
      const color = interaction.fields.getTextInputValue('embed_color').trim();
      updateProject(p.id, {
        embedTitle:       interaction.fields.getTextInputValue('embed_title').trim(),
        embedDescription: interaction.fields.getTextInputValue('embed_description').trim(),
        embedColor:       /^#[0-9A-Fa-f]{6}$/.test(color) ? color : (p.embedColor || '#5865F2'),
      });
      const u = getProjectById(p.id);
      await interaction.update({ embeds: [buildAdminEmbed(u), buildPreviewEmbed(u)], components: buildAdminRows(u.id) }); return;
    }

    case 'modal_fields': {
      const p = getProjectById(parts.join(':'));
      if (!p) { await interaction.reply({ content: '❌ ไม่พบโปรเจกต์', ephemeral: true }); return; }
      const labels = Array.from({ length: p.fieldCount ?? 1 }, (_, i) => interaction.fields.getTextInputValue(`field_${i}`).trim());
      updateProject(p.id, { fieldLabels: labels });
      const u = getProjectById(p.id);
      await interaction.update({ embeds: [buildAdminEmbed(u), buildPreviewEmbed(u)], components: buildAdminRows(u.id) }); return;
    }

    case 'modal_system': {
      const p = getProjectById(parts.join(':'));
      if (!p) { await interaction.reply({ content: '❌ ไม่พบโปรเจกต์', ephemeral: true }); return; }
      updateProject(p.id, {
        adminRoleId:     interaction.fields.getTextInputValue('admin_role_id').trim(),
        adminChannelId:  interaction.fields.getTextInputValue('admin_channel_id').trim(),
        targetChannelId: interaction.fields.getTextInputValue('target_channel_id').trim(),
      });
      const u = getProjectById(p.id);
      await interaction.update({ embeds: [buildAdminEmbed(u), buildPreviewEmbed(u)], components: buildAdminRows(u.id) }); return;
    }

    case 'modal_button_color': {
      const p = getProjectById(parts.join(':'));
      if (!p) { await interaction.reply({ content: '❌ ไม่พบโปรเจกต์', ephemeral: true }); return; }
      const hex = interaction.fields.getTextInputValue('button_hex_color').trim();
      if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
        await interaction.reply({ content: '❌ รหัสสีไม่ถูกต้อง ตัวอย่าง: `#FF0000`', ephemeral: true }); return;
      }
      updateProject(p.id, { buttonColor: hex });
      const u = getProjectById(p.id);
      await interaction.update({ embeds: [buildAdminEmbed(u), buildPreviewEmbed(u)], components: buildAdminRows(u.id) }); return;
    }

    case 'modal_button_label': {
      const p = getProjectById(parts.join(':'));
      if (!p) { await interaction.reply({ content: '❌ ไม่พบโปรเจกต์', ephemeral: true }); return; }
      const label = interaction.fields.getTextInputValue('button_label').trim();
      if (label) updateProject(p.id, { buttonLabel: label });
      const u = getProjectById(p.id);
      await interaction.update({ embeds: [buildAdminEmbed(u), buildPreviewEmbed(u)], components: buildAdminRows(u.id) }); return;
    }

    case 'modal_reject': {
      const appId = parts[0];
      const app   = getApplication(appId);
      if (!app)                     { await interaction.reply({ content: '❌ ไม่พบใบสมัครนี้', ephemeral: true }); return; }
      if (app.status !== 'pending') { await interaction.reply({ content: '❌ ใบสมัครนี้ถูกดำเนินการแล้ว', ephemeral: true }); return; }
      const reason = interaction.fields.getTextInputValue('reject_reason').trim();
      await interaction.deferReply({ ephemeral: true });
      updateApplicationStatus(appId, 'rejected', app.logMessageId, app.logChannelId);
      try {
        const user = await interaction.client.users.fetch(app.applicantId);
        await user.send({ embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('❌ ใบสมัครของคุณถูกปฏิเสธ').setDescription(`โปรเจกต์: **${app.projectName}**\n\n**สาเหตุ:** ${reason}`).setTimestamp()] });
      } catch {}
      if (app.logMessageId && app.logChannelId) {
        try {
          const logCh = await interaction.client.channels.fetch(app.logChannelId);
          if (logCh?.isTextBased()) {
            const logMsg   = await logCh.messages.fetch(app.logMessageId);
            const rejEmbed = new EmbedBuilder().setColor(0xed4245).setTitle('❌ ปฏิเสธแล้ว')
              .addFields(
                { name: 'ปฏิเสธโดย', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'สาเหตุ', value: reason },
              ).setTimestamp();
            const doneRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('done_approve').setLabel('✅ อนุมัติ').setStyle(ButtonStyle.Success).setDisabled(true),
              new ButtonBuilder().setCustomId('done_reject').setLabel('❌ ปฏิเสธแล้ว').setStyle(ButtonStyle.Danger).setDisabled(true),
            );
            await logMsg.edit({ embeds: [...logMsg.embeds, rejEmbed], components: [doneRow] });
          }
        } catch {}
      }
      await interaction.editReply({ content: `✅ ปฏิเสธใบสมัครและแจ้งผู้สมัครแล้ว\n**สาเหตุ:** ${reason}` }); return;
    }

    default: return;
  }
}

// ============================================================
//  LOGIN
// ============================================================

client.login(process.env.DISCORD_TOKEN);
