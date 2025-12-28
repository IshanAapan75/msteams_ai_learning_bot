async function getLeaderboard() {
  const res = await fetch("http://localhost:3000/api/leaderboard", {
    cache: "no-store",
  });
  return res.json();
}

export default async function Home() {
  const { teams, users } = await getLeaderboard();

  return (
    <main style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Leaderboard</h1>
      <h2>Teams</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ border: "1px solid #ddd", padding: 8, textAlign: "left" }}>Team</th>
            <th style={{ border: "1px solid #ddd", padding: 8, textAlign: "left" }}>Score</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => (
            <tr key={team.id}>
              <td style={{ border: "1px solid #ddd", padding: 8 }}>{team.name}</td>
              <td style={{ border: "1px solid #ddd", padding: 8 }}>{team.score}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 40 }}>Users</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ border: "1px solid #ddd", padding: 8, textAlign: "left" }}>User</th>
            <th style={{ border: "1px solid #ddd", padding: 8, textAlign: "left" }}>XP</th>
            <th style={{ border: "1px solid #ddd", padding: 8, textAlign: "left" }}>Level</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td style={{ border: "1px solid #ddd", padding: 8 }}>{user.name}</td>
              <td style={{ border: "1px solid #ddd", padding: 8 }}>{user.xp}</td>
              <td style={{ border: "1px solid #ddd", padding: 8 }}>{user.level}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}