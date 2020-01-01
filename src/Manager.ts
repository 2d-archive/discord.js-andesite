import { Client, Collection } from "discord.js";
import { EventEmitter } from "events";
import { NodeStore } from "./store/Node";
import { Player } from "./api/Player";
import { NodeOptions } from "./interfaces/Node";
import { Node } from "./api/Node";
import { LoadedTracks, TrackInfo } from "./interfaces/Entities";

export interface ManagerOptions {
  /**
   * A custom function used for sending packets to discord.
   */
  send?: (guildId: string, packet: Packet) => any;
  /**
   * The timeout for HTTP requests.
   * @default 10000
   */
  restTimeout?: number;
  /**
   * The number of tries to reconnect.
   * @default 3
   */
  reconnectTries?: number;
  /**
   * The nodes to connect to.
   */
  nodes: NodeOptions[];
  /**
   * The default volume for players.
   * @default 50
   */
  defaultVolume?: number;
  /**
   * The player class to use.
   * @defaults Player*/
  player?: typeof Player;
}

export interface VoiceServerUpdate {
  token: string;
  guild_id: string;
  endpoint: string;
}

export interface Packet {
  op?: string | number;
  t?: string;
  d?: any;
  s?: number;
}

export interface VoiceStateUpdate {
  channel_id?: string;
  guild_id: string;
  user_id: string;
  session_id: string;
  deaf?: boolean;
  mute?: boolean;
  self_deaf?: boolean;
  self_mute?: boolean;
  suppress?: boolean;
}

export class Manager extends EventEmitter {
  /**
   * The user id of the bot.
   */
  public userId!: string;
  /**
   * A collection of nodes.
   */
  public nodes: NodeStore = new NodeStore(this);
  /**
   * The timeout for rest actions.
   * @default 10000
   */
  public readonly restTimeout: number;
  /**
   * The default volume for players.
   * @default 50
   */
  public readonly defaultVolume: number;
  /**
   * How many tries to reconnect to the node.
   * @default 3
   */
  public readonly reconnectTries: number;
  /**
   * The player class to use.
   */
  public readonly player: typeof Player;

  /**
   * Creates a new Manager.
   * @param client The client used for receiving packets.
   * @param options Manager Options.
   */
  public constructor(
    public readonly client: Client,
    public readonly options: ManagerOptions
  ) {
    super();

    if (!options.nodes) throw new Error("Provide an array of nodes.");

    const def = <T>(v: T | undefined, def: T): T => (v === undefined ? def : v);
    this.defaultVolume = def(options.defaultVolume, 100);
    this.restTimeout = def(options.restTimeout, 20000);
    this.reconnectTries = def(options.reconnectTries, 3);
    this.player = def(options.player, Player);

    client.on("raw", async (pk: Packet) => {
      if (!["VOICE_STATE_UPDATE", "VOICE_SERVER_UPDATE"].includes(pk.t)) return;

      const player: any = this.players.get(pk.d.guild_id);
      if (!player) return;

      switch (pk.t) {
        case "VOICE_SERVER_UPDATE":
          player.voiceServer = pk.d;
          await player._voiceUpdate();
          break;
        case "VOICE_STATE_UPDATE":
          if (pk.d.user_id !== this.client.user.id) return;
          player.voiceState = pk.d;
          break;
      }
    });
  }

  /**
   * A collection of players.
   */
  public get players(): Collection<string, Player> {
    const collection: Collection<string, Player> = new Collection();
    for (const node of this.nodes.values())
      for (const player of node.players.values())
        collection.set(player.guildId, player);
    return collection;
  }

  /**
   * Uses the /loadtracks endpoint, returns the response.
   * @param {string} query - The query for the identifier query parameter.
   * @param {Node} node - Used for balancing requests throughout the nodes.
   * Defaults to an ideal node.
   * @returns {Promise<LoadedTracks>} the /loadtracks result.
   */
  public search(query: string, node?: Node): Promise<LoadedTracks> {
    if (!node && !this.nodes.get()) throw new Error(`No node available.`);
    return new Promise<LoadedTracks>((res, rej) => {
      return (<Node>node || this.nodes.get()).rest
        .get(`/loadtracks?identifier=${query}`)
        .then(res)
        .catch(rej);
    });
  }

  /**
   * Uses the /decodetracks endpoint, returns an array of track info
   * @param {string | string[]} tracks - An array of Base64 tracks or just a singular Base64 track.
   * @param {Node} node - Used for balancing requests throughout the nodes.
   * Defaults to an ideal node.
   * @returns {Promise<TrackInfo[]>} the decoded tracks.
   */
  public decode(
    tracks: string | string[],
    node: Node = this.nodes.get()
  ): Promise<TrackInfo[]> {
    return new Promise((res, rej) => {
      if (!node) return rej(new Error(`No node available.`));
      return node.rest
        .post("/decodetracks", {
          tracks: Array.isArray(tracks) ? tracks : [tracks]
        })
        .then((_: TrackInfo[]) => res(_))
        .catch(rej);
    });
  }

  /**
   * Initializes this manager, and connects all the nodes.
   * @param {string} userId - The user id of the bot.
   */
  public init(userId: string): void {
    if (!userId) throw new Error("you must provide a user id.");
    this.userId = userId;
    return this.nodes.createMany(...this.options.nodes);
  }

  /**
   * Sends a packet to discord.
   * @param packet
   * @private
   */
  public _send(packet: Packet): void {
    if (this.options.send && typeof this.options.send === "function")
      return this.options.send(packet.d.guild_id, packet);

    const guild = this.client.guilds.get(packet.d.guild_id);
    if (!guild) return;
    this.client.ws.shards
      ? guild.shard.send(packet)
      : (this.client.ws as any).send(packet);
  }
}
