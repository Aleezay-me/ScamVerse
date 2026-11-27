export type UserRole = 'user' | 'admin';

export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  displayName: string;
  role: UserRole;
  isDemo: boolean;
  avatarUrl: string | null;
  level: number;
  totalPoints: number;
  streakDays: number;
  preferredLanguage: 'en' | 'ur';
  bio: string;
}

export type MissionMode = 'fake_inbox' | 'digital_detective' | 'timed_challenge' | 'consequence';

export interface FakeInboxPayload {
  channel: 'WhatsApp' | 'SMS' | 'Email';
  senderName: string;
  senderAddress: string;
  timestamp: string;
  subject?: string;
  body: string;
  fictionalLink?: string;
  isScam: boolean;
  suspiciousPhrases: string[];
  redFlags: string[];
  safeResponse: string;
  explanation: string;
}

export interface DetectiveClue {
  id: string;
  label: string;
  excerpt: string;
  isRedFlag: boolean;
  explanation: string;
}

export interface DigitalDetectivePayload {
  caseCode: string;
  channelLabel: string;
  previewTitle: string;
  previewUrlOrHandle: string;
  previewSubtitle: string;
  previewBody: string;
  previewCtaText: string;
  previewFooterNote: string;
  clues: DetectiveClue[];
  summaryExplanation: string;
  safetyRecommendations: string[];
}

export interface TimedChallengePayload {
  channel: 'SMS' | 'WhatsApp' | 'Email' | 'Call' | 'Web';
  sender: string;
  prompt: string;
  isScam: boolean;
  quickTip: string;
}

export interface ConsequenceOption {
  id: string;
  label: string;
  outcomeTitle: string;
  outcomeType: 'safe' | 'risky' | 'compromised';
  narrative: string;
  pointsDelta: number;
  lesson: string;
  nextStep?: string;
}

export interface ConsequencePayload {
  situation: string;
  senderContext: string;
  messagePreview: string;
  options: ConsequenceOption[];
  safestOptionId: string;
  debrief: string;
}

export interface ScenarioItem<T = unknown> {
  id: number;
  missionId: number;
  mode: MissionMode;
  title: string;
  category: string;
  regionTag: string;
  payload: T;
  completed?: boolean;
  wasCorrect?: boolean | null;
}

export interface AchievementItem {
  id: number;
  slug: string;
  name: string;
  description: string;
  criteriaType: string;
  criteriaThreshold: number;
  iconKey: string;
  earned: boolean;
  awardedAt: string | null;
}

export interface LearningQuizQuestion {
  id: string;
  question: string;
  questionUr: string;
  options: string[];
  optionsUr: string[];
  correctIndex: number;
  explanation: string;
  explanationUr: string;
}

export interface LearningModuleItem {
  id: number;
  slug: string;
  title: string;
  titleUr: string;
  summary: string;
  summaryUr: string;
  pointsReward: number;
  completed: boolean;
  quizScore: number | null;
  content: {
    explanation: string;
    explanationUr: string;
    exampleTitle: string;
    exampleMessage: string;
    exampleMessageUr: string;
    warningSigns: string[];
    warningSignsUr: string[];
    safetyTips: string[];
    safetyTipsUr: string[];
    quiz: LearningQuizQuestion[];
  };
}

export interface NumberGuardSummary {
  normalizedPhone: string;
  displayPhone: string;
  totalReports: number;
  status: 'no_reports' | 'community_reports_submitted' | 'under_review' | 'moderated_report';
  statusLabel: string;
  mostRecentReportDate: string | null;
  categories: Array<{ slug: string; label: string; count: number }>;
  reports: Array<{
    id: number;
    referenceCode: string;
    categorySlug: string;
    categoryLabel: string;
    description: string;
    incidentDate: string;
    moderationStatus: string;
    flagCount: number;
    isSample: boolean;
    createdAt: string;
  }>;
  recommendations: string[];
  disclaimer: string;
}

export interface DashboardData {
  profile: AuthUser;
  stats: {
    totalPoints: number;
    level: number;
    nextLevelPoints: number;
    completedMissions: number;
    totalAvailableScenarios: number;
    accuracyPercent: number;
    streakDays: number;
    completedModules: number;
    totalModules: number;
  };
  weeklyProgress: Array<{
    date: string;
    label: string;
    points: number;
    missions: number;
  }>;
  badges: AchievementItem[];
  recentActivity: Array<{
    id: string;
    title: string;
    modeLabel: string;
    points: number;
    isCorrect: boolean;
    createdAt: string;
  }>;
  dailyTip: {
    title: string;
    body: string;
    category: string;
  };
}

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  level: number;
  totalPoints: number;
  completedChallenges: number;
  isCurrentUser: boolean;
  isSample: boolean;
}

export interface CoachMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  sourceMode: 'live_gemini' | 'educational_fallback' | 'user';
  createdAt: string;
}
