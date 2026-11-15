import { Pressable, ScrollView, Text, View } from "react-native";
import type { FourState, Game, SpaceSnapshot } from "../domain";
import { post } from "../lib/api";
import { useSpaceMutation } from "../lib/mutations";
import { Button, Empty, ErrorText } from "./ui";
import { colors, styles } from "../theme";
function Board({ game, data }: { game: Game; data: SpaceSnapshot }) {
  const state = game.state as FourState;
  const move = useSpaceMutation(data.me.id, (column: number) => post(`/api/games/${game.id}/moves`, { column, revision: game.revision }));
  const name = (id: string) => data.members.find((member) => member.id === id)?.name || "Partner";
  const finished = !!state.winner || state.draw;
  const canPlay = !finished && state.turn === data.me.id && !move.isPending;
  return <View style={[styles.card, { padding: 14 }]}><Text accessibilityLiveRegion="polite" style={styles.heading}>{state.winner ? `${name(state.winner)} won` : state.draw ? "A draw" : canPlay ? "Your turn" : `${name(state.turn)}’s turn`}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={{ flexDirection: "row" }}>{Array.from({ length: 7 }, (_, column) => <Pressable key={column} accessibilityRole="button" accessibilityLabel={`Drop a piece in column ${column + 1}`} accessibilityState={{ disabled: !canPlay || state.board[0][column] !== null }} disabled={!canPlay || state.board[0][column] !== null} onPress={() => move.mutate(column)} style={({ pressed }) => ({ width: 44, padding: 3, gap: 6, opacity: pressed ? .65 : 1 })}>{state.board.map((row, rowIndex) => { const owner = row[column]; const winning = state.winningCells.some(([r, c]) => r === rowIndex && c === column); return <View key={rowIndex} accessible accessibilityLabel={`Row ${rowIndex + 1}, column ${column + 1}: ${owner ? name(owner) : "empty"}`} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: owner ? owner === data.me.id ? colors.accent : colors.green : colors.background, borderWidth: winning ? 3 : 1, borderColor: winning ? colors.text : colors.line }}/>; })}</Pressable>)}</View></ScrollView><View style={styles.wrap}>{data.members.map((member) => <Text key={member.id} style={{ color: member.id === data.me.id ? colors.accent : colors.green, fontSize: 14 }}>{member.name}</Text>)}</View><ErrorText error={move.error}/></View>;
}
export function FourGames({ data }: { data: SpaceSnapshot }) {
  const create = useSpaceMutation(data.me.id, () => post("/api/games", { kind: "four" }));
  const games = data.games.filter((game) => game.kind === "four");
  return <View style={styles.stack}><Button secondary busy={create.isPending} disabled={data.members.length < 2} onPress={() => create.mutate()}>Start four in a row</Button>{data.members.length < 2 && <Text style={styles.muted}>This game needs both people in your space.</Text>}<ErrorText error={create.error}/>{games.length ? games.map((game) => <Board key={game.id} game={game} data={data}/>) : <Empty title="Take turns" detail="Connect four pieces horizontally, vertically, or diagonally."/>}</View>;
}
