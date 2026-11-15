import { useState } from "react";
import { Share, Text, View } from "react-native";
import { Button, ErrorText } from "./ui";
import { post } from "../lib/api";
import { styles } from "../theme";
export function Invitation() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  async function invite() {
    setBusy(true); setError(undefined);
    try { const next = code || (await post<{ token: string }>("/api/invites")).token; setCode(next); await Share.share({ message: `Join my TwoSpace with this invitation code: ${next}` }); }
    catch (cause) { setError(cause); } finally { setBusy(false); }
  }
  return <View style={styles.card}><Text style={styles.heading}>Invite your partner</Text>{code ? <Text selectable style={styles.text}>{code}</Text> : <Text style={styles.muted}>Share a code to bring them into this space.</Text>}<Button secondary busy={busy} onPress={() => void invite()}>{code ? "Share code" : "Create invitation"}</Button><ErrorText error={error}/></View>;
}
