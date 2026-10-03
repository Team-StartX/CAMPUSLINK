'use client';
import { AuthCharacter, type AuthCharacterProps } from './auth-character';
import { useAuthDesktop } from '@/hooks/use-auth-desktop';
export function AuthBrandPanel(props: AuthCharacterProps) {
  const desktop = useAuthDesktop();
  if (!desktop) return null;
  return (
    <aside
      className="auth-illustration auth-character-panel"
      aria-label="Animated student character"
    >
      <AuthCharacter {...props} />
    </aside>
  );
}
