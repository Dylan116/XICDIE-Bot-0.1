import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) {
  console.error('❌ กรุณาตั้งค่า DISCORD_TOKEN และ DISCORD_CLIENT_ID ใน .env');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('xicnie')
    .setDescription('สร้างหรือเปิดระบบรับสมัครสมาชิก')
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('ชื่อโปรเจกต์ (ใช้แยกหลายระบบในเซิร์ฟเวอร์เดียวกัน)')
        .setRequired(true)
    )
    .toJSON(),
];

const rest = new REST().setToken(DISCORD_TOKEN);

(async () => {
  try {
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, GUILD_ID), { body: commands });
      console.log(`✅ Register สำเร็จ (Guild: ${GUILD_ID}) — ใช้งานได้ทันที`);
    } else {
      await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), { body: commands });
      console.log('✅ Register สำเร็จ (Global) — ใช้เวลา ~1 ชั่วโมงกว่าจะอัปเดตในทุกเซิร์ฟเวอร์');
    }
  } catch (err) {
    console.error('❌ Register ล้มเหลว:', err);
    process.exit(1);
  }
})();
