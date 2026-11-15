import { PrivatePhoto } from "./private-photo";
import { useState } from "react";
import { Alert, Linking, Text, View } from "react-native";
import type { Entry, SpaceSnapshot } from "../domain";
import { api, patch, post } from "../lib/api";
import { useSpaceMutation } from "../lib/mutations";
import { Button, ErrorText, Field } from "./ui";
import { styles } from "../theme";
import { API_URL } from "../lib/config";
export function EntryCard({ entry, data }: { entry: Entry; data: SpaceSnapshot }) {
  const [reply, setReply] = useState("");
  const [expanded, setExpanded] = useState(false);
  const action = useSpaceMutation(data.me.id, async ({ kind }: { kind: "react" | "pin" | "reply" | "delete" }) => {
    const path = `/api/entries/${entry.id}`;
    if (kind === "react") return post(`${path}/reaction`);
    if (kind === "pin") return patch(path, { pinned: !entry.pinned });
    if (kind === "delete") return api(path, { method: "DELETE" });
    const result = await post(`${path}/replies`, { body: reply.trim() }); setReply(""); return result;
  });
  const name = data.members.find((member) => member.id === entry.authorId)?.name || "Partner";
  if (entry.locked) return <View style={styles.card}><Text style={styles.heading}>A note for later</Text><Text style={styles.muted}>Opens {new Date(entry.revealAt!).toLocaleString()}</Text></View>;
  return <View style={styles.card}><View style={[styles.row, { justifyContent: "space-between" }]}><Text style={styles.label}>{name}</Text><Text style={styles.muted}>{new Date(entry.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</Text></View>
    {!!entry.title && <Text style={styles.heading}>{entry.title}</Text>}
    {entry.kind === "photo" && entry.mediaId && <PrivatePhoto mediaId={entry.mediaId} description={entry.body || entry.title}/>}
    {!!entry.body && <Text selectable style={styles.text}>{entry.body}</Text>}
    {entry.url && <Button secondary onPress={() => { if (/^https?:\/\//i.test(entry.url!)) void Linking.openURL(entry.url!); }}>Open link</Button>}
    {["voice", "drawing"].includes(entry.kind) && <Button secondary onPress={() => void Linking.openURL(`${API_URL}/journal`)}>Open {entry.kind === "voice" ? "recording" : "drawing"} on the website</Button>}
    <View style={styles.wrap}><Button secondary busy={action.isPending} onPress={() => action.mutate({ kind: "react" })}>{entry.reactions.includes(data.me.id) ? "Loved" : "Love"}{entry.reactions.length ? ` · ${entry.reactions.length}` : ""}</Button><Button secondary disabled={action.isPending} onPress={() => action.mutate({ kind: "pin" })}>{entry.pinned ? "Unpin" : "Pin"}</Button><Button secondary onPress={() => setExpanded(!expanded)}>Replies{entry.replies.length ? ` · ${entry.replies.length}` : ""}</Button></View>
    {expanded && <View style={styles.stack}>{entry.replies.map((item) => <View key={item.id} style={styles.stack}><Text style={styles.label}>{data.members.find((member) => member.id === item.authorId)?.name || "Partner"}</Text><Text style={styles.text}>{item.body}</Text></View>)}<Field label="Your reply" value={reply} onChangeText={setReply} maxLength={2000} multiline/><Button busy={action.isPending} disabled={!reply.trim()} onPress={() => action.mutate({ kind: "reply" })}>Reply</Button>{entry.authorId === data.me.id && <Button secondary disabled={action.isPending} onPress={() => Alert.alert("Delete this entry?", "This also removes its replies.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => action.mutate({ kind: "delete" }) }])}>Delete entry</Button>}</View>}
    <ErrorText error={action.error}/>
  </View>;
}
