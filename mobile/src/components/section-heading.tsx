import { Image, Text, View } from "react-native";
import { styles } from "../theme";
export function SectionHeading({ title, image }: { title: string; image?: number }) {
  return <View style={[styles.row, { justifyContent: "space-between", marginTop: 8 }]}><Text accessibilityRole="header" style={styles.title}>{title}</Text>{image !== undefined && <Image source={image} style={{ width: 62, height: 62 }} accessibilityIgnoresInvertColors/>}</View>;
}
