import { useEffect, useMemo, useRef, useState } from "react";
import type { Game } from "../game/engine";
import type { CameraView, HudState, ShotType } from "../game/types";

function formatKey(code: string) {
  if (!code) return "—";
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Numpad")) return "Pavé " + code.slice(6);
  if (code === "Space") return "Espace";
  if (code === "Mouse0") return "Clic G";
  if (code === "Mouse1") return "Clic D";
  if (code === "Mouse2") return "Clic M";
  return code.replace("Arrow", "Flèche ");
}

const SHOTS: { id: ShotType; label: string; icon: string; klass: string }[] = [
  { id: "lob", label: "LOB", icon: "⤴", klass: "shot cyan shot-lob" },
  { id: "smash", label: "SMASH", icon: "⚡", klass: "shot green shot-smash" },
  { id: "service", label: "SERVICE", icon: "🎾", klass: "shot teal shot-service" },
  { id: "volee", label: "VOLÉE", icon: "⚔", klass: "shot cyan shot-volee" },
  { id: "bandeja", label: "BANDEJA", icon: "✶", klass: "shot purple shot-bandeja" },
];

export function Hud({ game }: { game: Game }) {
  const [s, setS] = useState<HudState>(() => game.hud);
  const [draft, setDraft] = useState("");
  const [muted, setMuted] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [name, setName] = useState(game.hud.playerName);

  useEffect(() => game.subscribe(setS), [game]);

  const stats = s.statsTab === "vous" ? s.statsVous : s.statsAdv;
  const servePct = stats.servicesTentes
    ? Math.round((100 * stats.servicesReussis) / stats.servicesTentes)
    : 0;

  const rows = useMemo(
    () => [
      ["Points gagnés", stats.pointsGagnes],
      ["Fautes directes", stats.fautesDirectes],
      ["Smash gagnants", stats.smashGagnants],
      ["Balles sorties", stats.ballesSorties],
      ["% 1er service", `${servePct}%`],
      ["Points au filet", stats.pointsAuFilet],
    ],
    [stats, servePct],
  );

  const youNames = [s.names[0] || "Toi", s.names[1] || "Aziz"];
  const nameOk = name.trim().length >= 2;

  return (
    <div className="hud">
      <header className="top">
        <div className="logo">
          PADEL
          <span>ONLINE</span>
        </div>
        <div
          className="scoreboard"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <TeamBlock names={youNames} you />
          <div className="games blue">{s.gamesVous}</div>
          <div className="mid">
            <div className="set">SET {s.set}</div>
            <div className="pts">
              {s.pointsVous} — {s.pointsAdversaire}
              <i />
            </div>
          </div>
          <div className="games green">{s.gamesAdversaire}</div>
          <TeamBlock names={[s.names[2] || "Médoune", s.names[3] || "Imran"]} />
        </div>
        <div className="top-right">
          <button
            className={`icon-btn ${statsOpen ? "on" : ""}`}
            onClick={() => setStatsOpen((v) => !v)}
            title="Statistiques"
          >
            Stats
          </button>
          <button
            className={`icon-btn ${chatOpen ? "on" : ""}`}
            onClick={() => setChatOpen((v) => !v)}
            title="Chat"
          >
            Chat
          </button>
          <button className="icon-btn" onClick={() => game.openSettings()} title="Réglages">
            ⚙
          </button>
          <span className="ping">
            <b />
            {s.ping}ms
          </span>
          <button className="quit" onClick={() => game.togglePause()}>
            <span className="quit-full">QUITTER</span>
            <span className="quit-short">II</span>
          </button>
        </div>
      </header>

      {statsOpen && (
        <aside className="panel left stats-panel">
          <div className="chat-head">
            STATISTIQUES
            <button className="icon-btn tiny" onClick={() => setStatsOpen(false)}>
              ✕
            </button>
          </div>
          <div className="tabs">
            <button className={s.statsTab === "vous" ? "on" : ""} onClick={() => game.setStatsTab("vous")}>
              VOUS
            </button>
            <button
              className={s.statsTab === "adversaires" ? "on" : ""}
              onClick={() => game.setStatsTab("adversaires")}
            >
              ADVERSAIRES
            </button>
          </div>
          <ul className="stats">
            {rows.map(([k, v]) => (
              <li key={k}>
                <span>{k}</span>
                <strong>{v}</strong>
              </li>
            ))}
          </ul>
        </aside>
      )}

      {chatOpen && (
        <aside className="panel right chat-panel">
          <div className="chat-head">
            CHAT
            <button className="icon-btn tiny" onClick={() => setChatOpen(false)}>
              ✕
            </button>
          </div>
          <div className="chat">
            {s.chat.map((m) => (
              <div key={m.id} className="msg">
                <div>
                  <b>{m.author}</b>
                  <em>{m.time}</em>
                </div>
                <p>{m.text}</p>
              </div>
            ))}
          </div>
          <form
            className="chat-in"
            onSubmit={(e) => {
              e.preventDefault();
              game.sendChat(draft);
              setDraft("");
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Écrire un message…"
              maxLength={80}
            />
          </form>
          <h3>ÉMOTES</h3>
          <div className="emotes">
            {["👍", "👏", "💪", "😄", "😎", "🔥", "🚀", "❤️"].map((e) => (
              <button key={e} onClick={() => game.emotePlayer(e)}>
                {e}
              </button>
            ))}
          </div>
        </aside>
      )}

      {s.analog ? (
        <AnalogStick onMove={(x, z) => game.setMove(x, z)} onEnd={() => game.setMove(0, 0)} />
      ) : (
        <DPad onMove={(x, z) => game.setMove(x, z)} onEnd={() => game.setMove(0, 0)} />
      )}

      <button
        className={`hit-btn ${s.canHit ? "ready" : ""} ${s.charging ? "charging" : ""}`}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          game.pressHit();
        }}
        onPointerUp={() => game.releaseHit()}
        onPointerCancel={() => game.releaseHit()}
        onPointerLeave={() => game.releaseHit()}
      >
        {s.phase === "serve" ? "SERVIR" : "FRAPPER"}
      </button>

      <div className="shots">
        {SHOTS.filter((sh) => s.shotButtons[sh.id]).map((sh) => (
          <button
            key={sh.id}
            className={`${sh.klass} ${s.selectedShot === sh.id ? "sel" : ""}`}
            onClick={() => game.setShot(sh.id)}
          >
            <span>{sh.icon}</span>
            {sh.label}
            <em>{formatKey(s.shotKeys[sh.id])}</em>
          </button>
        ))}
      </div>

      <div className="serve-bar">
        <div className="serve-label">
          AU SERVICE : <strong>{s.servingTeam === 0 ? "VOUS" : s.serverName.toUpperCase()}</strong>
        </div>
        <div className="power">
          <i style={{ width: `${Math.max(8, s.power * 100)}%`, opacity: s.charging ? 1 : 0.35 }} />
        </div>
      </div>

      {s.canHit && s.overlay === "none" && s.phase !== "pause" && (
        <div className="hit-hint">
          <span className="pc-copy">{s.phase === "serve" ? "ESPACE : SERVIR" : "ESPACE : FRAPPER"}</span>
          <span className="touch-copy">{s.phase === "serve" ? "APPUIE POUR SERVIR" : "APPUIE POUR FRAPPER"}</span>
        </div>
      )}
      {s.banner && <div className="banner">{s.banner}</div>}
      {s.tutorial && s.overlay === "none" && (
        <div className="tutorial">
          <span className="pc-copy">ZQSD / analogique pour bouger · Espace pour frapper · 1-5 pour les coups</span>
          <span className="touch-copy">Joystick pour bouger · Bouton vert pour frapper · Choisis un coup</span>
        </div>
      )}

      {s.overlay === "intro" && (
        <div className="overlay">
          <form
            className="intro-card"
            onSubmit={(e) => {
              e.preventDefault();
              if (!nameOk) return;
              game.setPlayerName(name);
              game.startMatch();
            }}
          >
            <div className="logo big">
              PADEL
              <span>ONLINE</span>
            </div>
            <p>Match 2 contre 2 · Terrain padel · Bots inclus</p>
            <label className="name-field">
              Ton nom
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  game.setPlayerName(e.target.value);
                }}
                placeholder="Entre ton nom"
                maxLength={16}
                autoFocus
                required
                minLength={2}
              />
            </label>
            <ul>
              <li>Toi + Aziz contre Médoune & Imran</li>
              <li>Utilise les murs, le lob et la bandeja</li>
              <li>Un seul service, comme en vrai</li>
            </ul>
            <button className="cta" type="submit" disabled={!nameOk}>
              ENTRER SUR LE COURT
            </button>
            <small>Choisis un nom (2 caractères min.)</small>
          </form>
        </div>
      )}

      {s.overlay === "pause" && (
        <div className="overlay">
          <div className="intro-card">
            <h2>Pause</h2>
            <button className="cta" onClick={() => game.togglePause()}>
              REPRENDRE
            </button>
            <button className="ghost" onClick={() => game.resetMatch()}>
              NOUVEAU MATCH
            </button>
          </div>
        </div>
      )}

      {s.overlay === "settings" && (
        <div className="overlay">
          <div className="intro-card settings-card">
            <h2>Réglages</h2>
            <div className="settings-grid">
              <div className="settings-col">
                <button
                  className="ghost"
                  onClick={() => {
                    setMuted((m) => {
                      game.setMuted(!m);
                      return !m;
                    });
                  }}
                >
                  Son : {muted ? "Coupé" : "Activé"}
                </button>
                <div className="setting-row">
                  <span>Déplacement</span>
                  <div className="seg">
                    <button className={!s.analog ? "on" : ""} onClick={() => game.setAnalog(false)}>
                      D-pad
                    </button>
                    <button className={s.analog ? "on" : ""} onClick={() => game.setAnalog(true)}>
                      Analogique
                    </button>
                  </div>
                </div>
                <div className="setting-row cam-row">
                  <span>Vue caméra</span>
                  <div className="seg wrap">
                    {(
                      [
                        ["match", "Match"],
                        ["behind", "Derrière"],
                        ["player", "Joueur"],
                      ] as [CameraView, string][]
                    ).map(([id, label]) => (
                      <button key={id} className={s.camera === id ? "on" : ""} onClick={() => game.setCamera(id)}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="setting-block">
                  <span>Vitesse de la balle</span>
                  <div className="speed-row">
                    <input
                      type="range"
                      min={50}
                      max={115}
                      step={5}
                      value={Math.round(s.ballSpeed * 100)}
                      onChange={(e) => game.setBallSpeed(Number(e.target.value) / 100)}
                    />
                    <em>{Math.round(s.ballSpeed * 100)}%</em>
                  </div>
                </div>
                <div className="setting-block">
                  <span>Boutons d’action à l’écran</span>
                  <div className="shot-toggles">
                    {SHOTS.map((sh) => (
                      <label key={sh.id}>
                        <input
                          type="checkbox"
                          checked={s.shotButtons[sh.id]}
                          onChange={(e) => game.setShotButton(sh.id, e.target.checked)}
                        />
                        {sh.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="settings-col">
                <div className="setting-block">
                  <span>Touches PC</span>
                  <p className="bind-help">
                    Clique une case, puis une touche ou un clic.
                    {s.listeningBind ? " En attente…" : ""}
                  </p>
                  <div className="binds">
                    <div className="bind-row">
                      <span>Frapper / servir</span>
                      <button
                        className={s.listeningBind === "hit" ? "listening" : ""}
                        onClick={() => game.beginBind("hit")}
                      >
                        {s.listeningBind === "hit" ? "…" : formatKey(s.hitKey)}
                      </button>
                    </div>
                    {SHOTS.map((sh) => (
                      <div className="bind-row" key={sh.id}>
                        <span>
                          {sh.icon} {sh.label}
                        </span>
                        <button
                          className={s.listeningBind === sh.id ? "listening" : ""}
                          onClick={() => game.beginBind(sh.id)}
                        >
                          {s.listeningBind === sh.id ? "…" : formatKey(s.shotKeys[sh.id])}
                        </button>
                      </div>
                    ))}
                  </div>
                  <button className="ghost" type="button" onClick={() => game.resetKeys()}>
                    RÉINITIALISER LES TOUCHES
                  </button>
                </div>
              </div>
            </div>
            <button className="cta settings-close" onClick={() => game.openSettings()}>
              FERMER
            </button>
          </div>
        </div>
      )}

      {s.overlay === "end" && (
        <div className="overlay">
          <div className="intro-card">
            <h2>{s.winner === 0 ? "Victoire !" : "Défaite"}</h2>
            <p>
              Set {s.gamesVous} — {s.gamesAdversaire}
            </p>
            <button className="cta" onClick={() => game.resetMatch()}>
              REJOUER
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TeamBlock({ names, you }: { names: string[]; you?: boolean }) {
  return (
    <div className={`team ${you ? "you" : ""}`}>
      <div className="avatars">
        {names.map((n) => (
          <i key={n} data-n={n[0] || "?"}>
            {(n[0] || "?").toUpperCase()}
          </i>
        ))}
      </div>
      <div className="names">
        {names.map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
      <small>{you ? "ÉQUIPE VOUS" : "ÉQUIPE ADVERSE"}</small>
    </div>
  );
}

function DPad({ onMove, onEnd }: { onMove: (x: number, z: number) => void; onEnd: () => void }) {
  const go = (x: number, z: number) => () => onMove(x, z);
  return (
    <div
      className="dpad"
      onPointerDown={(e) => e.preventDefault()}
      onPointerUp={onEnd}
      onPointerLeave={onEnd}
      onPointerCancel={onEnd}
    >
      <button className="n" onPointerDown={go(0, -1)} />
      <button className="e" onPointerDown={go(1, 0)} />
      <button className="s" onPointerDown={go(0, 1)} />
      <button className="w" onPointerDown={go(-1, 0)} />
      <b />
    </div>
  );
}

function AnalogStick({ onMove, onEnd }: { onMove: (x: number, z: number) => void; onEnd: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const steer = (clientX: number, clientY: number) => {
    const el = root.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const max = r.width * 0.32;
    const len = Math.hypot(dx, dy) || 1;
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    setKnob({ x: dx, y: dy });
    onMove(dx / max, dy / max);
  };

  return (
    <div
      ref={root}
      className="analog"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        steer(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        steer(e.clientX, e.clientY);
      }}
      onPointerUp={() => {
        setKnob({ x: 0, y: 0 });
        onEnd();
      }}
      onPointerCancel={() => {
        setKnob({ x: 0, y: 0 });
        onEnd();
      }}
    >
      <i style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
    </div>
  );
}
