import admin from "firebase-admin";
import { CONFIG } from "./config";

let app: admin.app.App | null = null;

/** Singleton Admin SDK app. On App Hosting, ADC comes from the runtime service account. */
export function getAdmin(): admin.app.App {
  if (!app) {
    app = admin.initializeApp({ projectId: CONFIG.projectId });
  }
  return app;
}

export function db(): admin.firestore.Firestore {
  return getAdmin().firestore();
}

// Collection names (ar_ prefix avoids collisions in the shared project DB)
export const C = {
  rooms: "ar_rooms",
  agents: "ar_agents",
  credentials: "ar_credentials",
  runs: "ar_runs",
  turns: "ar_turns",
  tasks: "ar_tasks",
  messages: "ar_messages",
  briefs: "ar_briefs",
  decisions: "ar_decisions",
  events: "ar_events",
  idem: "ar_idem",
} as const;
