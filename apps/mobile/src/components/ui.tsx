import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewProps,
} from "react-native";
import { colors, radius, spacing, font, shadow } from "../theme";

export function Card({ style, children, ...rest }: ViewProps) {
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing.xl,
          ...shadow,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  loading?: boolean;
  disabled?: boolean;
}) {
  const isPrimary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => ({
        backgroundColor: isPrimary
          ? pressed
            ? colors.primaryPress
            : colors.primary
          : "transparent",
        borderRadius: radius.button,
        borderWidth: isPrimary ? 0 : 1,
        borderColor: colors.primary,
        paddingVertical: spacing.md + 2,
        paddingHorizontal: spacing.xl,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.5 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.onPrimary : colors.primary} />
      ) : (
        <Text
          style={{
            color: isPrimary ? colors.onPrimary : colors.primary,
            fontSize: font.body,
            fontWeight: "600",
          }}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Field({ label, ...rest }: { label: string } & TextInputProps) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ color: colors.textMuted, fontSize: font.small, fontWeight: "600" }}>
        {label}
      </Text>
      <TextInput
        {...rest}
        placeholderTextColor={colors.textMuted}
        style={[
          {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.button,
            padding: spacing.md,
            fontSize: font.body,
            color: colors.text,
          },
          rest.style,
        ]}
      />
    </View>
  );
}

export function Pill({ label }: { label: string }) {
  return (
    <View
      style={{
        backgroundColor: colors.surfaceAlt,
        borderRadius: radius.pill,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ color: colors.textMuted, fontSize: font.tiny, fontWeight: "600" }}>
        {label}
      </Text>
    </View>
  );
}

export function Screen({ children, style, ...rest }: ViewProps) {
  return (
    <View
      {...rest}
      style={[{ flex: 1, backgroundColor: colors.bg, padding: spacing.xl }, style]}
    >
      {children}
    </View>
  );
}
