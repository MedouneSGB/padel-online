import { useEffect, useRef, useState } from "react";
import { Game } from "./game/engine";
import { Hud } from "./ui/Hud";

export default function App() {
  const host = useRef<HTMLDivElement>(null);
  const [game, setGame] = useState<Game | null>(null);

  useEffect(() => {
    if (!host.current) return;
    const g = new Game(host.current);
    setGame(g);
    return () => {
      g.dispose();
      setGame(null);
    };
  }, []);

  return (
    <div className="shell">
      <div className="viewport" ref={host} />
      {game ? <Hud game={game} /> : null}
    </div>
  );
}
