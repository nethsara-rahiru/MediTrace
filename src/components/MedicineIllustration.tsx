import { StyleSheet, Text, View } from "react-native";
import { Activity, Plus } from "lucide-react-native";
export function MedicineIllustration() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={s.scene}
    >
      <View style={s.orbit} />
      <View style={s.orbit2} />
      <View style={s.pack}>
        <View style={s.packStripe} />
        <View style={s.packContent}>
          <Activity size={25} color="#087F78" />
          <View style={s.line} />
          <View style={[s.line, { width: 52, opacity: 0.4 }]} />
          <View style={s.packLabel}>
            <Text style={s.label}>MEDICINE</Text>
            <Text style={s.labelSub}>Your everyday essentials</Text>
          </View>
          <View style={s.barcode}>
            {Array.from({ length: 19 }, (_, i) => (
              <View
                key={i}
                style={{
                  width: i % 3 === 0 ? 3 : 1,
                  height: 23,
                  backgroundColor: "#41756F",
                  marginRight: 2,
                }}
              />
            ))}
          </View>
        </View>
      </View>
      <View style={s.bottle}>
        <View style={s.cap} />
        <View style={s.bottleBody}>
          <View style={s.bottleLabel}>
            <Plus size={23} color="#087F78" strokeWidth={3} />
            <View style={[s.line, { width: 28, height: 3 }]} />
          </View>
        </View>
      </View>
      <View style={s.pill}>
        <View style={s.pillHalf} />
      </View>
      <View style={s.spark}>
        <Plus size={17} color="#65A99A" />
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  scene: { width: 290, height: 240, position: "relative" },
  orbit: {
    position: "absolute",
    width: 210,
    height: 210,
    borderRadius: 110,
    backgroundColor: "#D8ECE5",
    top: 10,
    left: 50,
  },
  orbit2: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 140,
    borderWidth: 1,
    borderColor: "#D8EAE3",
    top: -15,
    left: 25,
  },
  pack: {
    position: "absolute",
    left: 52,
    top: 25,
    width: 122,
    height: 167,
    backgroundColor: "#FAFFFC",
    borderRadius: 8,
    transform: [{ rotate: "-12deg" }],
    shadowColor: "#1B675D",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 6, height: 10 },
    elevation: 4,
    overflow: "hidden",
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#C6DFD7",
  },
  packStripe: { width: 14, backgroundColor: "#249286" },
  packContent: { padding: 13, gap: 8 },
  line: { width: 61, height: 4, borderRadius: 3, backgroundColor: "#92B5AB" },
  packLabel: { gap: 3, marginTop: 5 },
  label: { fontSize: 9, letterSpacing: 1, color: "#37675E", fontWeight: "800" },
  labelSub: { fontSize: 5, color: "#6B9287" },
  barcode: { flexDirection: "row", marginTop: 8 },
  bottle: {
    position: "absolute",
    left: 158,
    top: 87,
    transform: [{ rotate: "9deg" }],
    alignItems: "center",
  },
  cap: {
    width: 63,
    height: 23,
    borderRadius: 6,
    backgroundColor: "#2D8F83",
    borderWidth: 2,
    borderColor: "#217B70",
  },
  bottleBody: {
    width: 73,
    height: 101,
    backgroundColor: "#FAFFFC",
    borderRadius: 15,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderWidth: 1,
    borderColor: "#C5DDD5",
    alignItems: "center",
    justifyContent: "center",
  },
  bottleLabel: {
    height: 62,
    width: 70,
    backgroundColor: "#DDEFE7",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pill: {
    position: "absolute",
    left: 90,
    top: 199,
    width: 48,
    height: 19,
    borderRadius: 20,
    backgroundColor: "#FBFEFC",
    transform: [{ rotate: "-22deg" }],
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#C4DCD2",
  },
  pillHalf: { width: 24, height: 19, backgroundColor: "#3FA393" },
  spark: { position: "absolute", right: 22, top: 42 },
});
