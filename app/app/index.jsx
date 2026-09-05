import { StatusBar } from 'expo-status-bar'
import { Text, View } from 'react-native'

export default function Today() {
  return (
    <View className="flex-1 items-center justify-center gap-sm bg-background">
      <Text className="text-title2 text-on-background">Dotbook</Text>
      <Text className="text-body text-on-surface-variant">Phase 0 — structure only</Text>
      <StatusBar style="auto" />
    </View>
  )
}
