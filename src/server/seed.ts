import { db } from './db.ts';
import type {
  FakeInboxPayload,
  DigitalDetectivePayload,
  TimedChallengePayload,
  ConsequencePayload,
} from '../types/scamverse.ts';

export function seedDatabase(): void {
  const existingMissions = (db.prepare('SELECT COUNT(*) as cnt FROM missions').get() as { cnt: number }).cnt;
  if (existingMissions === 0) {
    seedMissionsAndScenarios();
  }

  const existingBadges = (db.prepare('SELECT COUNT(*) as cnt FROM achievements').get() as { cnt: number }).cnt;
  if (existingBadges === 0) {
    seedAchievements();
  }

  const existingCategories = (db.prepare('SELECT COUNT(*) as cnt FROM report_categories').get() as { cnt: number }).cnt;
  if (existingCategories === 0) {
    seedReportCategoriesAndSamples();
  }

  const existingModules = (db.prepare('SELECT COUNT(*) as cnt FROM learning_modules').get() as { cnt: number }).cnt;
  if (existingModules === 0) {
    seedLearningModules();
  }

  const existingSampleBoard = (
    db.prepare('SELECT COUNT(*) as cnt FROM sample_leaderboard_entries').get() as { cnt: number }
  ).cnt;
  if (existingSampleBoard === 0) {
    seedSampleLeaderboard();
  }

  // Clean up any legacy "(Sample)" / "(Fictional)" / "NG-DEMO-" strings in existing DB rows
  db.exec(`
    UPDATE sample_leaderboard_entries SET display_name = REPLACE(display_name, ' (Sample)', '');
    UPDATE suspicious_number_reports
      SET reference_code = REPLACE(reference_code, 'NG-DEMO-', 'NG-2026-'),
          description = REPLACE(description, 'Fictional demo report: ', ''),
          moderation_note = CASE
            WHEN moderation_note LIKE '%demonstration%' THEN 'Verified awareness record.'
            ELSE moderation_note
          END
      WHERE reference_code LIKE 'NG-DEMO-%' OR description LIKE 'Fictional demo report:%' OR moderation_note LIKE '%demonstration%';
    UPDATE scenarios
      SET payload_json = REPLACE(REPLACE(REPLACE(REPLACE(payload_json, ' (Fictional)', ''), ' (Simulated)', ''), ' (Sim)', ''), '-Sim', '-Alert');
    UPDATE learning_modules
      SET content_json = REPLACE(content_json, 'Fictional ', 'Example ');
  `);
}

