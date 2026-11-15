import { useState } from "react";
import { Alert, Text, View } from "react-native";
import type { SpaceSnapshot } from "../domain";
import { Button, ErrorText, Field, Screen } from "./ui";
import { Invitation } from "./invitation";
import { post } from "../lib/api";
import { refreshAccount } from "../lib/queries";
import { styles } from "../theme";

export function JoinPartner({ data }: { data: SpaceSnapshot }) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  async function join() {
    setBusy(true);
    setError(undefined);
    try {
      await post("/api/invites/accept", {
        token: token.trim(),
        switchSpace: true,
      });
      await refreshAccount();
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }
  if (!data.space.canSwitch) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Have their code?</Text>
      <Text style={styles.muted}>
        Join their space even if you’ve already made this one.
      </Text>
      <Field
        label="Partner’s invitation code"
        value={token}
        onChangeText={setToken}
        editable={!busy}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={128}
      />
      <Button
        secondary
        busy={busy}
        disabled={!token.trim()}
        onPress={() =>
          Alert.alert(
            "Join your partner’s space?",
            `You’ll leave “${data.space.name}” and join their space.`,
            [
              { text: "Cancel", style: "cancel" },
              { text: "Join their space", onPress: () => void join() },
            ],
          )
        }
      >
        Join their space
      </Button>
      <ErrorText error={error} />
    </View>
  );
}

export function PartnerSetupScreen({
  data,
  onSettings,
  refresh,
  refreshing,
}: {
  data: SpaceSnapshot;
  onSettings: () => void;
  refresh: () => void;
  refreshing: boolean;
}) {
  return (
    <Screen refresh={refresh} refreshing={refreshing}>
      <Text style={styles.muted}>{data.space.name}</Text>
      <Text style={styles.title}>
        {data.space.hasPairedBefore
          ? "Your partner has left this space"
          : "Invite your partner"}
      </Text>
      <Text style={styles.muted}>
        Journal, games, and plans open when you’re both here.
      </Text>
      {data.space.hasPairedBefore ? (
        <Text style={styles.text}>
          Your saved entries are kept here. Export them on the website before
          leaving this space.
        </Text>
      ) : (
        <Invitation />
      )}
      <JoinPartner data={data} />
      {!data.space.canSwitch && !data.space.hasPairedBefore && (
        <Text style={styles.muted}>
          This space has saved content. Export it on the website, then leave
          this space to use your partner’s code.
        </Text>
      )}
      <Button secondary onPress={onSettings}>
        Settings
      </Button>
    </Screen>
  );
}
