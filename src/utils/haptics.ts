// Tactile Haptic Vibration Engine for Mobile & Touch devices

export type HapticType = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning';

export function triggerHaptic(type: HapticType = 'light'): void {
  if (typeof window === 'undefined' || !('vibrate' in navigator)) return;

  try {
    switch (type) {
      case 'selection':
        navigator.vibrate(8);
        break;
      case 'light':
        navigator.vibrate(12);
        break;
      case 'medium':
        navigator.vibrate(22);
        break;
      case 'heavy':
        navigator.vibrate(35);
        break;
      case 'success':
        navigator.vibrate([15, 45, 20]);
        break;
      case 'warning':
        navigator.vibrate([25, 60, 25]);
        break;
      default:
        navigator.vibrate(10);
    }
  } catch {
    // Ignore devices that don't allow or support vibration
  }
}
