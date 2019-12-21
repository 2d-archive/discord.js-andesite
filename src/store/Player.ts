import {Collection} from "discord.js";
import {Player, PlayerOptions} from "../api/Player";
import {Node} from "../api/Node";

export class PlayerStore extends Collection<string, Player> {
  public constructor(public node: Node) {
    super();
  };

  static get [Symbol.species](): typeof Map {
    return <any>Collection;
  }

  /**
   * Creates a player.
   * @param {PlayerOptions} options - The guild and channel ID.
   * @returns {Player} a new player.
   */
  public create(options: PlayerOptions): Player {
    const player = new (this.node.manager.player)(this.node, options);
    this.set(options.guildId, player);
    return player;
  }

  /**
   * Destroys and deletes the player from this store.
   * @param {string} guild - The players guildId
   * @returns {boolean} Whether or not the deletion was successful
   */
  public delete(guild: string): boolean {
    const player = this.get(guild);
    if (!player) return false;
    player.removeAllListeners();
    player.destroy();
    return super.delete(guild);
  }

  /**
   * Moves a player from one node to another.
   * @param {Player} player - The player to move.
   * @param {Node} node - The node to move said player to.
   * @returns {Promise<void>}
   */
  public async move(player: Player, node: Node): Promise<void> {
    await player.destroy();

    this.delete(player.guildId);
    player.node = node;
    player.rest = node.rest;

    await player["_voiceUpdate"]();
    await player._moved();
    node.players.set(player.guildId, player);
  }
}