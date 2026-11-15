import { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import { Button } from "./ui";
import { auth } from "../lib/auth";
import { API_URL } from "../lib/config";
import { styles } from "../theme";
export function PrivatePhoto({
  mediaId,
  description,
}: {
  mediaId: string;
  description: string;
}) {
  const [cookie, setCookie] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    setFailed(false);
    void Promise.resolve(auth.getCookie()).then((value) => {
      if (live) setCookie(value || "");
    });
    return () => {
      live = false;
    };
  }, [mediaId, attempt]);
  if (failed)
    return (
      <View style={styles.stack}>
        <Text style={styles.muted}>This photo couldn’t load.</Text>
        <Button secondary onPress={() => setAttempt((value) => value + 1)}>
          Retry photo
        </Button>
      </View>
    );
  if (!cookie) return <View style={{ height: 220 }} />;
  return (
    <Image
      key={attempt}
      accessibilityLabel={description || "Shared photo"}
      accessibilityIgnoresInvertColors
      source={{
        uri: `${API_URL}/api/media/${encodeURIComponent(mediaId)}`,
        headers: { Cookie: cookie },
        cache: "reload",
      }}
      style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: 16 }}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}
