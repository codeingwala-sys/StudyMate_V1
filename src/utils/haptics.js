// Haptic feedback utility — uses Vibration API where available
// Silently no-ops on devices without haptics

export const haptic = {
  light:   () => navigator.vibrate?.(10),
  medium:  () => navigator.vibrate?.(25),
  heavy:   () => navigator.vibrate?.(50),
  success: () => navigator.vibrate?.([10, 30, 10]),
  error:   () => navigator.vibrate?.([50, 30, 50]),
  select:  () => navigator.vibrate?.(8),
}