import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { colors, radius, spacing, font } from "../theme";

export interface Option {
  label: string;
  value: string;
}

/**
 * Cross-platform select dropdown (works on web + native). A Pressable shows the
 * current value; tapping opens a Modal sheet with the options. Avoids relying on
 * a native picker so it renders identically in the browser.
 */
export function Select({
  label,
  value,
  options,
  onChange,
  placeholder = "Select",
  flex,
}: {
  label?: string;
  value: string | null;
  options: Option[];
  onChange: (v: string) => void;
  placeholder?: string;
  flex?: number;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={{ gap: spacing.xs, flex }}>
      {label ? (
        <Text style={{ color: colors.textMuted, fontSize: font.small, fontWeight: "600" }}>
          {label}
        </Text>
      ) : null}
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.button,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: font.body, color: selected ? colors.text : colors.textMuted }}>
          {selected ? selected.label : placeholder}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: font.tiny }}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.35)",
            justifyContent: "center",
            padding: spacing.xl,
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.card,
              maxHeight: 360,
              overflow: "hidden",
              maxWidth: 420,
              width: "100%",
              alignSelf: "center",
            }}
          >
            <ScrollView>
              {options.map((o) => (
                <Pressable
                  key={o.value}
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  style={{
                    paddingVertical: spacing.md,
                    paddingHorizontal: spacing.lg,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    backgroundColor: o.value === value ? colors.surfaceAlt : colors.surface,
                  }}
                >
                  <Text
                    style={{
                      fontSize: font.body,
                      color: colors.text,
                      fontWeight: o.value === value ? "700" : "500",
                    }}
                  >
                    {o.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

const MONTH_OPTIONS: Option[] = MONTHS.map((m, i) => ({ label: m, value: pad(i + 1) }));
const DAY_OPTIONS: Option[] = Array.from({ length: 31 }, (_, i) => ({
  label: String(i + 1),
  value: pad(i + 1),
}));

export interface DateParts {
  month: string | null; // "01".."12"
  day: string | null; // "01".."31"
  year: string | null; // "2026"
}

export const EMPTY_DATE: DateParts = { month: null, day: null, year: null };

/** Years from this year back ~18 (content spans 0–12yr; allow some headroom). */
function yearOptions(): Option[] {
  const now = new Date().getFullYear();
  return Array.from({ length: 19 }, (_, i) => {
    const y = String(now - i);
    return { label: y, value: y };
  });
}

/** Returns YYYY-MM-DD if the parts form a real calendar date, else null. */
export function toIsoDate(d: DateParts): string | null {
  if (!d.month || !d.day || !d.year) return null;
  const y = Number(d.year);
  const m = Number(d.month);
  const day = Number(d.day);
  const date = new Date(Date.UTC(y, m - 1, day));
  // Reject overflow (e.g. Feb 31 → Mar 3).
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== day) return null;
  if (date.getTime() > Date.now()) return null; // no future birthdates
  return `${d.year}-${d.month}-${d.day}`;
}

/** MM / DD / YYYY dropdown row. */
export function DateSelect({
  label,
  value,
  onChange,
}: {
  label?: string;
  value: DateParts;
  onChange: (v: DateParts) => void;
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? (
        <Text style={{ color: colors.textMuted, fontSize: font.small, fontWeight: "600" }}>
          {label}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Select
          flex={1.4}
          placeholder="Month"
          value={value.month}
          options={MONTH_OPTIONS}
          onChange={(month) => onChange({ ...value, month })}
        />
        <Select
          flex={1}
          placeholder="Day"
          value={value.day}
          options={DAY_OPTIONS}
          onChange={(day) => onChange({ ...value, day })}
        />
        <Select
          flex={1.2}
          placeholder="Year"
          value={value.year}
          options={yearOptions()}
          onChange={(year) => onChange({ ...value, year })}
        />
      </View>
    </View>
  );
}
