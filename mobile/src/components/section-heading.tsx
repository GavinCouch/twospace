import { sectionArtwork } from "../artwork";
import { Image, Text, View } from "react-native";
import { styles } from "../theme";
export function SectionHeading({
  title,
  image,
}: {
  title: string;
  image?: number;
}) {
  const artwork = image ?? sectionArtwork[title as keyof typeof sectionArtwork];
  return (
    <View
      style={[styles.row, { justifyContent: "space-between", marginTop: 8 }]}
    >
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {artwork !== undefined && (
        <Image
          source={artwork}
          style={{ width: 62, height: 62 }}
          accessibilityIgnoresInvertColors
        />
      )}
    </View>
  );
}