function seedMissionsAndScenarios(): void {
  const insertMission = db.prepare(`
    INSERT INTO missions (slug, title, mode, description, difficulty, points_reward, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertScenario = db.prepare(`
    INSERT INTO scenarios (mission_id, mode, title, category, region_tag, payload_json, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const fakeInboxMissionId = Number(
    insertMission.run(
      'fake-inbox-essentials',
      'Fake Inbox — Scam Detection Lab',
      'fake_inbox',
      'Inspect realistic SMS, WhatsApp, and email messages to separate genuine alerts from social engineering traps.',
      'Beginner to Intermediate',
      10,
      1
    ).lastInsertRowid
  );

  const inboxScenarios: Array<{
    title: string;
    category: string;
    regionTag: string;
    payload: FakeInboxPayload;
  }> = [
    {
      title: 'Urgent Bank Account Suspension Alert',
      category: 'Banking Phishing',
      regionTag: 'Pakistan',
      payload: {
        channel: 'SMS',
        senderName: 'Meezan-Verify-Alert',
        senderAddress: '+92-300-0000112',
        timestamp: 'Today · 09:42 AM',
        body: 'URGENT: Your Meezan digital banking access has been temporarily restricted due to KYC mismatch. Verify your CNIC and 6-digit OTP within 2 hours at https://meezan-kyc-sim.invalid/verify or your account will be frozen.',
        fictionalLink: 'https://meezan-kyc-sim.invalid/verify',
        isScam: true,
        suspiciousPhrases: ['within 2 hours', '6-digit OTP', 'meezan-kyc-sim.invalid', 'account will be frozen'],
        redFlags: [
          'Sent from an ordinary mobile number instead of an official bank short code.',
          'Creates artificial panic with a strict 2-hour freeze deadline.',
          'Requests a 6-digit OTP on an external non-official domain.',
        ],
        safeResponse: 'Delete the SMS without clicking the link. Open your bank’s official app directly or dial the verified helpline printed on the back of your debit card.',
        explanation: 'Legitimate banks never ask you to enter an OTP or PIN on an external link sent via personal mobile numbers.',
      },
    },
    {
      title: 'Benazir Digital Relief Grant Notification',
      category: 'Prize & Grant Fraud',
      regionTag: 'Pakistan',
      payload: {
        channel: 'WhatsApp',
        senderName: 'BISP Relief Desk Officer',
        senderAddress: '+92-321-0000245',
        timestamp: 'Today · 11:15 AM',
        body: 'Mubarak ho! Your CNIC has been selected for PKR 35,000 Digital Family Support Grant. To release funds to your JazzCash/Easypaisa wallet, send PKR 850 biometric verification fee to Account 0321-0000245 now.',
        isScam: true,
        suspiciousPhrases: ['Mubarak ho!', 'PKR 35,000', 'send PKR 850 biometric verification fee', '0321-0000245'],
        redFlags: [
          'Government relief programs never collect processing fees via personal JazzCash/Easypaisa accounts.',
          'Official announcements come from verified 8171 SMS channels, not private WhatsApp officers.',
          'Advance-fee trap: demanding a small payment to unlock a large payout.',
        ],
        safeResponse: 'Do not send any fee or share your CNIC copy. Block the sender and verify program eligibility only through official government portals.',
        explanation: 'Advance-fee scams promise urgent cash grants and ask victims to send a small verification or tax fee first.',
      },
    },
    {
      title: 'Standard Debit Card Purchase Receipt',
      category: 'Legitimate Banking Alert',
      regionTag: 'Pakistan',
      payload: {
        channel: 'SMS',
        senderName: 'HBL-ALERTS',
        senderAddress: '8425 (Official Short Code)',
        timestamp: 'Yesterday · 06:18 PM',
        body: 'Dear Customer, PKR 2,450.00 was spent on your HBL Debit Card ending 4821 at Metro Cash & Carry Lahore on 26-Nov. Available balance: PKR 41,200.50. If unauthorized, call 021-111-111-425 immediately.',
        isScam: false,
        suspiciousPhrases: [],
        redFlags: [],
        safeResponse: 'No action needed if you made this purchase. If you do not recognize the charge, call the official helpline listed inside your bank app or card.',
        explanation: 'This alert contains no clickable URLs, asks for zero passwords or OTPs, displays masked card digits, and directs disputes only to an official helpline.',
      },
    },
    {
      title: 'Remote Video-Liking Part-Time Job',
      category: 'Fake Job Offer',
      regionTag: 'Pakistan & Global',
      payload: {
        channel: 'WhatsApp',
        senderName: 'Amina HR — Digital Media',
        senderAddress: '+92-333-0000389',
        timestamp: 'Today · 01:05 PM',
        body: 'Hello! We are hiring part-time remote assistants to like and subscribe YouTube channels. Earn PKR 8,500–15,000 daily from home! First 3 tasks paid immediately. Activate your VIP task tier by depositing PKR 3,000 security bond.',
        isScam: true,
        suspiciousPhrases: ['PKR 8,500–15,000 daily', 'like and subscribe', 'depositing PKR 3,000 security bond'],
        redFlags: [
          'Unrealistic daily pay for trivial clicks or social media likes.',
          'Requires an upfront "security bond" or "VIP tier deposit" before earning.',
          'Unsolicited recruitment via random WhatsApp message with no formal interview.',
        ],
        safeResponse: 'Ignore and block immediately. Legitimate employers never require job seekers to pay a deposit to unlock work tasks.',
        explanation: 'Task-scam networks pay tiny initial amounts to build false trust, then vanish once victims deposit larger VIP upgrade fees.',
      },
    },
    {
      title: 'Courier Customs Hold SMS',
      category: 'Delivery Phishing',
      regionTag: 'Pakistan',
      payload: {
        channel: 'SMS',
        senderName: 'TCS-Dispatch-Alert',
        senderAddress: '+92-345-0000411',
        timestamp: 'Today · 02:40 PM',
        body: 'TCS Express: Your parcel #PK-99210 cannot be delivered due to incomplete street number and PKR 380 customs surcharge. Update address and pay online: https://tcs-parcel-pay.invalid/track',
        fictionalLink: 'https://tcs-parcel-pay.invalid/track',
        isScam: true,
        suspiciousPhrases: ['PKR 380 customs surcharge', 'tcs-parcel-pay.invalid', 'pay online'],
        redFlags: [
          'Uses a lookalike domain instead of the official courier website.',
          'Unexpected parcel notification demanding immediate small card/wallet payment.',
          'Originated from a standard 11-digit mobile number.',
        ],
        safeResponse: 'Check your tracking ID directly on the courier’s official website or mobile app instead of tapping SMS links.',
        explanation: 'Smishing delivery texts use small fake fees to harvest debit card numbers and OTPs.',
      },
    },
    {
      title: 'WhatsApp Security Code Forwarding Trick',
      category: 'Account Takeover',
      regionTag: 'Global',
      payload: {
        channel: 'WhatsApp',
        senderName: 'WhatsApp Security Desk',
        senderAddress: '+1-555-0100-991',
        timestamp: 'Today · 03:12 PM',
        body: 'Notice: Your WhatsApp account has been flagged for irregular device activity and will expire in 3 hours. Reply with the 6-digit registration code sent to your SMS to keep your chats.',
        isScam: true,
        suspiciousPhrases: ['will expire in 3 hours', 'Reply with the 6-digit registration code'],
        redFlags: [
          'WhatsApp never messages users inside chat asking for SMS verification codes.',
          'Sharing your 6-digit registration code lets attackers hijack your WhatsApp account.',
          'Uses urgency ("expire in 3 hours") to rush compliance.',
        ],
        safeResponse: 'Never share your 6-digit WhatsApp verification PIN with anyone. Enable Two-Step Verification inside WhatsApp Settings.',
        explanation: 'Attackers trigger a login attempt on your number and trick you into reading back the SMS verification code.',
      },
    },
    {
      title: 'University Semester Portal Maintenance Notice',
      category: 'Legitimate Institution Email',
      regionTag: 'Pakistan',
      payload: {
        channel: 'Email',
        senderName: 'NUST IT Services',
        senderAddress: 'it-notice@nust-portal-edu.example',
        timestamp: 'Yesterday · 04:00 PM',
        subject: 'Scheduled LMS Maintenance — Sunday 2:00 AM to 4:00 AM PKT',
        body: 'Dear Students, the Learning Management System will undergo routine database maintenance this Sunday between 02:00 and 04:00 PKT. No action or password reset is required from your side. Please save pending quiz drafts before midnight.',
        isScam: false,
        suspiciousPhrases: [],
        redFlags: [],
        safeResponse: 'Acknowledge the maintenance window and save your drafts early. Notice that the email asks for zero clicks or credentials.',
        explanation: 'Informational IT notices that do not pressure you to log in through embedded links or share credentials are low-risk.',
      },
    },
    {
      title: 'International Merit Scholarship Processing Fee',
      category: 'Academic Phishing',
      regionTag: 'Global',
      payload: {
        channel: 'Email',
        senderName: 'Global Academic Council',
        senderAddress: 'awards@merit-scholar-global.invalid',
        timestamp: 'Today · 08:25 AM',
        subject: 'FINAL NOTICE: 100% Tuition Scholarship Seat Reserved',
        body: 'Congratulations! You have been pre-approved for a full UK Masters Scholarship without IELTS. Reply immediately with your passport scan, bank statement, and $50 seat-lock wire transfer before 5:00 PM GMT.',
        isScam: true,
        suspiciousPhrases: ['without IELTS', '$50 seat-lock wire transfer', 'passport scan, bank statement', 'FINAL NOTICE'],
        redFlags: [
          'Legitimate scholarships do not require urgent wire transfers to lock a seat.',
          'Unsolicited "pre-approval" bypassing standard academic requirements.',
          'Harvests sensitive identity documents (passport + bank statement).',
        ],
        safeResponse: 'Verify scholarships only through official university domains or recognized national bodies like HEC.',
        explanation: 'Scholarship scams exploit student aspirations to steal identity documents and upfront processing fees.',
      },
    },
  ];

  inboxScenarios.forEach((s, idx) => {
    insertScenario.run(
      fakeInboxMissionId,
      'fake_inbox',
      s.title,
      s.category,
      s.regionTag,
      JSON.stringify(s.payload),
      idx + 1
    );
  });

  // 2. Digital Detective Mission
  const detectiveMissionId = Number(
    insertMission.run(
      'digital-detective-lab',
      'Digital Detective — Case Investigations',
      'digital_detective',
      'Examine simulated websites, job portals, and investment pitches to isolate red-flag clues.',
      'Intermediate',
      20,
      2
    ).lastInsertRowid
  );

  const detectiveScenarios: Array<{
    title: string;
    category: string;
    regionTag: string;
    payload: DigitalDetectivePayload;
  }> = [
    {
      title: 'Case 01: FlashBazaar Clearance Electronics',
      category: 'Fraudulent E-Commerce',
      regionTag: 'Pakistan',
      payload: {
        caseCode: 'CASE-PK-104',
        channelLabel: 'E-Commerce Storefront',
        previewTitle: 'FlashBazaar Mega Clearance — Flagship Smartphone',
        previewUrlOrHandle: 'http://flashbazaar-pk-deals.invalid/iphone-flash',
        previewSubtitle: 'Brand New 256GB PTA-Approved — PKR 68,000 (78% OFF Today Only)',
        previewBody:
          'Limited stock! Only 2 units left. Cash on Delivery disabled for clearance items. Transfer 100% advance payment to our manager’s personal Easypaisa wallet (0300-0000771) and send receipt on WhatsApp for 24-hour dispatch.',
        previewCtaText: 'Pay Advance via Personal Wallet',
        previewFooterNote: 'Contact: flashbazaar.gmail.com · Return Policy: No refunds on flash deals · Page created 4 days ago',
        clues: [
          {
            id: 'c1-url',
            label: 'Unencrypted Lookalike URL',
            excerpt: 'http://flashbazaar-pk-deals.invalid',
            isRedFlag: true,
            explanation: 'Uses plain HTTP and a disposable hyphenated domain name rather than an established HTTPS storefront.',
          },
          {
            id: 'c1-price',
            label: 'Unrealistic 78% Discount',
            excerpt: 'PKR 68,000 (78% OFF Today Only)',
            isRedFlag: true,
            explanation: 'Current-generation PTA-approved phones never sell at a 78% markdown; extreme discounts are bait.',
          },
          {
            id: 'c1-cod',
            label: 'Advance Personal Wallet Transfer Only',
            excerpt: 'Cash on Delivery disabled... Transfer 100% advance to personal Easypaisa',
            isRedFlag: true,
            explanation: 'Refusing Cash on Delivery or buyer-protected checkout while demanding transfers to a personal number removes all buyer protection.',
          },
          {
            id: 'c1-contact',
            label: 'Free Webmail & Zero Refund Policy',
            excerpt: 'flashbazaar.gmail.com · No refunds on flash deals',
            isRedFlag: true,
            explanation: 'No registered business address, generic Gmail contact, and zero return protections.',
          },
          {
            id: 'c1-storage',
            label: 'Storage Capacity Spec (256GB)',
            excerpt: '256GB PTA-Approved',
            isRedFlag: false,
            explanation: 'Listing product storage specs is normal product information, though scammers often pair real specs with fake prices.',
          },
          {
            id: 'c1-dispatch',
            label: '24-Hour Dispatch Claim',
            excerpt: '24-hour dispatch',
            isRedFlag: false,
            explanation: 'Next-day shipping itself is offered by legitimate stores too; the real danger is the unverified advance wallet payment.',
          },
        ],
        summaryExplanation:
          'This storefront combines impossible clearance pricing, an unencrypted domain, no Cash-on-Delivery option, and a demand for advance payment to a personal mobile wallet.',
        safetyRecommendations: [
          'Prefer Cash on Delivery with open-parcel verification or protected marketplace escrow for high-value electronics.',
          'Check domain age, official social presence, and real customer reviews outside the seller’s own page.',
          'Never transfer advance payments to personal mobile wallets for unverified social media ads.',
        ],
      },
    },
    {
      title: 'Case 02: Apex Global Remote Data Entry Offer',
      category: 'Employment Fraud',
      regionTag: 'Pakistan & Global',
      payload: {
        caseCode: 'CASE-EMP-209',
        channelLabel: 'Job Portal Message',
        previewTitle: 'Apex Global Solutions — Remote Typist & Form Clerk',
        previewUrlOrHandle: 't.me/apex_hr_fast_hiring',
        previewSubtitle: 'Salary: PKR 240,000 / month · No Experience Required · Work 1 Hour Daily',
        previewBody:
          'You are shortlisted without an interview! Submit front & back photos of your CNIC, personal bank IBAN, and pay PKR 4,500 refundable software license fee to receive your welcome laptop kit.',
        previewCtaText: 'Upload CNIC & Pay PKR 4,500',
        previewFooterNote: 'HR Contact: hr-desk-apex@outlook-sim.invalid · Reply within 30 minutes to hold slot',
        clues: [
          {
            id: 'c2-salary',
            label: 'Extreme Salary for Low-Skill Work',
            excerpt: 'PKR 240,000 / month · Work 1 Hour Daily',
            isRedFlag: true,
            explanation: 'Paying executive-level monthly salaries for 1 hour of basic typing is economically implausible.',
          },
          {
            id: 'c2-interview',
            label: 'Hired Without Any Interview',
            excerpt: 'shortlisted without an interview',
            isRedFlag: true,
            explanation: 'Reputable remote employers verify skills and identity through structured interviews before issuing offers.',
          },
          {
            id: 'c2-fee',
            label: 'Refundable Software License Fee',
            excerpt: 'pay PKR 4,500 refundable software license fee',
            isRedFlag: true,
            explanation: 'Charging applicants upfront for software, equipment, or training kits is a classic employment scam indicator.',
          },
          {
            id: 'c2-cnic',
            label: 'Early CNIC Photos & Bank IBAN Request',
            excerpt: 'front & back photos of your CNIC, personal bank IBAN',
            isRedFlag: true,
            explanation: 'Collecting ID documents via Telegram before verifying an employer exposes you to identity theft.',
          },
          {
            id: 'c2-remote',
            label: 'Remote Work Format',
            excerpt: 'Remote Typist & Form Clerk',
            isRedFlag: false,
            explanation: 'Remote jobs themselves are common today; always judge the hiring process and fee demands rather than the remote label alone.',
          },
          {
            id: 'c2-title',
            label: 'Company Name Mentioned',
            excerpt: 'Apex Global Solutions',
            isRedFlag: false,
            explanation: 'Scammers frequently borrow plausible or real-sounding corporate names; verify via the company’s official careers page.',
          },
        ],
        summaryExplanation:
          'Fake job recruiters pair inflated pay promises with Telegram-only onboarding, skip interviews, and extract both identity documents and upfront kit fees.',
        safetyRecommendations: [
          'Never pay onboarding, software, or equipment deposit fees to get hired.',
          'Verify recruiters on LinkedIn and confirm email domains match the official company website.',
          'Wait until a signed, verified contract is in place before sharing sensitive national ID scans.',
        ],
      },
    },
    {
      title: 'Case 03: National Telecom Anniversary Giveaway',
      category: 'Social Media Giveaway',
      regionTag: 'Pakistan',
      payload: {
        caseCode: 'CASE-SOC-315',
        channelLabel: 'Social Post',
        previewTitle: '25th Anniversary Subscriber Cashback Draw',
        previewUrlOrHandle: '@telecom_pk_rewards_official_sim',
        previewSubtitle: 'First 500 Subscribers Claim PKR 25,000 Voucher + 50GB Data',
        previewBody:
          'Offer ends in 04:59 minutes! Enter your mobile number, current wallet MPIN, and forward this post to 10 WhatsApp groups to unlock your voucher balance immediately.',
        previewCtaText: 'Enter Wallet MPIN to Claim',
        previewFooterNote: 'Account created yesterday · 12 followers · Comments turned off',
        clues: [
          {
            id: 'c3-mpin',
            label: 'Requests Mobile Wallet MPIN',
            excerpt: 'current wallet MPIN',
            isRedFlag: true,
            explanation: 'A mobile wallet PIN/MPIN authorizes outgoing transfers—no genuine giveaway ever asks for your secret PIN.',
          },
          {
            id: 'c3-timer',
            label: 'Fake Countdown Urgency',
            excerpt: 'Offer ends in 04:59 minutes!',
            isRedFlag: true,
            explanation: 'Countdown timers force hasty decisions before you notice account discrepancies.',
          },
          {
            id: 'c3-share',
            label: 'Chain-Forwarding Requirement',
            excerpt: 'forward this post to 10 WhatsApp groups',
            isRedFlag: true,
            explanation: 'Viral forwarding spreads the scam organically using trusted friend groups.',
          },
          {
            id: 'c3-account',
            label: 'New Account with Disabled Comments',
            excerpt: 'Account created yesterday · Comments turned off',
            isRedFlag: true,
            explanation: 'Fresh impersonator accounts disable comments to hide warnings from previous victims.',
          },
          {
            id: 'c3-data',
            label: 'Promotional Data Bundle Mention',
            excerpt: '50GB Data',
            isRedFlag: false,
            explanation: 'Telecoms do run data promos, but always inside their official verified app—never through MPIN-harvesting forms.',
          },
          {
            id: 'c3-brand',
            label: 'Anniversary Theme',
            excerpt: '25th Anniversary',
            isRedFlag: false,
            explanation: 'Companies celebrate anniversaries legitimately, so check the verified blue badge and official app.',
          },
        ],
        summaryExplanation:
          'Giveaway impersonators use countdown pressure, newly created handles, and disabled comments to steal mobile wallet MPINs.',
        safetyRecommendations: [
          'Never enter your mobile wallet MPIN, banking PIN, or OTP on external giveaway pages.',
          'Check official telecom promotions exclusively inside the verified carrier app.',
        ],
      },
    },
    {
      title: 'Case 04: CryptoYield VIP Guaranteed Signals',
      category: 'Investment Fraud',
      regionTag: 'Global',
      payload: {
        caseCode: 'CASE-INV-402',
        channelLabel: 'Investment Landing Page',
        previewTitle: 'CryptoYield AI Arbitrage — Guaranteed 40% Weekly Profit',
        previewUrlOrHandle: 'https://cryptoyield-vip-bot.invalid',
        previewSubtitle: 'Zero Risk · Automated Daily Payouts · Minimum Deposit $200 USDT',
        previewBody:
          'Our proprietary quantum bot guarantees 40% profit every 7 days regardless of market direction. Deposit USDT to the admin wallet address below; withdrawals unlock after inviting 2 referrals.',
        previewCtaText: 'Send $200 USDT to Admin Wallet',
        previewFooterNote: 'No regulatory license listed · Screenshots of luxury cars & payout receipts',
        clues: [
          {
            id: 'c4-return',
            label: 'Guaranteed 40% Weekly Return',
            excerpt: 'Guaranteed 40% Weekly Profit · Zero Risk',
            isRedFlag: true,
            explanation: 'No legitimate financial or crypto instrument can guarantee fixed high weekly returns with zero risk.',
          },
          {
            id: 'c4-wallet',
            label: 'Direct Transfer to Admin Wallet',
            excerpt: 'Deposit USDT to the admin wallet address',
            isRedFlag: true,
            explanation: 'Sending irreversible crypto directly to an anonymous wallet surrenders custody immediately.',
          },
          {
            id: 'c4-referral',
            label: 'Withdrawal Locked Behind Referrals',
            excerpt: 'withdrawals unlock after inviting 2 referrals',
            isRedFlag: true,
            explanation: 'Pyramid/Ponzi mechanics restrict withdrawals unless you recruit new depositors.',
          },
          {
            id: 'c4-license',
            label: 'Unregulated & Lifestyle Hype',
            excerpt: 'No regulatory license listed · Screenshots of luxury cars',
            isRedFlag: true,
            explanation: 'Manipulated payout screenshots and luxury imagery substitute for real audits or regulation.',
          },
          {
            id: 'c4-usdt',
            label: 'Mentions USDT Stablecoin',
            excerpt: '$200 USDT',
            isRedFlag: false,
            explanation: 'USDT is a real digital asset; its mention does not make a platform legitimate.',
          },
          {
            id: 'c4-daily',
            label: 'Weekly Payout Cadence Label',
            excerpt: 'every 7 days',
            isRedFlag: false,
            explanation: 'A payout schedule label is neutral on its own; the unrealistic guaranteed percentage is the red flag.',
          },
        ],
        summaryExplanation:
          'High-yield investment scams promise guaranteed zero-risk returns, rely on referral locks, and demand irreversible transfers to private crypto wallets.',
        safetyRecommendations: [
          'Treat any promise of guaranteed high investment returns as a strong fraud warning sign.',
          'Verify financial service providers with recognized national regulators (such as SECP in Pakistan).',
        ],
      },
    },
  ];

  detectiveScenarios.forEach((s, idx) => {
    insertScenario.run(
      detectiveMissionId,
      'digital_detective',
      s.title,
      s.category,
      s.regionTag,
      JSON.stringify(s.payload),
      idx + 1
    );
  });

  // 3. 60-Second Scam Challenge
  const timedMissionId = Number(
    insertMission.run(
      'sixty-second-blitz',
      '60-Second Scam Challenge',
      'timed_challenge',
      'Rapid-fire classification under a 60-second clock. Decide fast whether each alert is a scam or safe.',
      'Fast-Paced',
      25,
      3
    ).lastInsertRowid
  );

  const timedScenarios: Array<{
    title: string;
    category: string;
    payload: TimedChallengePayload;
  }> = [
    {
      title: 'OTP Phone Call',
      category: 'Bank Impersonation',
      payload: {
        channel: 'Call',
        sender: 'Caller claiming to be Bank Fraud Desk',
        prompt: 'Caller says: "Someone just tried to spend PKR 45,000 on your card. Read me the 6-digit SMS code now so I can block it."',
        isScam: true,
        quickTip: 'Bank staff NEVER ask you to read back an OTP to block a transaction.',
      },
    },
    {
      title: 'Official App Balance Check',
      category: 'Safe Practice',
      payload: {
        channel: 'Web',
        sender: 'Your own banking app opened from phone home screen',
        prompt: 'You open your verified banking app directly and see a prompt asking you to enable biometric login on your personal phone.',
        isScam: false,
        quickTip: 'Biometric prompts inside the official app you launched yourself are safe.',
      },
    },
    {
      title: 'Easypaisa Prize Fee',
      category: 'Advance Fee',
      payload: {
        channel: 'SMS',
        sender: '+92-300-0000818',
        prompt: '"You won PKR 100,000 in Eid Lucky Draw! Send PKR 1,200 tax to 0300-0000818 within 30 minutes to claim."',
        isScam: true,
        quickTip: 'Never pay money upfront to receive a prize.',
      },
    },
    {
      title: 'Two-Factor Login Alert You Triggered',
      category: 'Safe Alert',
      payload: {
        channel: 'Email',
        sender: 'security@your-email-provider.example',
        prompt: 'You just clicked "Sign In" on a new laptop and immediately received an email code with no external password-reset links.',
        isScam: false,
        quickTip: 'Expected MFA codes triggered by your own login action are normal—just never share them.',
      },
    },
    {
      title: 'WhatsApp Friend Emergency Loan',
      category: 'Account Hijack',
      payload: {
        channel: 'WhatsApp',
        sender: 'Cousin’s WhatsApp (Unusual tone)',
        prompt: '"Salam, stuck in hospital emergency, send PKR 25,000 right now to my friend’s Raast ID, my phone mic is broken so don’t call."',
        isScam: true,
        quickTip: 'Always verify urgent money requests via a direct voice call or second channel.',
      },
    },
    {
      title: 'Pay-to-Work Freelance Task',
      category: 'Job Scam',
      payload: {
        channel: 'WhatsApp',
        sender: 'Digital Talent Recruiter',
        prompt: '"Earn PKR 10,000/day reviewing hotels! Deposit PKR 2,500 first to unlock Task Batch #2."',
        isScam: true,
        quickTip: 'Legitimate jobs pay you; they never ask you to deposit money for tasks.',
      },
    },
    {
      title: 'School Portal Receipt',
      category: 'Safe Alert',
      payload: {
        channel: 'Email',
        sender: 'accounts@cityschool-portal.edu.pk.example',
        prompt: 'Monthly fee challan #4412 generated. View or download PDF inside your parent portal (no login link attached, no urgent fee threat).',
        isScam: false,
        quickTip: 'Directing users to log in manually on a known portal without credential traps is safe.',
      },
    },
    {
      title: 'Lookalike Domain Password Reset',
      category: 'Phishing',
      payload: {
        channel: 'Email',
        sender: 'support@paypa1-security-check.invalid',
        prompt: '"Unusual login from abroad! Click paypa1-security-check.invalid immediately to confirm your password and card CVV."',
        isScam: true,
        quickTip: 'Watch for character swaps like "paypa1" instead of "paypal" and requests for CVV.',
      },
    },
    {
      title: 'QR Code to "Receive" Money',
      category: 'Payment Trap',
      payload: {
        channel: 'WhatsApp',
        sender: 'Marketplace Buyer',
        prompt: '"I am paying for your used phone. Scan this QR code in your wallet app and enter your PIN to RECEIVE PKR 40,000."',
        isScam: true,
        quickTip: 'Entering your wallet PIN on a QR prompt SENDS money out—you never enter a PIN to receive funds.',
      },
    },
    {
      title: 'Utility Bill Official SMS',
      category: 'Safe Alert',
      payload: {
        channel: 'SMS',
        sender: 'LESCO-INFO',
        prompt: 'Bill for Ref #14112233445566 is PKR 4,820 due 28-Nov. Pay through your preferred banking app using the 14-digit reference.',
        isScam: false,
        quickTip: 'Paying via your own bank app using a reference number with no shady links is safe.',
      },
    },
    {
      title: 'SIM Block NADRA Threat',
      category: 'Impersonation',
      payload: {
        channel: 'Call',
        sender: '+92-312-0000902',
        prompt: '"Your SIM will be blocked by PTA/NADRA tonight unless you confirm your mother’s maiden name and bank ATM PIN right now."',
        isScam: true,
        quickTip: 'PTA and NADRA never ask for ATM PINs or banking details over the phone.',
      },
    },
    {
      title: 'Fake Software Crack Download',
      category: 'Malware Trap',
      payload: {
        channel: 'Web',
        sender: 'free-pro-tools-crack.invalid',
        prompt: '"Download Free Adobe Suite 2026 Cracked.exe — disable Windows Defender antivirus before opening."',
        isScam: true,
        quickTip: 'Instructions to disable antivirus for pirated software almost always deliver infostealer malware.',
      },
    },
    {
      title: 'Official Two-Step Verification Prompt',
      category: 'Safe Practice',
      payload: {
        channel: 'Web',
        sender: 'Account Security Settings',
        prompt: 'Your email account suggests adding a 6-digit authenticator app (TOTP) for stronger login security.',
        isScam: false,
        quickTip: 'Using an authenticator app inside your official settings protects against SIM swaps and phishing.',
      },
    },
    {
      title: 'Visa Slot Express Broker',
      category: 'Advance Fee',
      payload: {
        channel: 'WhatsApp',
        sender: 'Embassy FastTrack Agent',
        prompt: '"Guaranteed Schengen visa in 5 days without biometrics! Send PKR 90,000 advance today via personal bank transfer."',
        isScam: true,
        quickTip: 'Only official embassies and authorized centers process visas; nobody can legally bypass biometrics.',
      },
    },
  ];

  timedScenarios.forEach((s, idx) => {
    insertScenario.run(
      timedMissionId,
      'timed_challenge',
      s.title,
      s.category,
      'Pakistan & Global',
      JSON.stringify(s.payload),
      idx + 1
    );
  });

  // 4. Choose Your Consequence Branching Simulations
  const consequenceMissionId = Number(
    insertMission.run(
      'choose-your-consequence',
      'Choose Your Consequence',
      'consequence',
      'Experience how split-second reactions shape real-world cybersecurity outcomes through branching scenarios.',
      'Decision Lab',
      15,
      4
    ).lastInsertRowid
  );

  const consequenceScenarios: Array<{
    title: string;
    category: string;
    regionTag: string;
    payload: ConsequencePayload;
  }> = [
    {
      title: 'The PKR 50,000 Prize Processing Fee',
      category: 'Prize & Advance Fee',
      regionTag: 'Pakistan',
      payload: {
        situation: 'You receive a congratulatory SMS and WhatsApp message claiming your mobile number won PKR 50,000 in a digital wallet anniversary draw.',
        senderContext: 'Sender: +92-300-0000555 · Claims to represent Wallet Rewards Desk',
        messagePreview:
          'Congratulations! Ticket #PK-8821 won PKR 50,000. Pay a small PKR 1,500 government tax processing fee via link https://wallet-claim-sim.invalid within 20 minutes to receive your prize.',
        safestOptionId: 'opt-verify-ignore',
        debrief:
          'Advance-fee scams rely on excitement and a short countdown. Legitimate promotions never ask winners to pay taxes or processing fees upfront to a personal number or external link.',
        options: [
          {
            id: 'opt-pay',
            label: 'Pay the PKR 1,500 processing fee immediately',
            outcomeTitle: 'Financial Loss & Escalating Demands',
            outcomeType: 'compromised',
            narrative:
              'Once you transfer PKR 1,500, the sender replies claiming "a PKR 4,000 verification clearance fee is now required before payout." When you refuse, they block your number. Your PKR 1,500 is gone.',
            pointsDelta: 0,
            lesson: 'Paying an initial small fee marks your number as responsive to follow-up extortion.',
          },
          {
            id: 'opt-click',
            label: 'Click the link to inspect the prize form',
            outcomeTitle: 'Credential Harvesting Trap',
            outcomeType: 'risky',
            narrative:
              'The link opens a cloned wallet login screen asking for your mobile number, wallet MPIN, and SMS OTP. Even without paying, entering details there exposes your entire account balance.',
            pointsDelta: 5,
            lesson: 'Inspecting unknown links directly risks drive-by phishing forms; verify independently instead.',
          },
          {
            id: 'opt-verify',
            label: 'Open your official wallet app directly to check promotions',
            outcomeTitle: 'Safe Verification — Trap Avoided',
            outcomeType: 'safe',
            narrative:
              'You ignore the link and check the Announcements tab inside your official mobile wallet app. No draw exists. You avoided losing money and kept your credentials protected.',
            pointsDelta: 15,
            lesson: 'Always verify offers inside the official app or website you navigate to yourself.',
          },
          {
            id: 'opt-verify-ignore',
            label: 'Ignore, report the suspicious number on NumberGuard, and block',
            outcomeTitle: 'Best Community Defense Outcome',
            outcomeType: 'safe',
            narrative:
              'You refuse to engage, block the sender, and submit a community alert on ScamVerse NumberGuard so others checking +92-300-0000555 see the warning before paying.',
            pointsDelta: 20,
            lesson: 'Blocking and reporting suspicious patterns protects both you and the wider community.',
          },
        ],
      },
    },
    {
      title: 'The Urgent Bank Call Asking for Your OTP',
      category: 'Voice Phishing (Vishing)',
      regionTag: 'Pakistan',
      payload: {
        situation: 'A polite caller claiming to be from your bank’s "Card Security Department" tells you an unauthorized international charge of PKR 82,000 is pending.',
        senderContext: 'Caller ID: Spoofed Bank Name · Background sounds like a busy call center',
        messagePreview:
          '"Sir/Madam, to cancel this PKR 82,000 transaction right now, read me the 6-digit SMS code you just received from the bank."',
        safestOptionId: 'opt-hangup',
        debrief:
          'Caller ID can be spoofed to look like a real bank number. The SMS code arriving on your phone is actually authorizing the attacker’s transfer or password reset.',
        options: [
          {
            id: 'opt-read-otp',
            label: 'Read out the 6-digit OTP quickly so the charge is blocked',
            outcomeTitle: 'Account Compromised',
            outcomeType: 'compromised',
            narrative:
              'The moment you read the OTP, the attacker completes a PKR 82,000 transfer out of your account and changes your mobile banking password.',
            pointsDelta: 0,
            lesson: 'OTPs are electronic signatures that authorize actions—they never cancel fraud.',
          },
          {
            id: 'opt-ask-id',
            label: 'Ask the caller for their employee ID before deciding',
            outcomeTitle: 'False Confidence Risk',
            outcomeType: 'risky',
            narrative:
              'The scammer smoothly reads a fake employee ID ("EMP-4912") and even knows your full name and branch city from a data leak, pressuring you harder to share the OTP.',
            pointsDelta: 5,
            lesson: 'Knowing your name or reciting an employee ID does not prove someone works for your bank.',
          },
          {
            id: 'opt-hangup',
            label: 'Hang up immediately and call the helpline on the back of your card',
            outcomeTitle: 'Account Secured — Fraud Stopped',
            outcomeType: 'safe',
            narrative:
              'You end the call without sharing any digits and dial the verified number on the back of your debit card. The real bank confirms a password-reset attempt was blocked because no OTP was shared.',
            pointsDelta: 20,
            lesson: 'Ending suspicious calls and initiating a fresh call to an official number defeats caller-ID spoofing.',
          },
        ],
      },
    },
    {
      title: 'Freelance Client Moves Off-Platform',
      category: 'Freelance Payment Trap',
      regionTag: 'Pakistan & Global',
      payload: {
        situation: 'You are a university freelancer. A high-paying client messages you on a freelance marketplace and asks to move the conversation to WhatsApp to avoid platform fees.',
        senderContext: 'Client Handle: GlobalBrand Media (New unverified account)',
        messagePreview:
          '"Great portfolio! Let’s finalize on WhatsApp. Click our company escrow link https://escrow-release-sim.invalid and verify your Visa card with a $10 refundable check to receive your $900 advance."',
        safestOptionId: 'opt-stay-platform',
        debrief:
          'Moving off-platform removes dispute protection and escrow guarantees. Real clients never require freelancers to pay a verification charge to receive project funds.',
        options: [
          {
            id: 'opt-card-check',
            label: 'Enter your debit card details for the $10 refundable check',
            outcomeTitle: 'Card Drained & Zero Project Payment',
            outcomeType: 'compromised',
            narrative:
              'Instead of a $10 check, multiple unauthorized charges hit your card, and the "client" disappears from WhatsApp.',
            pointsDelta: 0,
            lesson: 'Refundable verification charges sent via unknown links are credential/card harvesting traps.',
          },
          {
            id: 'opt-stay-platform',
            label: 'Refuse off-platform links and require official marketplace milestone funding',
            outcomeTitle: 'Professional Boundary Protected Your Earnings',
            outcomeType: 'safe',
            narrative:
              'You politely insist on keeping communication and escrow milestones on the official freelance platform. The scammer immediately stops replying, proving their intent.',
            pointsDelta: 20,
            lesson: 'Legitimate clients respect platform escrow protections and never ask freelancers to pay to get paid.',
          },
          {
            id: 'opt-send-iban',
            label: 'Skip the link but give full card number + expiry on WhatsApp',
            outcomeTitle: 'High Card Fraud Exposure',
            outcomeType: 'risky',
            narrative:
              'Sharing full card numbers and expiry dates in chat exposes you to unauthorized online charges on sites that do not require 3D Secure.',
            pointsDelta: 0,
            lesson: 'To receive legitimate bank transfers, only an IBAN or official invoice link is ever used—never card numbers or CVV.',
          },
        ],
      },
    },
    {
      title: 'Marketplace Laptop Deal Below Market Price',
      category: 'Online Shopping Fraud',
      regionTag: 'Pakistan',
      payload: {
        situation: 'You spot a gently used laptop listed at 45% below normal market price on a classifieds group. The seller lives in another city.',
        senderContext: 'Seller: Imran Tech Store (Unverified group post)',
        messagePreview:
          '"Brother, 4 other buyers are ready. Send PKR 15,000 token advance via Raast right now and I will ship by courier tonight—balance on delivery!"',
        safestOptionId: 'opt-local-cod',
        debrief:
          'Partial "token advances" on classifieds are one of the most common online shopping scams. Once the token is sent, the seller blocks you.',
        options: [
          {
            id: 'opt-token',
            label: 'Send PKR 15,000 token advance so you don’t lose the deal',
            outcomeTitle: 'Token Lost — No Parcel Shipped',
            outcomeType: 'compromised',
            narrative:
              'You transfer PKR 15,000. The seller sends a blurry fake courier receipt and then stops answering calls.',
            pointsDelta: 0,
            lesson: 'Artificial scarcity ("4 other buyers") pushes buyers to skip safe inspection.',
          },
          {
            id: 'opt-local-cod',
            label: 'Insist on face-to-face inspection in a public place or verified escrow',
            outcomeTitle: 'Smart Buyer Protection',
            outcomeType: 'safe',
            narrative:
              'You offer to meet through a trusted local friend or use a verified cash-on-delivery/escrow service. The seller makes excuses and vanishes—saving you PKR 15,000.',
            pointsDelta: 20,
            lesson: 'High-value electronics from unknown sellers should always be inspected in person before paying.',
          },
          {
            id: 'opt-cnic-ask',
            label: 'Ask for a photo of the seller’s CNIC and then send the advance',
            outcomeTitle: 'False Sense of Security',
            outcomeType: 'risky',
            narrative:
              'Scammers routinely send stolen CNIC photos belonging to previous victims. Sending the advance after seeing an ID photo still results in financial loss.',
            pointsDelta: 5,
            lesson: 'Never trust a WhatsApp CNIC photo as proof of identity—ID images are frequently stolen.',
          },
        ],
      },
    },
  ];

  consequenceScenarios.forEach((s, idx) => {
    insertScenario.run(
      consequenceMissionId,
      'consequence',
      s.title,
      s.category,
      s.regionTag,
      JSON.stringify(s.payload),
      idx + 1
    );
  });
}

function seedAchievements(): void {
  const insertBadge = db.prepare(`
    INSERT INTO achievements (slug, name, description, criteria_type, criteria_threshold, icon_key)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const badges = [
    ['scam-spotter', 'Scam Spotter', 'Correctly classify 3 Fake Inbox scenarios.', 'fake_inbox_correct', 3, 'mail-check'],
    ['digital-detective', 'Digital Detective', 'Solve 2 Digital Detective investigation cases.', 'detective_cases', 2, 'search-check'],
    ['phishing-protector', 'Phishing Protector', 'Complete 3 Digital Safety Learning Centre modules.', 'learning_modules', 3, 'shield-check'],
    ['quick-thinker', 'Quick Thinker', 'Score 5 or more correct answers in one 60-Second Challenge.', 'challenge_correct', 5, 'zap'],
    ['safety-champion', 'Safety Champion', 'Earn 150 total trust points across ScamVerse.', 'total_points', 150, 'award'],
  ];

  for (const b of badges) {
    insertBadge.run(...b);
  }
}

function seedReportCategoriesAndSamples(): void {
  const insertCat = db.prepare('INSERT INTO report_categories (slug, label) VALUES (?, ?)');
  const categories = [
    ['fake-bank-calls', 'Fake bank calls'],
    ['prize-lottery', 'Prize or lottery scams'],
    ['fake-job-offers', 'Fake job offers'],
    ['payment-fraud', 'Payment fraud'],
    ['otp-requests', 'OTP requests'],
    ['harassment-suspicious', 'Harassment or suspicious calls'],
    ['other', 'Other'],
  ];
  for (const c of categories) {
    insertCat.run(...c);
  }

  const insertReport = db.prepare(`
    INSERT INTO suspicious_number_reports (
      reference_code, normalized_phone, country_code, display_phone,
      category_slug, description, incident_date, moderation_status, moderation_note, flag_count, is_sample
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const sampleReports = [
    [
      'NG-2026-1001',
      '+923000000101',
      '+92',
      '+92 300 0000101',
      'fake-bank-calls',
      'Caller claimed to be from bank fraud desk and asked for a 6-digit SMS OTP to unblock a debit card.',
      '2026-11-20',
      'moderated_report',
      'Verified awareness record.',
      0,
    ],
    [
      'NG-2026-1002',
      '+923000000101',
      '+92',
      '+92 300 0000101',
      'otp-requests',
      'Sent SMS claiming KYC expiry within 2 hours with a suspicious bank link.',
      '2026-11-22',
      'moderated_report',
      'Verified awareness record.',
      0,
    ],
    [
      'NG-2026-1003',
      '+923210000204',
      '+92',
      '+92 321 0000204',
      'prize-lottery',
      'WhatsApp message claiming PKR 35,000 relief grant and requesting PKR 850 biometric fee.',
      '2026-11-24',
      'moderated_report',
      'Verified awareness record.',
      0,
    ],
    [
      'NG-2026-1004',
      '+923330000309',
      '+92',
      '+92 333 0000309',
      'fake-job-offers',
      'Promised PKR 12,000/day for liking videos and demanded PKR 3,000 VIP tier deposit.',
      '2026-11-25',
      'under_review',
      'Queued for moderator verification.',
      0,
    ],
    [
      'NG-2026-1005',
      '+923450000411',
      '+92',
      '+92 345 0000411',
      'payment-fraud',
      'Posed as courier support requesting PKR 380 customs surcharge via unverified link.',
      '2026-11-26',
      'moderated_report',
      'Verified awareness record.',
      0,
    ],
  ];

  for (const r of sampleReports) {
    insertReport.run(...r);
  }
}

function seedLearningModules(): void {
  const insertModule = db.prepare(`
    INSERT INTO learning_modules (slug, title, title_ur, summary, summary_ur, content_json, points_reward, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const modules = [
    {
      slug: 'phishing-awareness',
      title: 'Phishing Awareness',
      titleUr: 'فشنگ (Phishing) سے آگاہی',
      summary: 'Learn how attackers disguise malicious links as banks, couriers, and government notices.',
      summaryUr: 'جانیں کہ جعل ساز بینکوں، کوریئر اور سرکاری پیغامات کے نام پر جعلی لنکس کیسے بھیجتے ہیں۔',
      content: {
        explanation:
          'Phishing uses spoofed emails, SMS, and lookalike URLs to trick you into entering passwords, card numbers, or OTPs on fake pages.',
        explanationUr:
          'فشنگ میں جعلی ای میلز، ایس ایم ایس اور ملتے جلتے ویب ایڈریس استعمال کر کے صارفین سے پاس ورڈ یا او ٹی پی حاصل کرنے کی کوشش کی جاتی ہے۔',
        exampleTitle: 'Example SMS Trap',
        exampleMessage: 'Your bank app is locked! Click http://hbl-verify-sim.invalid within 1 hour.',
        exampleMessageUr: 'آپ کا بینک اکاؤنٹ بند ہو رہا ہے! فوراً جعلی لنک پر کلک کریں۔',
        warningSigns: [
          'Urgent threats of account suspension within hours.',
          'Misspelled or hyphenated domain names (.invalid, extra words).',
          'Requests to confirm passwords, PINs, or OTPs via a link.',
        ],
        warningSignsUr: [
          'فوری اکاؤنٹ بند ہونے کی دھمکی۔',
          'مشکوک یا غلط ہجے والا ویب لنک۔',
          'لنک کے ذریعے پاس ورڈ یا او ٹی پی کا مطالبہ۔',
        ],
        safetyTips: [
          'Never tap login links inside unexpected SMS or emails.',
          'Open official banking apps directly from your phone or typed bookmarks.',
        ],
        safetyTipsUr: [
          'غیر متوقع ایس ایم ایس یا ای میل کے لنک پر کلک نہ کریں۔',
          'ہمیشہ سرکاری بینکنگ ایپ براہِ راست کھولیں۔',
        ],
        quiz: [
          {
            id: 'q1',
            question: 'What is the safest response to an urgent SMS claiming your bank account is suspended?',
            questionUr: 'بینک اکاؤنٹ بند ہونے کے فوری پیغام پر محفوظ ترین ردعمل کیا ہے؟',
            options: [
              'Tap the SMS link quickly to verify',
              'Open your official bank app directly or call the helpline on your card',
              'Reply with your CNIC and PIN',
            ],
            optionsUr: [
              'فوراً لنک پر کلک کریں',
              'اپنی آفیشل بینک ایپ کھولیں یا کارڈ کے پیچھے موجود ہیلپ لائن پر کال کریں',
              'شناختی کارڈ اور پن نمبر جواب میں بھیجیں',
            ],
            correctIndex: 1,
            explanation: 'Independent verification via the official app or printed helpline bypasses phishing links completely.',
            explanationUr: 'آفیشل ایپ یا مستند ہیلپ لائن کے ذریعے تصدیق آپ کو جعلی لنکس سے بچاتی ہے۔',
          },
          {
            id: 'q2',
            question: 'Which detail strongly indicates a phishing URL?',
            questionUr: 'ان میں سے کون سی بات جعلی لنک کی نشاندہی کرتی ہے؟',
            options: [
              'Extra words and hyphens like bank-kyc-update-now.invalid',
              'Typing your bank’s official domain manually',
              'Checking statements inside the installed mobile app',
            ],
            optionsUr: [
              'اضافی الفاظ اور ہائفن جیسے bank-kyc-update-now.invalid',
              'بینک کی اصل ویب سائٹ خود ٹائپ کرنا',
              'آفیشل موبائل ایپ میں اسٹیٹمنٹ دیکھنا',
            ],
            correctIndex: 0,
            explanation: 'Attackers register lookalike domains with extra keywords such as "-verify" or "-kyc".',
            explanationUr: 'حملہ آور اصل نام کے ساتھ اضافی الفاظ لگا کر ملتے جلتے جعلی ڈومین بناتے ہیں۔',
          },
        ],
      },
    },
    {
      slug: 'whatsapp-scams',
      title: 'WhatsApp Scams',
      titleUr: 'واٹس ایپ فراڈ سے بچاؤ',
      summary: 'Defend against account hijacking, 6-digit registration code theft, and impersonated friend requests.',
      summaryUr: 'واٹس ایپ ہیکنگ، 6 ہندسوں کے کوڈ کی چوری اور جعلی دوستوں کے پیغامات سے بچیں۔',
      content: {
        explanation:
          'Scammers hijack WhatsApp accounts by triggering an SMS login code to your phone and tricking you into reading it back.',
        explanationUr:
          'فراڈ کرنے والے آپ کے نمبر پر واٹس ایپ کوڈ منگوا کر کسی بہانے سے وہ 6 ہندسوں کا کوڈ آپ سے پوچھ لیتے ہیں۔',
        exampleTitle: 'Example Hijack Attempt',
        exampleMessage: 'Hi, I accidentally sent my WhatsApp verification code to your SMS—please forward those 6 digits!',
        exampleMessageUr: 'سلام، غلطی سے میرا واٹس ایپ کوڈ آپ کے نمبر پر آ گیا ہے، براہ کرم بھیج دیں۔',
        warningSigns: [
          'Anyone asking for a 6-digit WhatsApp SMS registration code.',
          'Sudden financial emergencies from contacts refusing voice calls.',
          'Unknown numbers claiming to be "WhatsApp Support".',
        ],
        warningSignsUr: [
          'کسی کا 6 ہندسوں والا واٹس ایپ کوڈ مانگنا۔',
          'کسی جاننے والے کے نمبر سے اچانک پیسے مانگنا اور کال نہ اٹھانا۔',
          'خود کو واٹس ایپ سپورٹ ظاہر کرنا۔',
        ],
        safetyTips: [
          'Turn on Two-Step Verification (6-digit PIN) in WhatsApp Settings > Account.',
          'Always call a friend on their regular phone number before sending emergency funds.',
        ],
        safetyTipsUr: [
          'واٹس ایپ سیٹنگز میں ٹو اسٹیپ ویریفکیشن (PIN) آن کریں۔',
          'ہنگامی پیسے بھیجنے سے پہلے آواز سن کر تصدیق کریں۔',
        ],
        quiz: [
          {
            id: 'q1',
            question: 'What happens if you share your 6-digit WhatsApp SMS code with someone?',
            questionUr: 'اگر آپ اپنا 6 ہندسوں کا واٹس ایپ کوڈ کسی کو دے دیں تو کیا ہوگا؟',
            options: [
              'Nothing, it only adds them as a contact',
              'They can take over your WhatsApp account on their device',
              'It improves your account security',
            ],
            optionsUr: [
              'کچھ نہیں ہوگا',
              'وہ آپ کا واٹس ایپ اکاؤنٹ اپنے فون پر منتقل کر سکتے ہیں',
              'اکاؤنٹ مزید محفوظ ہو جائے گا',
            ],
            correctIndex: 1,
            explanation: 'That 6-digit code transfers WhatsApp registration to the attacker’s phone.',
            explanationUr: 'یہ کوڈ دوسرے شخص کو آپ کا واٹس ایپ اکاؤنٹ چلانے کا اختیار دے دیتا ہے۔',
          },
          {
            id: 'q2',
            question: 'Which WhatsApp setting stops hijackers even if they intercept an SMS code?',
            questionUr: 'کون سی سیٹنگ آپ کے واٹس ایپ کو مزید محفوظ بناتی ہے؟',
            options: [
              'Enabling Two-Step Verification PIN',
              'Turning off profile picture privacy',
              'Joining public broadcast groups',
            ],
            optionsUr: [
              'ٹو اسٹیپ ویریفکیشن پن فعال کرنا',
              'پروفائل تصویر سب کو دکھانا',
              'عوامی گروپس میں شامل ہونا',
            ],
            correctIndex: 0,
            explanation: 'Two-Step Verification requires an extra secret PIN during new device registration.',
            explanationUr: 'ٹو اسٹیپ ویریفکیشن نئے فون پر لاگ ان کے لیے اضافی خفیہ پن مانگتی ہے۔',
          },
        ],
      },
    },
    {
      slug: 'fake-job-offers',
      title: 'Fake Job Offers',
      titleUr: 'جعلی نوکری کی پیشکشیں',
      summary: 'Spot pay-to-work task scams, fake remote contracts, and recruitment fee traps.',
      summaryUr: 'جعلی آن لائن نوکریوں، ویڈیو لائیک ٹاسک اور رجسٹریشن فیس کے جال کو پہچانیں۔',
      content: {
        explanation:
          'Job scammers lure students and job seekers with easy high salaries, then demand "registration", "VIP task deposit", or "equipment" fees.',
        explanationUr:
          'جعلی بھرتی کرنے والے آسان کام اور بھاری تنخواہ کا لالچ دے کر رجسٹریشن یا ٹاسک ڈپازٹ فیس مانگتے ہیں۔',
        exampleTitle: 'Example Task Scam',
        exampleMessage: 'Earn PKR 12,000 daily rating products! Deposit PKR 3,000 to unlock level 2.',
        exampleMessageUr: 'روزانہ 12,000 روپے کمائیں! لیول 2 کھولنے کے لیے 3,000 روپے جمع کرائیں۔',
        warningSigns: [
          'Asking job applicants to pay money before receiving work or salary.',
          'Immediate hiring via WhatsApp/Telegram without an interview.',
          'Unrealistic pay for trivial tasks like liking videos.',
        ],
        warningSignsUr: [
          'نوکری کے لیے پہلے پیسے یا ڈپازٹ مانگنا۔',
          'بغیر انٹرویو کے فوری بھرتی۔',
          'معمولی کام پر غیر معمولی تنخواہ کا وعدہ۔',
        ],
        safetyTips: [
          'Legitimate employers pay you for your work—never pay to unlock tasks.',
          'Verify company emails and official careers pages before sending CNIC scans.',
        ],
        safetyTipsUr: [
          'حقیقی ادارے کام کے پیسے دیتے ہیں، کام شروع کرنے کے لیے فیس نہیں مانگتے۔',
          'دستاویزات بھیجنے سے پہلے کمپنی کی آفیشل ویب سائٹ سے تصدیق کریں۔',
        ],
        quiz: [
          {
            id: 'q1',
            question: 'A recruiter asks for PKR 2,500 as a "refundable training deposit". What should you do?',
            questionUr: 'ایک ریکروٹر ٹریننگ ڈپازٹ کے نام پر 2,500 روپے مانگ رہا ہے۔ آپ کو کیا کرنا چاہیے؟',
            options: [
              'Pay it quickly before the vacancy closes',
              'Refuse and end contact—legitimate employers do not charge onboarding deposits',
              'Send half now and half later',
            ],
            optionsUr: [
              'فوراً ادا کر دیں',
              'انکار کریں اور رابطہ ختم کریں، اصل ادارے ڈپازٹ نہیں مانگتے',
              'آدھی رقم ابھی بھیجیں',
            ],
            correctIndex: 1,
            explanation: 'Upfront refundable fees are the hallmark of employment fraud.',
            explanationUr: 'واپسی کے وعدے پر پیشگی فیس مانگنا جعلی نوکری کی واضح علامت ہے۔',
          },
          {
            id: 'q2',
            question: 'Why do task scams sometimes pay a small amount like PKR 500 on day one?',
            questionUr: 'جعلی ٹاسک گروپس پہلے دن تھوڑے پیسے کیوں بھیجتے ہیں؟',
            options: [
              'To build false trust before asking for larger VIP deposits',
              'Because the business model is genuinely profitable',
              'Government requirement',
            ],
            optionsUr: [
              'جھوٹا اعتماد پیدا کرنے کے لیے تاکہ بعد میں بڑی رقم جمع کروائی جا سکے',
              'کیونکہ یہ واقعی منافع بخش کاروبار ہے',
              'قانونی تقاضے کے تحت',
            ],
            correctIndex: 0,
            explanation: 'Small initial payouts hook victims into depositing much larger sums.',
            explanationUr: 'چھوٹی ادائیگی اعتماد جیت کر بڑا نقصان پہنچانے کا طریقہ ہے۔',
          },
        ],
      },
    },
    {
      slug: 'online-shopping-safety',
      title: 'Online Shopping Safety',
      titleUr: 'آن لائن خریداری کی حفاظت',
      summary: 'Avoid fake clearance ads, personal-wallet advance payments, and cloned e-commerce stores.',
      summaryUr: 'جعلی ڈسکاؤنٹ اشتہارات اور ایڈوانس پیمنٹ فراڈ سے محفوظ خریداری کے طریقے سیکھیں۔',
      content: {
        explanation:
          'Fraudulent social media shops advertise heavy discounts on phones or apparel, disable Cash on Delivery, and disappear after collecting advance transfers.',
        explanationUr:
          'جعلی آن لائن صفحات غیر معمولی رعایت دکھا کر کیش آن ڈیلیوری بند رکھتے ہیں اور ایڈوانس رقم لے کر غائب ہو جاتے ہیں۔',
        exampleTitle: 'Example Store Trap',
        exampleMessage: '75% OFF Flagship Phone — Advance JazzCash only, no COD!',
        exampleMessageUr: '75 فیصد رعایت! صرف ایڈوانس پیمنٹ، کیش آن ڈیلیوری دستیاب نہیں۔',
        warningSigns: [
          'Prices far below market value (60–80% off latest electronics).',
          'Refusing Cash on Delivery or recognized marketplace checkout.',
          'No physical address, landline, or clear return policy.',
        ],
        warningSignsUr: [
          'مارکیٹ سے بہت کم قیمت۔',
          'کیش آن ڈیلیوری سے انکار اور ذاتی اکاؤنٹ میں ایڈوانس کا مطالبہ۔',
          'واضح پتہ اور واپسی کی پالیسی کا نہ ہونا۔',
        ],
        safetyTips: [
          'Use Cash on Delivery or trusted platforms with buyer protection.',
          'Inspect seller reviews and page creation history before ordering.',
        ],
        safetyTipsUr: [
          'کیش آن ڈیلیوری یا قابلِ اعتماد پلیٹ فارمز استعمال کریں۔',
          'آرڈر سے پہلے صارفین کے تبصرے اور صفحے کی تاریخ چیک کریں۔',
        ],
        quiz: [
          {
            id: 'q1',
            question: 'Which payment method gives the weakest protection when buying from an unknown social media page?',
            questionUr: 'انجان سوشل میڈیا پیج سے خریداری میں سب سے غیر محفوظ طریقہ کون سا ہے؟',
            options: [
              'Cash on Delivery with parcel inspection',
              'Advance bank/wallet transfer to a personal number',
              'Protected marketplace escrow',
            ],
            optionsUr: [
              'کیش آن ڈیلیوری',
              'ذاتی نمبر پر پیشگی رقم منتقلی',
              'محفوظ ایسکرو پیمنٹ',
            ],
            correctIndex: 1,
            explanation: 'Direct transfers to personal accounts are nearly impossible to reverse once sent.',
            explanationUr: 'ذاتی اکاؤنٹ میں بھیجی گئی پیشگی رقم واپس لینا بہت مشکل ہوتا ہے۔',
          },
          {
            id: 'q2',
            question: 'A newly created page offers an original laptop at 75% off. What is the smart step?',
            questionUr: 'نیا صفحہ 75 فیصد رعایت پر لیپ ٹاپ بیچ رہا ہو تو کیا کرنا چاہیے؟',
            options: [
              'Transfer token money quickly',
              'Treat the impossible discount as a major fraud warning and verify elsewhere',
              'Send your CNIC photo first',
            ],
            optionsUr: [
              'فوراً ٹوکن رقم بھیجیں',
              'اس غیر حقیقی رعایت کو خطرے کی علامت سمجھ کر نظرانداز کریں',
              'پہلے شناختی کارڈ کی تصویر بھیجیں',
            ],
            correctIndex: 1,
            explanation: 'Impossible discounts paired with brand-new pages are standard shopping scam setups.',
            explanationUr: 'نئے صفحات پر غیر معمولی سستی قیمتیں عموماً فراڈ کی نشانی ہوتی ہیں۔',
          },
        ],
      },
    },
    {
      slug: 'otp-password-protection',
      title: 'OTP & Password Protection',
      titleUr: 'او ٹی پی (OTP) اور پاس ورڈ کی حفاظت',
      summary: 'Understand why One-Time Passwords must never be shared and how to build resilient credentials.',
      summaryUr: 'جانیں کہ ون ٹائم پاس ورڈ (OTP) کیوں خفیہ رکھنا ضروری ہے اور مضبوط پاس ورڈ کیسے بنائیں۔',
      content: {
        explanation:
          'An OTP is a live authorization key for money transfers and logins. No genuine bank employee, telecom agent, or government officer ever needs your OTP.',
        explanationUr:
          'او ٹی پی رقم کی منتقلی یا لاگ ان کی منظوری کی چابی ہے۔ کوئی بھی حقیقی بینک افسر یا ادارہ آپ سے او ٹی پی نہیں مانگتا۔',
        exampleTitle: 'Example Vishing Call',
        exampleMessage: 'Read your 6-digit OTP to cancel a suspicious transaction.',
        exampleMessageUr: 'مشکوک ٹرانزیکشن روکنے کے لیے اپنا 6 ہندسوں کا او ٹی پی بتائیں۔',
        warningSigns: [
          'Callers claiming they need your OTP to "block" or "reverse" fraud.',
          'Reusing the same password across email, banking, and social apps.',
          'Saving PINs in plain text chats or notes.',
        ],
        warningSignsUr: [
          'فراڈ روکنے کے بہانے او ٹی پی مانگنا۔',
          'ہر اکاؤنٹ پر ایک ہی پاس ورڈ استعمال کرنا۔',
          'پن کوڈ چیٹ یا نوٹس میں محفوظ کرنا۔',
        ],
        safetyTips: [
          'Use unique passphrases (12+ characters) for every critical account.',
          'Prefer authenticator apps (TOTP) over SMS where supported.',
        ],
        safetyTipsUr: [
          'ہر اہم اکاؤنٹ کے لیے الگ اور مضبوط پاس ورڈ رکھیں۔',
          'جہاں ممکن ہو آتھنٹیکیٹر ایپ استعمال کریں۔',
        ],
        quiz: [
          {
            id: 'q1',
            question: 'Does a bank staff member ever need your SMS OTP to protect your account?',
            questionUr: 'کیا بینک عملے کو اکاؤنٹ محفوظ بنانے کے لیے آپ کے او ٹی پی کی ضرورت ہوتی ہے؟',
            options: [
              'Yes, during fraud calls',
              'No, never—an OTP is strictly private to you',
              'Only on weekends',
            ],
            optionsUr: [
              'جی ہاں، فراڈ کال کے دوران',
              'ہرگز نہیں، او ٹی پی صرف آپ کے ذاتی استعمال کے لیے ہوتا ہے',
              'صرف ہفتے کے آخر میں',
            ],
            correctIndex: 1,
            explanation: 'Banks have internal controls and never ask customers for OTPs.',
            explanationUr: 'بینک کبھی صارفین سے او ٹی پی نہیں پوچھتے۔',
          },
          {
            id: 'q2',
            question: 'Which password habit provides the strongest protection?',
            questionUr: 'کون سی عادت سب سے مضبوط تحفظ دیتی ہے؟',
            options: [
              'Using your birth year on all apps',
              'Using a unique long passphrase for every important account plus 2FA',
              'Sharing passwords with trusted friends',
            ],
            optionsUr: [
              'ہر جگہ تاریخِ پیدائش استعمال کرنا',
              'ہر اکاؤنٹ کے لیے الگ طویل پاس ورڈ اور ٹو فیکٹر آتھنٹیکیشن',
              'دوستوں کے ساتھ پاس ورڈ شیئر کرنا',
            ],
            correctIndex: 1,
            explanation: 'Unique passwords stop one leaked site from compromising your email and bank.',
            explanationUr: 'الگ پاس ورڈ ایک جگہ ڈیٹا لیک ہونے پر باقی اکاؤنٹس کو بچاتے ہیں۔',
          },
        ],
      },
    },
    {
      slug: 'social-media-scams',
      title: 'Social Media Scams',
      titleUr: 'سوشل میڈیا فراڈ',
      summary: 'Recognize fake giveaways, cloned profiles, and copyright suspension phishing DMs.',
      summaryUr: 'جعلی انعامات، نقلی پروفائلز اور کاپی رائٹ وارننگ والے پیغامات کو پہچانیں۔',
      content: {
        explanation:
          'Attackers clone influencer or brand profiles and send DMs claiming you won a giveaway or violated copyright—leading straight to credential-stealing forms.',
        explanationUr:
          'حملہ آور مشہور صفحات کی نقل بنا کر انعام یا کاپی رائٹ خلاف ورزی کے جعلی پیغامات بھیجتے ہیں۔',
        exampleTitle: 'Example DM Phish',
        exampleMessage: 'Copyright Notice: Your page will be deleted in 24h unless you appeal at meta-appeal-sim.invalid.',
        exampleMessageUr: 'کاپی رائٹ نوٹس: آپ کا پیج 24 گھنٹے میں بند ہو جائے گا، فوراً اپیل کریں۔',
        warningSigns: [
          'Giveaway accounts messaging you right after you comment on a public post.',
          'Copyright/Blue-tick threats linking to non-official domains.',
          'Requests to forward posts to 10 groups to claim rewards.',
        ],
        warningSignsUr: [
          'پبلک کمنٹ کے فوراً بعد جعلی اکاؤنٹ سے انعام کا پیغام آنا۔',
          'جعلی لنکس پر کاپی رائٹ اپیل کا مطالبہ۔',
          'انعام کے لیے پیغام آگے فارورڈ کرنے کی شرط۔',
        ],
        safetyTips: [
          'Check account verification and handle spelling character by character.',
          'Review account alerts only inside the official app’s Support Inbox.',
        ],
        safetyTipsUr: [
          'اکاؤنٹ کے یوزرنیم کے ہجے غور سے چیک کریں۔',
          'سیکیورٹی الرٹس صرف آفیشل ایپ کے سپورٹ ان باکس میں دیکھیں۔',
        ],
        quiz: [
          {
            id: 'q1',
            question: 'An unverified handle DMs you saying your Instagram/Facebook page faces deletion in 12 hours unless you log into a linked appeal form. What is this?',
            questionUr: 'ایک انجان اکاؤنٹ لنک کے ذریعے 12 گھنٹے میں پیج بند ہونے کی دھمکی دے تو یہ کیا ہے؟',
            options: [
              'A credential-stealing phishing DM',
              'An official platform notice',
              'A helpful backup service',
            ],
            optionsUr: [
              'پاس ورڈ چرانے کی فشنگ کوشش',
              'آفیشل پلیٹ فارم کا پیغام',
              'مددگار بیک اپ سروس',
            ],
            correctIndex: 0,
            explanation: 'Official platforms notify account owners inside official Security & Support settings, not random DMs.',
            explanationUr: 'آفیشل پلیٹ فارمز اکاؤنٹ سیٹنگز کے اندر اطلاع دیتے ہیں، انجان ڈی ایم سے نہیں۔',
          },
          {
            id: 'q2',
            question: 'Why do fake giveaway posts require forwarding to 10 WhatsApp groups?',
            questionUr: 'جعلی انعامات میں 10 گروپس میں فارورڈ کرنے کا کیوں کہا جاتا ہے؟',
            options: [
              'To spread the scam link rapidly using peer trust',
              'To verify mobile network speed',
              'To register your CNIC',
            ],
            optionsUr: [
              'لوگوں کے باہمی اعتماد کے ذریعے فراڈ کو تیزی سے پھیلانے کے لیے',
              'نیٹ ورک اسپیڈ چیک کرنے کے لیے',
              'شناختی کارڈ رجسٹر کرنے کے لیے',
            ],
            correctIndex: 0,
            explanation: 'Viral forwarding tricks friends into trusting links sent by someone they know.',
            explanationUr: 'فارورڈنگ سے دوست احباب اس لنک کو سچ سمجھ لیتے ہیں۔',
          },
        ],
      },
    },
    {
      slug: 'digital-payment-safety',
      title: 'Digital Payment Safety',
      titleUr: 'ڈیجیٹل ادائیگیوں کی حفاظت',
      summary: 'Stay safe with JazzCash, Easypaisa, Raast, and QR transactions—especially the "PIN to Receive" myth.',
      summaryUr: 'جاز کیش، ایزی پیسہ، راست اور کیو آر ادائیگیوں میں محفوظ رہنے کے اصول سیکھیں۔',
      content: {
        explanation:
          'You NEVER need to enter a PIN, MPIN, or approve a payment request to RECEIVE money. Entering your PIN always authorizes an OUTGOING debit.',
        explanationUr:
          'رقم وصول کرنے کے لیے کبھی بھی پن (PIN/MPIN) درج نہیں کرنا پڑتا۔ پن درج کرنے کا مطلب ہمیشہ آپ کے اکاؤنٹ سے پیسے نکلنا ہے۔',
        exampleTitle: 'Example QR/Request Trap',
        exampleMessage: 'Scan this QR and enter your MPIN to receive your OLX payment!',
        exampleMessageUr: 'پیسے وصول کرنے کے لیے کیو آر اسکین کر کے اپنا پن درج کریں!',
        warningSigns: [
          'Buyers asking you to scan a QR code or enter a PIN to receive money.',
          'Edited screenshots of Raast/bank transfer receipts before balance updates.',
          'Callers pretending to be wallet agents asking for biometric/PIN reset.',
        ],
        warningSignsUr: [
          'پیسے بھیجنے کے بجائے کیو آر اسکین یا پن مانگنا۔',
          'بیلنس چیک کیے بغیر صرف اسکرین شاٹ پر اعتبار کرنا۔',
          'والٹ ایجنٹ بن کر پن ری سیٹ کروانا۔',
        ],
        safetyTips: [
          'Always verify received funds inside your own banking/wallet balance history—not from WhatsApp screenshots.',
          'Remember: PIN = Money Leaving Your Wallet.',
        ],
        safetyTipsUr: [
          'وصول شدہ رقم ہمیشہ اپنی ایپ کے بیلنس میں چیک کریں، اسکرین شاٹ پر بھروسہ نہ کریں۔',
          'یاد رکھیں: پن درج کرنے سے پیسے اکاؤنٹ سے نکلتے ہیں۔',
        ],
        quiz: [
          {
            id: 'q1',
            question: 'A buyer sends a payment request/QR and says "Enter your PIN to receive PKR 15,000". What actually happens if you enter your PIN?',
            questionUr: 'خریدار کہے کہ رقم وصول کرنے کے لیے اپنا پن درج کریں تو حقیقت میں کیا ہوگا؟',
            options: [
              'PKR 15,000 is deducted from YOUR wallet',
              'PKR 15,000 is added to your wallet',
              'Nothing happens',
            ],
            optionsUr: [
              '15,000 روپے آپ کے اپنے اکاؤنٹ سے کٹ جائیں گے',
              'آپ کے اکاؤنٹ میں پیسے آ جائیں گے',
              'کچھ نہیں ہوگا',
            ],
            correctIndex: 0,
            explanation: 'PIN entry only authorizes outgoing payments.',
            explanationUr: 'پن صرف رقم بھیجنے کی اجازت دیتا ہے۔',
          },
          {
            id: 'q2',
            question: 'Before handing over an item sold online, how should you confirm a bank/wallet transfer?',
            questionUr: 'آن لائن فروخت کی گئی چیز دینے سے پہلے ادائیگی کی تصدیق کیسے کریں؟',
            options: [
              'Trust the buyer’s WhatsApp screenshot',
              'Verify the updated balance directly inside your own banking or wallet app',
              'Ask the buyer to promise verbally',
            ],
            optionsUr: [
              'خریدار کے واٹس ایپ اسکرین شاٹ پر یقین کر لیں',
              'اپنی بینک یا والٹ ایپ کھول کر خود بیلنس چیک کریں',
              'زبانی وعدے پر بھروسہ کریں',
            ],
            correctIndex: 1,
            explanation: 'Fake receipt generators can forge transfer screenshots in seconds.',
            explanationUr: 'جعلی رسید بنانے والی ایپس سے اسکرین شاٹ آسانی سے تبدیل کیا جا سکتا ہے۔',
          },
        ],
      },
    },
    {
      slug: 'fake-websites',
      title: 'Fake Websites & Spoofed URLs',
      titleUr: 'جعلی ویب سائٹس کی پہچان',
      summary: 'Inspect domain structure, HTTPS locks, and typosquatting before trusting a webpage.',
      summaryUr: 'ویب ایڈریس، ہجے کی غلطیوں اور جعلی پورٹلز کو پہچاننے کا عملی طریقہ سیکھیں۔',
      content: {
        explanation:
          'Spoofed websites copy official logos and colors but sit on deceptive domains like "gov-pk-portal.invalid" or use letter swaps ("rn" for "m", "1" for "l").',
        explanationUr:
          'جعلی ویب سائٹس اصل لوگو اور ڈیزائن کی نقل کرتی ہیں لیکن ان کا ویب ایڈریس (URL) مختلف یا ملتا جلتا ہوتا ہے۔',
        exampleTitle: 'Typosquatting URL Pattern',
        exampleMessage: 'https://easypa1sa-support-center.invalid/login',
        exampleMessageUr: 'https://easypa1sa-support-center.invalid/login',
        warningSigns: [
          'Character substitutions ("1" instead of "i", "0" instead of "o").',
          'Real brand name placed as a subdomain before an unrelated root domain.',
          'HTTPS padlock alone does NOT guarantee a site is legitimate—scam sites use free SSL certificates too.',
        ],
        warningSignsUr: [
          'حروف کی تبدیلی (جیسے i کی جگہ 1 یا o کی جگہ 0)۔',
          'اصل نام کو سب ڈومین بنا کر مشکوک ویب سائٹ سے جوڑنا۔',
          'صرف HTTPS تالے کا ہونا سائٹ کے اصل ہونے کی ضمانت نہیں ہے۔',
        ],
        safetyTips: [
          'Read the root domain right before the first single "/" carefully.',
          'Bookmark banking, university, and government portals you visit regularly.',
        ],
        safetyTipsUr: [
          'ویب ایڈریس میں اصل ڈومین کا نام غور سے پڑھیں۔',
          'اپنے بینک اور اہم پورٹلز کو بک مارک کر کے استعمال کریں۔',
        ],
        quiz: [
          {
            id: 'q1',
            question: 'Does seeing an HTTPS padlock icon guarantee that a website is not a scam?',
            questionUr: 'کیا HTTPS تالے کا نشان اس بات کی ضمانت ہے کہ ویب سائٹ جعلی نہیں؟',
            options: [
              'Yes, scam sites cannot get HTTPS',
              'No—HTTPS only encrypts traffic; phishing sites also use HTTPS',
              'Yes, HTTPS means government verified',
            ],
            optionsUr: [
              'جی ہاں، جعلی سائٹس پر HTTPS نہیں ہوتا',
              'نہیں، HTTPS صرف کنکشن خفیہ رکھتا ہے؛ جعلی سائٹس پر بھی یہ تالا ہو سکتا ہے',
              'جی ہاں، اس کا مطلب سرکاری تصدیق ہے',
            ],
            correctIndex: 1,
            explanation: 'Phishing sites routinely obtain free HTTPS certificates; always verify the domain name itself.',
            explanationUr: 'جعلی ویب سائٹس بھی مفت HTTPS سرٹیفکیٹ حاصل کر لیتی ہیں، اس لیے ڈومین نام ضرور چیک کریں۔',
          },
          {
            id: 'q2',
            question: 'In "https://meezanbank.support-check.invalid/login", which is the real controlling domain?',
            questionUr: '"https://meezanbank.support-check.invalid/login" میں اصل کنٹرول کس ڈومین کے پاس ہے؟',
            options: [
              'meezanbank',
              'support-check.invalid',
              'login',
            ],
            optionsUr: [
              'meezanbank',
              'support-check.invalid',
              'login',
            ],
            correctIndex: 1,
            explanation: 'Everything to the left of the main root domain is just a subdomain controlled by the owner of support-check.invalid.',
            explanationUr: 'بنیادی ڈومین سے پہلے والا حصہ صرف سب ڈومین ہوتا ہے جسے اصل ڈومین کا مالک کنٹرول کرتا ہے۔',
          },
        ],
      },
    },
  ];

  modules.forEach((m, idx) => {
    insertModule.run(
      m.slug,
      m.title,
      m.titleUr,
      m.summary,
      m.summaryUr,
      JSON.stringify(m.content),
      15,
      idx + 1
    );
  });
}

function seedSampleLeaderboard(): void {
  const insertEntry = db.prepare(`
    INSERT INTO sample_leaderboard_entries (display_name, level, total_points, completed_challenges)
    VALUES (?, ?, ?, ?)
  `);

  const entries = [
    ['Zainab K.', 4, 245, 14],
    ['Hamza R.', 3, 195, 11],
    ['Sana M.', 3, 165, 9],
    ['Bilal T.', 2, 130, 7],
    ['Ayesha N.', 2, 105, 6],
    ['Usman F.', 1, 70, 4],
  ];

  for (const e of entries) {
    insertEntry.run(...e);
  }
}
