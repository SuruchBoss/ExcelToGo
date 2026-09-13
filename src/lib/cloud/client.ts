/**
 * The Supabase client, and every call the app makes through it.
 *
 * Imported dynamically rather than at the top of the file: the library is well over a hundred
 * kilobytes, and a deployment with no cloud configured — the default, and the public demo — should
 * not make every visitor download a client for a database that isn't there. `import()` puts it in
 * its own chunk that is fetched the first time someone opens the cloud panel and never otherwise.
 *
 * The browser talks to *your* Supabase directly, with the anon key and row-level security. Nothing
 * is proxied through this app's server, so a self-hosted deployment keeps its users' spreadsheets
 * inside its own project rather than passing them through anyone else's.
 */
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { CLOUD_ANON_KEY, CLOUD_URL, isCloudConfigured } from "./config";
import { CloudWorkbookRow, CloudWorkbookSummary, toSummary, workbookPayload } from "./workbook";
import { SheetTab } from "@/store/sheetStore";

export const WORKBOOKS_TABLE = "workbooks";

let clientPromise: Promise<SupabaseClient> | null = null;

export function getCloudClient(): Promise<SupabaseClient> {
  if (!isCloudConfigured()) {
    return Promise.reject(new Error("cloud is not configured"));
  }
  clientPromise ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(CLOUD_URL, CLOUD_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // The magic link comes back as a fragment on the URL; letting the client consume it is what
        // turns the click in the email into a signed-in session.
        detectSessionInUrl: true,
      },
    })
  );
  return clientPromise;
}

export async function currentSession(): Promise<Session | null> {
  const supabase = await getCloudClient();
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function onSessionChange(handler: (session: Session | null) => void): Promise<() => void> {
  const supabase = await getCloudClient();
  const { data } = supabase.auth.onAuthStateChange((_event, session) => handler(session));
  return () => data.subscription.unsubscribe();
}

/**
 * Sends a sign-in link.
 *
 * A magic link rather than a password: this app would otherwise be storing and checking one more
 * credential, and the whole point of leaning on Supabase Auth is not to.
 */
export async function sendSignInLink(email: string): Promise<void> {
  const supabase = await getCloudClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: typeof window === "undefined" ? undefined : window.location.href },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const supabase = await getCloudClient();
  await supabase.auth.signOut();
}

export async function listWorkbooks(): Promise<CloudWorkbookSummary[]> {
  const supabase = await getCloudClient();
  // No user_id filter: row-level security already limits this to the caller's own rows, and a
  // filter here would read as if it were the thing enforcing that.
  const { data, error } = await supabase
    .from(WORKBOOKS_TABLE)
    .select("id,name,updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toSummary);
}

export async function fetchWorkbook(id: string): Promise<CloudWorkbookRow> {
  const supabase = await getCloudClient();
  const { data, error } = await supabase.from(WORKBOOKS_TABLE).select("id,name,updated_at,data").eq("id", id).single();
  if (error) throw error;
  return data as CloudWorkbookRow;
}

/** The server's current timestamp for a row, used to notice an edit from another device. */
export async function fetchUpdatedAt(id: string): Promise<string | null> {
  const supabase = await getCloudClient();
  const { data, error } = await supabase.from(WORKBOOKS_TABLE).select("updated_at").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as { updated_at: string } | null)?.updated_at ?? null;
}

export async function insertWorkbook(name: string, sheets: SheetTab[]): Promise<CloudWorkbookSummary> {
  const supabase = await getCloudClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("not signed in");
  // user_id is set here because the column is NOT NULL; the policy checks it matches the caller,
  // so a client that lied about it would simply be refused.
  const { data, error } = await supabase
    .from(WORKBOOKS_TABLE)
    .insert({ name, user_id: userId, data: workbookPayload(sheets) })
    .select("id,name,updated_at")
    .single();
  if (error) throw error;
  return toSummary(data);
}

export async function updateWorkbook(id: string, name: string, sheets: SheetTab[]): Promise<CloudWorkbookSummary> {
  const supabase = await getCloudClient();
  const { data, error } = await supabase
    .from(WORKBOOKS_TABLE)
    .update({ name, data: workbookPayload(sheets), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id,name,updated_at")
    .single();
  if (error) throw error;
  return toSummary(data);
}

export async function deleteWorkbook(id: string): Promise<void> {
  const supabase = await getCloudClient();
  const { error } = await supabase.from(WORKBOOKS_TABLE).delete().eq("id", id);
  if (error) throw error;
}
