import { User } from '../types';

/**
 * Parses YYYY-MM-DD string into year, month, day numbers
 * without any UTC or browser timezone shift.
 */
export function parseDateParts(dateStr?: string): { year: number; month: number; day: number } | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.trim().split('-');
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return { year, month, day };
}

/**
 * Returns the current calendar date in GMT+8 (Asia/Manila),
 * falling back to local time if Intl fails.
 */
export function getCurrentGMT8Date(): { year: number; month: number; day: number; dateString: string } {
  const now = new Date();
  try {
    const gmt8Str = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    const parts = parseDateParts(gmt8Str);
    if (parts) {
      return { ...parts, dateString: gmt8Str };
    }
  } catch {
    // fallback
  }
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return { year, month, day, dateString: `${year}-${pad(month)}-${pad(day)}` };
}

/**
 * Dynamically computes a member's current age from their birthdate (YYYY-MM-DD),
 * evaluated against the current GMT+8 calendar date.
 * If the member's birthday is today or has passed this year, their age is incremented.
 */
export function calculateMemberAge(birthdate?: string, fallbackAge?: number): number | undefined {
  if (!birthdate) return fallbackAge;
  const bParts = parseDateParts(birthdate);
  if (!bParts) return fallbackAge;

  const cur = getCurrentGMT8Date();

  let age = cur.year - bParts.year;
  // If current month is before birth month, or same month but current day is before birth day:
  if (cur.month < bParts.month || (cur.month === bParts.month && cur.day < bParts.day)) {
    age--;
  }

  return age >= 0 ? age : fallbackAge;
}

/**
 * Checks if today is the member's birthday in GMT+8.
 */
export function isMemberBirthdayToday(birthdate?: string): boolean {
  if (!birthdate) return false;
  const bParts = parseDateParts(birthdate);
  if (!bParts) return false;

  const cur = getCurrentGMT8Date();
  return cur.month === bParts.month && cur.day === bParts.day;
}

/**
 * Retrieves all approved members celebrating their birthday today in GMT+8.
 */
export function getBirthdayCelebrators(members: User[]): User[] {
  if (!Array.isArray(members)) return [];
  return members.filter((m) => {
    if (m.approvalStatus && m.approvalStatus !== 'Approved') return false;
    return isMemberBirthdayToday(m.birthdate);
  });
}

/**
 * Generates the official, emoji-free birthday greeting email content,
 * invoking God's blessing, Jesus Christ, and encouraging fellow members to greet them.
 */
export function generateBirthdayEmailContent(
  celebratorName: string,
  birthdateStr?: string
): { subject: string; body: string; html: string } {
  const cur = getCurrentGMT8Date();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const dateFormatted = `${monthNames[cur.month - 1]} ${cur.day}, ${cur.year}`;

  const subject = `Happy Birthday, ${celebratorName} - Birthday Greetings and Blessings from BCC Riders Club`;

  const body = `Dear BCC Riders Club Family,

Today, ${dateFormatted}, we join together in celebration of the birthday of our valued club member and rider, ${celebratorName}.

On behalf of the entire BCC Riders Club, we give thanks to our God for the precious gift of ${celebratorName}'s life, fellowship, and companionship on every journey we share.

May God abundantly bless you on your birthday and in the year ahead. We pray that our Lord and Savior Jesus Christ grants you good health, divine protection on all roads, inner peace, and boundless joy. May God guide your path, watch over your coming and going, and grant you many more safe and memorable rides ahead.

To all BCC Riders Club members:
Please join us in honoring ${celebratorName} today! We encourage everyone to reach out, send a personal greeting, and share your warmest birthday wishes and prayers with our celebrator. Let us make their day truly memorable with the fellowship and love of our club family.

May our God and Jesus Christ bless and keep you always, ${celebratorName}. Happy Birthday!

Sincerely in Christ and fellowship,
BCC Riders Club Community and Leadership
Ride Strong. Ride Together.`;

  const html = `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; border: 1px solid #e2ece2; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
  <div style="background-color: #1b4332; padding: 24px 28px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 20px; letter-spacing: 0.5px;">BCC Riders Club</h1>
    <p style="color: #b7e4c7; margin: 6px 0 0; font-size: 13px;">Official Community Birthday Broadcast</p>
  </div>
  
  <div style="padding: 28px;">
    <p style="font-size: 15px; margin-top: 0;"><strong>Dear BCC Riders Club Family,</strong></p>
    
    <p style="font-size: 14px; color: #374151;">
      Today, <strong>${dateFormatted}</strong>, we join together in celebration of the birthday of our valued club member and rider, <strong style="color: #1b4332;">${celebratorName}</strong>.
    </p>

    <div style="background-color: #f7f9f7; border-left: 4px solid #2d6a4f; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">
      <p style="font-size: 14px; color: #2d6a4f; margin: 0; font-style: italic;">
        On behalf of the entire BCC Riders Club, we give thanks to our God for the precious gift of ${celebratorName}'s life, fellowship, and companionship on every journey we share.
      </p>
    </div>

    <p style="font-size: 14px; color: #374151;">
      May God abundantly bless you on your birthday and in the year ahead. We pray that our Lord and Savior Jesus Christ grants you good health, divine protection on all roads, inner peace, and boundless joy. May God guide your path, watch over your coming and going, and grant you many more safe and memorable rides ahead.
    </p>

    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 24px 0;">
      <h3 style="color: #1b4332; margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">To all BCC Riders Club members:</h3>
      <p style="font-size: 13px; color: #166534; margin: 0;">
        Please join us in honoring <strong>${celebratorName}</strong> today! We encourage everyone to reach out, send a personal greeting, and share your warmest birthday wishes and prayers with our celebrator. Let us make their day truly memorable with the fellowship and love of our club family.
      </p>
    </div>

    <p style="font-size: 14px; color: #1b4332; font-weight: bold; margin-bottom: 24px;">
      May our God and Jesus Christ bless and keep you always, ${celebratorName}. Happy Birthday!
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

    <p style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Sincerely in Christ and fellowship,</p>
    <p style="font-size: 13px; color: #1b4332; font-weight: bold; margin: 0;">BCC Riders Club Community and Leadership</p>
    <p style="font-size: 11px; color: #9ca3af; margin-top: 2px;">Ride Strong. Ride Together.</p>
  </div>
</div>
`;

  return { subject, body, html };
}
