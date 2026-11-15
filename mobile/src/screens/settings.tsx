import { useState } from "react";
import { Alert, Linking, Text, View } from "react-native";
import { SectionHeading } from "../components/section-heading";
import { Button, ErrorText, Field, Screen } from "../components/ui";
import { Invitation } from "../components/invitation";
import { JoinPartner } from "../components/partner-setup";
import { api, patch } from "../lib/api";
import { API_URL } from "../lib/config";
import { signOut } from "../lib/sign-out";
import { refreshAccount } from "../lib/queries";
import { useSpaceMutation } from "../lib/mutations";
import type { SpaceScreenProps } from "./journal";
import { styles } from "../theme";
export function SettingsScreen({
  data,
  refresh,
  refreshing,
}: SpaceScreenProps) {
  const [name, setName] = useState(data.me.name);
  const [timeZone, setTimeZone] = useState(data.me.timeZone);
  const [spaceName, setSpaceName] = useState(data.space.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [notice, setNotice] = useState("");
  const profile = useSpaceMutation(data.me.id, async () => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: timeZone.trim() });
    } catch {
      throw new Error("Choose a valid time zone, such as America/Chicago.");
    }
    await patch("/api/profile", {
      name: name.trim(),
      timeZone: timeZone.trim(),
    });
    setNotice("Profile saved.");
  });
  const space = useSpaceMutation(data.me.id, async () => {
    await patch("/api/space", { name: spaceName.trim() });
    setNotice("Space name saved.");
  });
  async function logout() {
    setBusy(true);
    setError(undefined);
    try {
      const revoked = await signOut();
      if (!revoked)
        Alert.alert(
          "Signed out on this iPhone",
          "The server couldn’t be reached to end its session. This iPhone’s saved sign-in was removed.",
        );
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }
  async function leave() {
    setBusy(true);
    setError(undefined);
    try {
      await api("/api/space/membership", { method: "DELETE" });
      await refreshAccount();
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen refresh={refresh} refreshing={refreshing}>
      <SectionHeading title="Settings" />
      <View style={styles.card}>
        <Text style={styles.heading}>Your profile</Text>
        <Field
          editable={!profile.isPending}
          label="Name"
          value={name}
          onChangeText={setName}
          maxLength={60}
        />
        <Field
          editable={!profile.isPending}
          label="Time zone"
          value={timeZone}
          onChangeText={setTimeZone}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={100}
        />
        <Button
          secondary
          disabled={profile.isPending}
          onPress={() =>
            setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
          }
        >
          Use this iPhone’s time zone
        </Button>
        <Button
          busy={profile.isPending}
          disabled={!name.trim() || !timeZone.trim()}
          onPress={() => {
            setNotice("");
            profile.mutate();
          }}
        >
          Save profile
        </Button>
        <ErrorText error={profile.error} />
      </View>
      <View style={styles.card}>
        <Text style={styles.heading}>Your space</Text>
        <Field
          editable={!space.isPending}
          label="Space name"
          value={spaceName}
          onChangeText={setSpaceName}
          maxLength={80}
        />
        <Button
          secondary
          busy={space.isPending}
          disabled={!spaceName.trim()}
          onPress={() => {
            setNotice("");
            space.mutate();
          }}
        >
          Save name
        </Button>
        <ErrorText error={space.error} />
      </View>
      {data.members.length === 1 && !data.space.hasPairedBefore && (
        <Invitation />
      )}
      {data.members.length === 1 && <JoinPartner data={data} />}
      {!!notice && (
        <Text accessibilityLiveRegion="polite" style={styles.muted}>
          {notice}
        </Text>
      )}
      <View style={styles.stack}>
        <Button
          secondary
          onPress={() => void Linking.openURL(`${API_URL}/settings`)}
        >
          More settings on the website
        </Button>
        <Button
          secondary
          disabled={busy}
          onPress={() =>
            Alert.alert(
              "Leave this space?",
              "You’ll lose access to this space. Shared features will lock, but your partner can still export the saved content on the website. This does not delete your account.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Leave space",
                  style: "destructive",
                  onPress: () => void leave(),
                },
              ],
            )
          }
        >
          Leave space
        </Button>
        <Button secondary busy={busy} onPress={() => void logout()}>
          Sign out
        </Button>
        <ErrorText error={error} />
      </View>
      <Text style={styles.muted}>TwoSpace for iPhone · Development build</Text>
    </Screen>
  );
}
