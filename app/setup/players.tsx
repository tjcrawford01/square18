import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useRoundStore } from '../../src/store/roundStore';
import { NavBar } from '../../src/components/NavBar';
import { Card } from '../../src/components/Card';
import { SectionLabel } from '../../src/components/SectionLabel';
import { PrimaryBtn } from '../../src/components/PrimaryBtn';
import { Colors } from '../../src/theme/colors';
import type { Player } from '../../src/store/roundStore';

const PLAYER_COLORS = [Colors.forest, Colors.blue, Colors.red, '#6a3d9a'];

function initialsFromName(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';
}

export default function PlayersScreen() {
  const router = useRouter();
  const { players, setPlayers } = useRoundStore();
  const safePlayers = Array.isArray(players) ? players : [];
  const [editing, setEditing] = useState<number | null>(null);
  const [editingNameByPlayer, setEditingNameByPlayer] = useState<Record<number, string>>({});
  const [editingHcp, setEditingHcp] = useState<{ playerId: number; value: string } | null>(null);

  const updatePlayer = (id: number, field: keyof Player, value: string | number) => {
    setPlayers((ps) =>
      (Array.isArray(ps) ? ps : []).map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const addPlayer = () => {
    if (safePlayers.length >= 4) return;
    const id = Date.now();
    const n = safePlayers.length + 1;
    setPlayers((ps) => [
      ...(Array.isArray(ps) ? ps : []),
      { id, name: `Player ${n}`, initials: `P${n}`, index: 0, venmo: '' },
    ]);
  };

  const removePlayer = (id: number) => {
    if (safePlayers.length <= 2) return;
    setPlayers((ps) => (Array.isArray(ps) ? ps : []).filter((p) => p.id !== id));
  };

  const handleNameChange = (p: Player, text: string) => {
    setEditingNameByPlayer((prev) => ({ ...prev, [p.id]: text }));
    updatePlayer(p.id, 'name', text);
    updatePlayer(p.id, 'initials', initialsFromName(text));
  };

  const displayName = (p: Player) => editingNameByPlayer[p.id] ?? p.name;

  return (
    <View style={styles.container}>
      <NavBar title="Players & Handicaps" subtitle="Step 1 of 3" onBack={() => router.back()} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <SectionLabel>Who's playing?</SectionLabel>
        {safePlayers.map((p, i) => (
          <Card key={p.id} accent={editing === p.id ? Colors.gold : Colors.grayLight}>
            <View style={styles.cardInner}>
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: PLAYER_COLORS[i] ?? Colors.parchment },
                ]}
              >
                <Text style={styles.avatarText}>{p.initials}</Text>
              </View>
              <View style={styles.fields}>
                {editing === p.id ? (
                  <TextInput
                    autoFocus
                    value={displayName(p)}
                    onChangeText={(t) => handleNameChange(p, t)}
                    onBlur={() => { setEditing(null); setEditingNameByPlayer((prev) => { const next = { ...prev }; delete next[p.id]; return next; }); }}
                    style={styles.nameInput}
                    placeholder="Name"
                  />
                ) : (
                  <Pressable onPress={() => { setEditing(p.id); setEditingNameByPlayer((prev) => ({ ...prev, [p.id]: p.name })); }}>
                    <Text style={styles.name}>{p.name}</Text>
                  </Pressable>
                )}
                <View style={styles.row}>
                  <Text style={styles.fieldLabel}>HCP INDEX</Text>
                  <TextInput
                    style={styles.hcpInput}
                    value={editingHcp?.playerId === p.id ? editingHcp.value : (typeof p.index === 'number' ? String(p.index) : '')}
                    placeholder="—"
                    keyboardType="decimal-pad"
                    onChangeText={(t) => {
                      const cleaned = t.replace(/[^0-9.]/g, '');
                      const parts = cleaned.split('.');
                      if (parts.length > 2) return;
                      setEditingHcp((prev) => (prev?.playerId === p.id ? { ...prev, value: cleaned } : { playerId: p.id, value: cleaned }));
                    }}
                    onFocus={() => setEditingHcp({ playerId: p.id, value: typeof p.index === 'number' ? String(p.index) : '' })}
                    onBlur={() => {
                      if (editingHcp?.playerId === p.id) {
                        const num = parseFloat(editingHcp.value);
                        if (!Number.isNaN(num) && editingHcp.value.trim() !== '') {
                          updatePlayer(p.id, 'index', num);
                        }
                        setEditingHcp(null);
                      }
                    }}
                  />
                </View>
                <View style={styles.row}>
                  <Text style={styles.fieldLabel}>VENMO</Text>
                  <TextInput
                    style={styles.venmoInput}
                    value={p.venmo}
                    placeholder="@username"
                    onChangeText={(t) => updatePlayer(p.id, 'venmo', t)}
                    autoCapitalize="none"
                  />
                </View>
              </View>
              <View style={styles.actions}>
                <Pressable onPress={() => { setEditing(p.id); setEditingNameByPlayer((prev) => ({ ...prev, [p.id]: p.name })); }}>
                  <Text style={styles.editBtn}>✎</Text>
                </Pressable>
                {safePlayers.length > 2 && (
                  <Pressable onPress={() => removePlayer(p.id)}>
                    <Text style={styles.removeBtn}>×</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </Card>
        ))}
        {safePlayers.length < 4 && (
          <Pressable style={styles.addBtn} onPress={addPlayer}>
            <Text style={styles.addBtnText}>+ Add Player ({safePlayers.length}/4)</Text>
          </Pressable>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryBtn label="Choose Game →" onPress={() => router.push('/setup/game')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.cream,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 16,
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.gold,
    marginTop: 2,
  },
  avatarText: {
    color: Colors.cream,
    fontWeight: '700',
    fontSize: 13,
  },
  fields: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.ink,
  },
  nameInput: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.ink,
    padding: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  fieldLabel: {
    color: Colors.gray,
    fontSize: 11,
    minWidth: 62,
  },
  hcpInput: {
    width: 52,
    borderWidth: 1,
    borderColor: Colors.grayLight,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.forest,
    backgroundColor: Colors.parchment,
  },
  venmoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.grayLight,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 8,
    fontSize: 12,
    color: Colors.blue,
    backgroundColor: Colors.parchment,
  },
  actions: {
    flexDirection: 'column',
    gap: 6,
    marginTop: 2,
  },
  editBtn: {
    color: Colors.gray,
    fontSize: 16,
  },
  removeBtn: {
    color: Colors.red,
    fontSize: 18,
  },
  addBtn: {
    width: '100%',
    paddingVertical: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.grayLight,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  addBtnText: {
    color: Colors.gray,
    fontSize: 13,
  },
  footer: {
    padding: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.parchment,
  },
});
