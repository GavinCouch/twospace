import { useState } from "react";
import { Text, View } from "react-native";
import type { Account } from "../domain";
import { Button, ErrorText, Field, Screen } from "../components/ui";
import { post } from "../lib/api";
import { signOut } from "../lib/sign-out";
import { refreshAccount } from "../lib/queries";
import { styles } from "../theme";
export function PairingScreen({ account }: { account: Account }) {
  const [name, setName] = useState("Our space");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  async function act(path: string, body: unknown) {
    setBusy(true);
    setError(undefined);
    try {
      await post(path, body);
      await refreshAccount();
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Text style={styles.title}>Hi, {account.name}.</Text>
      <View style={styles.card}>
        <Field
          editable={!busy}
          label="Name your shared space"
          value={name}
          onChangeText={setName}
          maxLength={80}
        />
        <Button
          busy={busy}
          disabled={!name.trim()}
          onPress={() => void act("/api/spaces", { name: name.trim() })}
        >
          Create a space
        </Button>
      </View>
      <Text style={[styles.muted, { textAlign: "center" }]}>
        or join your partner
      </Text>
      <View style={styles.card}>
        <Field
          editable={!busy}
          label="Invitation code"
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={200}
        />
        <Button
          secondary
          busy={busy}
          disabled={!token.trim()}
          onPress={() =>
            void act("/api/invites/accept", { token: token.trim() })
          }
        >
          Join their space
        </Button>
      </View>
      <ErrorText error={error} />
      <Button
        secondary
        disabled={busy}
        onPress={() => {
          setBusy(true);
          void signOut()
            .catch(setError)
            .finally(() => setBusy(false));
        }}
      >
        Sign out
      </Button>
    </Screen>
  );
}
