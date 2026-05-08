# xicnie Bot v2.0

ระบบรับสมัครสมาชิก Discord Bot แบบ Multi-Server พร้อมทุกฟีเจอร์

## ฟีเจอร์

- Global / Multi-Server (รองรับทุกเซิร์ฟเวอร์)
- Admin Panel ตั้งค่าได้ทุกอย่าง
- ช่องกรอก 1-5 ช่อง กำหนดหัวข้อเองได้
- สีปุ่ม Hex color + Emoji บนปุ่ม
- ห้องวางฟอร์ม (Target Channel) แยกจากห้องแอดมิน
- อนุมัติ → ให้ยศอัตโนมัติ + แจ้ง DM
- ปฏิเสธ → ระบุสาเหตุ + แจ้ง DM
- ลบข้อมูลพร้อมยืนยัน
- Keep-alive server สำหรับ UptimeRobot
- Presence: Watching X คนสมัครสมาชิก

## วิธีติดตั้ง

```bash
npm install
cp .env.example .env
# แก้ไข .env ใส่ DISCORD_TOKEN และ DISCORD_CLIENT_ID
npm run deploy   # register slash command (ครั้งแรกครั้งเดียว)
npm start
```

## Deploy บน Render (ฟรี)

1. Push โค้ดขึ้น GitHub
2. render.com → New → Web Service → เชื่อม GitHub repo
3. Build Command: `npm install` | Start Command: `npm start`
4. Environment Variables: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`
5. Deploy แล้วรัน `npm run deploy` เพื่อ register command

## UptimeRobot (ป้องกันบอทหลับ)

- uptimerobot.com → Add Monitor → HTTP(s)
- URL: `https://[app-name].onrender.com/health`
- Interval: 5 minutes

## หมายเหตุ

- รัน bot ได้แค่ตัวเดียวต่อ token — อย่ารันสองที่พร้อมกัน
- Global commands ใช้เวลา ~1 ชม. กว่าจะเห็นในทุกเซิร์ฟเวอร์
- counter.json จะหายเมื่อ Render restart (free tier) — รัน /xicnie ใหม่เพื่อตั้งค่า
- ต้องการให้ยศอัตโนมัติ → เปิด SERVER MEMBERS INTENT ใน Developer Portal
