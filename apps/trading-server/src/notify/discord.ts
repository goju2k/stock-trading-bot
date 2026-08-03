import axios from 'axios';

// Jenkins의 send-to-discord job이 쓰는 색상 팔레트와 동일하게 맞춰서 시스템 전체 알림 색을 통일한다.
// Cyan 기타/정보, Green 성공, Red 실패, Yellow 알림/요약, Blue 일반 정보.
export const DISCORD_COLOR = {
  cyan: 14745599,
  green: 9498256,
  red: 16711680,
  yellow: 16776960,
  blue: 255,
} as const;

export interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
}

// DISCORD_WEBHOOK_URL 미설정시 조용히 스킵 - 알림은 어디까지나 부가기능이라 실패해도
// 매매 로직을 막으면 안 된다.
export async function sendDiscordMessage(embed: DiscordEmbed) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log(`[discord] DISCORD_WEBHOOK_URL not set - skip: ${embed.title}`);
    return;
  }

  try {
    await axios.post(webhookUrl, { embeds: [ embed ] });
  } catch (error) {
    console.error('[discord] send failed', error);
  }
}