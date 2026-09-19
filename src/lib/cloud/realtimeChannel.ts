/**
 * The Supabase half of live editing: a `LiveChannel` backed by a Realtime channel.
 *
 * Everything that decides anything lives in `liveSession.ts` and `liveRoom.ts`. This file only
 * carries messages, which is why it is the one part of the feature with no tests — there is
 * nothing here to assert about that would not be asserting about Supabase's client.
 *
 * Broadcast, not Postgres changes: a keystroke is not worth a row. Messages go between the
 * browsers that are connected right now and are never stored, so the database holds saved
 * workbooks and nothing else. Presence rides on the same channel and is what the "who else is
 * here" strip reads.
 */
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getCloudClient } from "./client";
import { LiveChannel } from "./liveRoom";
import { ClientId, LiveMessage, Participant, parseLiveMessage } from "./liveSession";

const EVENT = "live";

/**
 * One channel per workbook row. The id is already a uuid, so it needs nothing added to it.
 *
 * The shape is not cosmetic: `0002_sharing_and_realtime.sql` splits this string on `:` to find out
 * which workbook a subscriber is asking for, and refuses them if it is not theirs. Change the
 * format here and the policy silently stops matching — which fails open on the read side, since a
 * topic the policy cannot parse is a topic nobody may join, and fails *confusingly* everywhere
 * else. `realtimeChannel.test.ts` reads the SQL and pins the two together.
 */
export const CHANNEL_PREFIX = "workbook:";
export const channelName = (workbookId: string) => `${CHANNEL_PREFIX}${workbookId}`;

/**
 * Presence state as Supabase hands it back: a map of key → the states tracked under that key.
 *
 * Checked rather than cast. It is other people's browsers filling this in, and a participant with
 * a `row` of `"drop table"` would otherwise reach a React key and an array index.
 */
export function readPresence(state: Record<string, unknown[]>): Participant[] {
  const people: Participant[] = [];
  for (const entries of Object.values(state)) {
    const latest = entries?.[entries.length - 1];
    // Presence carries a `Participant`, whose id field is `id`; the validator speaks messages,
    // whose sender field is `from`. Bridged here rather than by loosening the validator.
    const state = (latest ?? {}) as Partial<Participant>;
    const parsed = parseLiveMessage({ ...state, kind: "cursor", from: state.id, at: 0 });
    if (parsed?.kind === "cursor") {
      people.push({ id: parsed.from, name: parsed.name, tabId: parsed.tabId, row: parsed.row, col: parsed.col });
    }
  }
  return people;
}

export interface RealtimeChannelOptions {
  workbookId: string;
  self: ClientId;
  /** Called once the channel is live, or with the reason it is not. */
  onStatus?: (status: "joined" | "failed") => void;
}

export async function openRealtimeChannel({
  workbookId,
  self,
  onStatus,
}: RealtimeChannelOptions): Promise<LiveChannel> {
  const supabase = await getCloudClient();
  // A private topic, which is the whole difference between "hard to guess" and "authorised". A
  // public topic is joinable by anyone holding the anon key — and the anon key is in the
  // JavaScript, for everyone. Marked private, Realtime asks the database whether this signed-in
  // person may read this workbook before it lets them hear a single keystroke.
  const channel: RealtimeChannel = supabase.channel(channelName(workbookId), {
    config: { private: true, presence: { key: self } },
  });
  // Realtime needs the access token to evaluate those policies. Without this call the subscription
  // is refused, which is the correct direction to fail in, but only if it is not forgotten.
  await supabase.realtime.setAuth();

  let messageHandler: (m: LiveMessage) => void = () => {};
  let presenceHandler: (p: Participant[]) => void = () => {};
  let joined = false;

  channel.on("broadcast", { event: EVENT }, ({ payload }) => {
    // Anyone holding the anon key can join this channel, so what arrives on it is input, not data.
    const message = parseLiveMessage(payload);
    if (message) messageHandler(message);
  });
  channel.on("presence", { event: "sync" }, () => {
    presenceHandler(readPresence(channel.presenceState() as unknown as Record<string, unknown[]>));
  });

  channel.subscribe((status) => {
    joined = status === "SUBSCRIBED";
    if (joined) onStatus?.("joined");
    else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") onStatus?.("failed");
  });

  return {
    send(message) {
      // Dropped rather than queued when the channel is not up: a keystroke replayed a minute late
      // is worse than one that never arrived, because by then it is overwriting newer work.
      if (!joined) return;
      void channel.send({ type: "broadcast", event: EVENT, payload: message });
    },
    onMessage(handler) {
      messageHandler = handler;
    },
    onPresence(handler) {
      presenceHandler = handler;
    },
    track(state) {
      if (joined) void channel.track(state);
    },
    close() {
      joined = false;
      void supabase.removeChannel(channel);
    },
  };
}
