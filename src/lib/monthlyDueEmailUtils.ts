import { getCurrentGMT8Date } from './birthdayUtils';

export interface MonthlyDueEmailOptions {
  month: string;
  year: number;
  amount: number;
  title?: string;
  notes?: string;
  senderName?: string;
}

export interface UnpaidDueItem {
  dueId?: string;
  month: string;
  year: number;
  amount: number;
  title?: string;
  dueDate?: string;
  status?: string;
}

export interface IndividualDueReminderEmailOptions {
  memberName: string;
  memberEmail: string;
  unpaidDues: UnpaidDueItem[];
  customMessage?: string;
}

/**
 * Generates official, Christian fellowship monthly dues broadcast email content.
 * Completely free of emojis, includes God's blessings and Jesus Christ,
 * reminds members of the active monthly due, and provides a clear notice
 * encouraging members to settle any unsettled/unpaid previous monthly dues.
 */
export function generateMonthlyDueEmailContent(options: MonthlyDueEmailOptions): {
  subject: string;
  body: string;
  html: string;
} {
  const { month, year, amount, title, notes } = options;
  const cur = getCurrentGMT8Date();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const dateFormatted = `${monthNames[cur.month - 1]} ${cur.day}, ${cur.year}`;
  const dueName = title || `${month} ${year} Monthly Due`;
  const formattedAmount = `PHP ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const subject = `BCC Riders Club - Monthly Dues Notice: ${month} ${year} (${formattedAmount})`;

  const body = `Dear BCC Riders Club Family and Fellow Riders,

We greet you in the name of our Lord and Savior Jesus Christ!

This is an official notice that the monthly dues for ${month} ${year} have been scheduled.

Monthly Due Details:
- Covered Period: ${month} ${year}
- Item: ${dueName}
- Amount: ${formattedAmount} per member
- Date of Notice: ${dateFormatted}
${notes ? `- Additional Notes: ${notes}\n` : ''}
Reminder on Previous Monthly Dues:
If you have any unsettled or unpaid monthly dues from previous months, please take this opportunity to settle them alongside your current monthly due. Timely contributions ensure our club projects, emergency assistance funds, and community activities continue to thrive and remain transparent for all members.

Payment Remittance:
Kindly remit your contributions to the club treasurer or through the official club payment channels (GCash / Cash). Please ensure you keep a reference or copy of your payment confirmation for recording.

May our God bless your livelihood, provide for all your needs, and keep you and your loved ones safe under His divine protection on every road and journey ahead.

Sincerely in Christ and fellowship,
BCC Riders Club Community and Leadership
Ride Strong. Ride Together.`;

  const html = `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; border: 1px solid #e2ece2; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
  <div style="background-color: #1b4332; padding: 24px 28px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 20px; letter-spacing: 0.5px;">BCC Riders Club</h1>
    <p style="color: #b7e4c7; margin: 6px 0 0; font-size: 13px;">Official Monthly Dues Advisory</p>
  </div>
  
  <div style="padding: 28px;">
    <p style="font-size: 15px; margin-top: 0;"><strong>Dear BCC Riders Club Family and Fellow Riders,</strong></p>
    
    <p style="font-size: 14px; color: #374151;">
      We greet you in the grace, peace, and fellowship of our Lord and Savior Jesus Christ.
    </p>

    <div style="background-color: #f7f9f7; border-left: 4px solid #2d6a4f; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">
      <p style="font-size: 14px; color: #1b4332; font-weight: bold; margin: 0 0 4px 0;">
        Monthly Due Notice: ${month} ${year}
      </p>
      <p style="font-size: 13px; color: #2d6a4f; margin: 0;">
        The monthly contribution for the period of <strong>${month} ${year}</strong> is now open for payment.
      </p>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #fdfefe; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
      <tbody>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px 14px; font-size: 13px; color: #6b7280; width: 40%; font-weight: bold;">Covered Period</td>
          <td style="padding: 10px 14px; font-size: 14px; color: #111827; font-weight: bold;">${month} ${year}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px 14px; font-size: 13px; color: #6b7280; font-weight: bold;">Amount Due</td>
          <td style="padding: 10px 14px; font-size: 15px; color: #1b4332; font-weight: bold;">${formattedAmount}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px 14px; font-size: 13px; color: #6b7280; font-weight: bold;">Item Description</td>
          <td style="padding: 10px 14px; font-size: 13px; color: #374151;">${dueName}</td>
        </tr>
        ${
          notes
            ? `<tr>
          <td style="padding: 10px 14px; font-size: 13px; color: #6b7280; font-weight: bold;">Notes</td>
          <td style="padding: 10px 14px; font-size: 13px; color: #374151;">${notes}</td>
        </tr>`
            : ''
        }
      </tbody>
    </table>

    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 24px 0;">
      <h3 style="color: #1b4332; margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
        Reminder on Previous Monthly Dues
      </h3>
      <p style="font-size: 13px; color: #166534; margin: 0 0 8px 0;">
        If you have any unsettled or unpaid monthly dues from previous months, please take this opportunity to settle them alongside your current monthly due.
      </p>
      <p style="font-size: 12px; color: #2d6a4f; margin: 0;">
        Your regular and faithful contributions sustain our club operations, emergency rider funds, and community activities.
      </p>
    </div>

    <p style="font-size: 13px; color: #4b5563;">
      <strong>Payment Remittance:</strong> Please send payments through official club channels (GCash or Cash to the Club Treasurer) and retain your payment reference for verified accounting.
    </p>

    <p style="font-size: 14px; color: #1b4332; font-weight: bold; margin: 24px 0 16px 0;">
      May God bless your livelihood and work, and may Jesus Christ keep you safe on all your rides!
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

/**
 * Generates official, personalized Christian fellowship unpaid monthly dues reminder
 * email addressed individually to a single member, itemizing their unsettled monthly dues,
 * covered periods, amounts, and total balance.
 */
export function generateIndividualDueReminderEmailContent(options: IndividualDueReminderEmailOptions): {
  subject: string;
  body: string;
  html: string;
  totalUnpaidAmount: number;
} {
  const { memberName, unpaidDues, customMessage } = options;
  const cur = getCurrentGMT8Date();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const dateFormatted = `${monthNames[cur.month - 1]} ${cur.day}, ${cur.year}`;

  const totalUnpaidAmount = unpaidDues.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const formattedTotal = `PHP ${totalUnpaidAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const subject = `BCC Riders Club - Friendly Reminder: Unsettled Monthly Dues (${formattedTotal})`;

  const duesListText = unpaidDues
    .map((d, idx) => `  ${idx + 1}. ${d.title || `${d.month} ${d.year} Monthly Due`} - PHP ${Number(d.amount).toFixed(2)}`)
    .join('\n');

  const duesRowsHtml = unpaidDues
    .map(
      (d) => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px 14px; font-size: 13px; color: #111827; font-weight: bold;">${d.month} ${d.year}</td>
        <td style="padding: 10px 14px; font-size: 13px; color: #4b5563;">${d.title || 'Monthly Due'}</td>
        <td style="padding: 10px 14px; font-size: 14px; color: #b91c1c; font-weight: bold; text-align: right;">PHP ${Number(d.amount).toFixed(2)}</td>
      </tr>`
    )
    .join('');

  const body = `Dear ${memberName},

We greet you in the peace, love, and fellowship of our Lord and Savior Jesus Christ!

This is a personal and friendly reminder from BCC Riders Club regarding your membership monthly dues. According to our latest finance and ledger records, the following monthly dues remain unsettled or unpaid:

Unpaid Monthly Dues:
${duesListText}

Total Outstanding Balance: ${formattedTotal}
Date of Notice: ${dateFormatted}
${customMessage ? `\nNote from Leadership / Treasurer:\n${customMessage}\n` : ''}
Payment Remittance:
Kindly settle your balance through official club payment channels (GCash or Cash directly to our Club Treasurer) at your earliest convenience. Once payment is completed, please provide your payment reference or confirmation receipt so our finance team can promptly update your ledger and membership standing.

Your faithful contributions sustain our club operations, emergency rider assistance fund, outreach events, and mutual aid brotherhood.

May our Lord God continue to bless the work of your hands, supply all your needs according to His riches in glory, and grant you safe travels on all your journeys.

Sincerely in Christ and brotherhood,
BCC Riders Club Finance and Leadership Team
Ride Strong. Ride Together.`;

  const html = `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; border: 1px solid #e2ece2; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
  <div style="background-color: #1b4332; padding: 24px 28px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 20px; letter-spacing: 0.5px;">BCC Riders Club</h1>
    <p style="color: #b7e4c7; margin: 6px 0 0; font-size: 13px;">Personal Monthly Dues Statement & Reminder</p>
  </div>
  
  <div style="padding: 28px;">
    <p style="font-size: 15px; margin-top: 0;"><strong>Dear ${memberName},</strong></p>
    
    <p style="font-size: 14px; color: #374151;">
      We greet you in the grace, peace, and fellowship of our Lord and Savior Jesus Christ.
    </p>

    <div style="background-color: #fff7ed; border-left: 4px solid #ea580c; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">
      <p style="font-size: 14px; color: #9a3412; font-weight: bold; margin: 0 0 4px 0;">
        Personal Monthly Dues Advisory
      </p>
      <p style="font-size: 13px; color: #c2410c; margin: 0;">
        Our club records show that you have <strong>${unpaidDues.length}</strong> unsettled monthly due contribution(s) totaling <strong>${formattedTotal}</strong>.
      </p>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #fdfefe; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
      <thead>
        <tr style="background-color: #f3f4f6; border-bottom: 2px solid #e5e7eb; text-align: left;">
          <th style="padding: 10px 14px; font-size: 12px; color: #374151; font-weight: bold;">Period</th>
          <th style="padding: 10px 14px; font-size: 12px; color: #374151; font-weight: bold;">Description</th>
          <th style="padding: 10px 14px; font-size: 12px; color: #374151; font-weight: bold; text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${duesRowsHtml}
        <tr style="background-color: #f8fafc; border-top: 2px solid #cbd5e1;">
          <td colspan="2" style="padding: 12px 14px; font-size: 14px; color: #1e293b; font-weight: bold;">Total Outstanding Due:</td>
          <td style="padding: 12px 14px; font-size: 16px; color: #b91c1c; font-weight: 800; text-align: right;">${formattedTotal}</td>
        </tr>
      </tbody>
    </table>

    ${
      customMessage
        ? `<div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px 16px; margin: 18px 0;">
        <p style="font-size: 12px; color: #64748b; margin: 0 0 4px 0; font-weight: bold;">Note from Club Leadership:</p>
        <p style="font-size: 13px; color: #334155; margin: 0;">${customMessage}</p>
      </div>`
        : ''
    }

    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 24px 0;">
      <h3 style="color: #1b4332; margin: 0 0 6px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">
        Payment Remittance Instructions
      </h3>
      <p style="font-size: 13px; color: #166534; margin: 0 0 6px 0;">
        Please settle your balance through official club channels (GCash or Cash to the Club Treasurer).
      </p>
      <p style="font-size: 12px; color: #2d6a4f; margin: 0;">
        Kindly send your payment reference number or screenshot to ensure your ledger is promptly updated.
      </p>
    </div>

    <p style="font-size: 14px; color: #1b4332; font-weight: bold; margin: 24px 0 16px 0;">
      May God abundantly bless your livelihood, provide for all your needs, and protect you and your family on every road!
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

    <p style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Sincerely in Christ and brotherhood,</p>
    <p style="font-size: 13px; color: #1b4332; font-weight: bold; margin: 0;">BCC Riders Club Finance and Leadership Team</p>
    <p style="font-size: 11px; color: #9ca3af; margin-top: 2px;">Ride Strong. Ride Together.</p>
  </div>
</div>
`;

  return { subject, body, html, totalUnpaidAmount };
}

