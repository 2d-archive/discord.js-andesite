import {Collection} from "discord.js";
import {Player, PlayerOptions} from "../api/Player";
import {Node} from "../api/Node";

export class PlayerStore extends Collection<string, Player> {
  public constructor(
    public node: Node
  ) {
    super();
  };

  static get [Symbol.species]() {
    return <any>Collection;
  }

  public create(options: PlayerOptions): Player {
    const player = new Player(this.node, options);
    this.set(options.guildId, player);
    return player;
  }

  public delete(guild: string) {
    const player = this.get(guild);
    if (!player) return false;
    player.removeAllListeners();
    player.destroy();
    return super.delete(guild);
  }

  public async move(player: Player, node: Node) {
    await player.destroy();

    this.delete(player.guildId);
    player.node = node;
    player.rest = node.rest;

    await player["_voiceUpdate"];
    await player._moved();
    node.players.set(player.guildId, player);
  }
}