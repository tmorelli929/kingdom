import { weekOf } from "./dates";
import type { LifeDoc } from "./types";

export const uid = () => Math.random().toString(36).slice(2, 10);

export const DEFAULT_CATEGORIES = ["Mentors", "Professional", "Friends", "Family", "Community", "Entrepreneurship", "Other"];

// Thomas's Kingdom Builder Protocol, the starting point for a fresh account.
export function defaultDoc(today: string): LifeDoc {
  const wk = weekOf(today);
  return {
    v: 2,
    name: "Thomas",
    protocol: "Kingdom Builder Protocol",
    scripture: "Seek first the kingdom of God and his righteousness, and all these things will be added to you. (Matthew 6:33)",
    about:
      "22, recent Baylor University graduate, starting my career in sales at Cisco in Raleigh, NC. Married to Juliette. " +
      "Long-term aim: become an excellent leader, potentially the CEO of a major company, while keeping strong faith, character, marriage, health and relationships. " +
      "Currently developing sales skills, learning technical networking concepts, and exploring entrepreneurship. Career ambition must not crowd out everything else.",
    principles: [
      ["Stewardship", "over endless productivity"],
      ["Relationships", "over achievement"],
      ["Service", "over self-centered ambition"],
      ["Character", "over status"],
      ["Purpose", "over pleasure"],
    ],
    areas: [
      { id: "faith", name: "Faith & Character", icon: "faith", color: "#d6b26a", noScore: true,
        vision: "Daily time with God that shapes how I treat people. Known for integrity and for serving others.",
        practices: "Quiet time, Scripture, prayer, serving others, personal reflection" },
      { id: "marriage", name: "Marriage & Relationships", icon: "heart", color: "#e0828f",
        vision: "Juliette feels prioritized and fully known. I invest in a few deep friendships and in family.",
        practices: "Date nights, intentional time with Juliette, friendships, family" },
      { id: "health", name: "Health & Fitness", icon: "pulse", color: "#5cc495",
        vision: "Strong, rested and consistent. I train because my body is a gift to steward.",
        practices: "Workouts, nutrition, cardio, sleep, consistency" },
      { id: "career", name: "Career & Leadership", icon: "case", color: "#6f9cf0",
        vision: "A trusted technical seller and a leader others grow under.",
        practices: "Technical learning, sales development, mentorship, leadership skills" },
      { id: "finance", name: "Financial Stewardship", icon: "coin", color: "#4fb8b0",
        vision: "Spend on purpose, give generously, save and invest with discipline, carry no consumer debt.",
        practices: "Budget, savings goals, debt reduction, investing" },
      { id: "venture", name: "Entrepreneurship", icon: "rocket", color: "#e39a54",
        vision: "Test real business ideas with real customers, one small experiment at a time.",
        practices: "Business experiments, customer interviews, product development" },
      { id: "learning", name: "Learning & Growth", icon: "book", color: "#a98be6",
        vision: "Always reading, building AI skills, and saying yes to new experiences.",
        practices: "Reading, AI skills, personal projects, new experiences" },
    ],
    habits: [
      { id: "h-quiet", name: "Quiet time", areaId: "faith", xp: 10 },
      { id: "h-workout", name: "Workout", areaId: "health", xp: 10 },
      { id: "h-reading", name: "Reading", areaId: "learning", xp: 10 },
      { id: "h-nutrition", name: "Nutrition on plan", areaId: "health", xp: 10 },
      { id: "h-connect", name: "Intentional connection with Juliette", areaId: "marriage", xp: 10 },
    ],
    goals: [
      { id: uid(), week: wk, title: "Workouts", areaId: "health", target: 5, count: 0 },
      { id: uid(), week: wk, title: "Career-development conversations", areaId: "career", target: 2, count: 0 },
      { id: uid(), week: wk, title: "Date night", areaId: "marriage", target: 1, count: 0 },
      { id: uid(), week: wk, title: "Product experiment", areaId: "venture", target: 1, count: 0 },
    ],
    milestones: [
      { id: uid(), areaId: "venture", title: "Interview 10 potential customers", done: false },
      { id: uid(), areaId: "finance", title: "Fully funded emergency fund", done: false },
      { id: uid(), areaId: "faith", title: "Read through the Gospels this year", done: false },
    ],
    days: {
      [today]: {
        intention: "Be fully present with the people around me.",
        priorities: [
          { t: "Spend intentional time with God.", d: false },
          { t: "Be present with Juliette.", d: false },
          { t: "Make meaningful progress on my business idea.", d: false },
        ],
        done: {},
      },
    },
    reflections: {},
    schedule: {},
    startedOn: today,
    networkCategories: [...DEFAULT_CATEGORIES],
    networkGoals: [
      { id: uid(), title: "Meet new professionals", metric: "new_people", target: 2, period: "month", areaId: "career" },
      { id: uid(), title: "Mentor conversation", metric: "mentor_conversations", target: 1, period: "month", areaId: "career" },
      { id: uid(), title: "Reconnect with existing relationships", metric: "reconnects", target: 3, period: "month", areaId: "marriage" },
      { id: uid(), title: "Attend a community event", metric: "events", target: 1, period: "month", areaId: "marriage" },
    ],
    coachAccess: { reflections: true, network: true, profile: true, calendar: true },
  };
}
